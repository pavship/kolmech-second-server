import axios from 'axios'
import FormData from 'form-data'
import ImapSimple from 'imap-simple'
import { db } from '../src/postgres.js'
import bot from '../bot.js'
import { clearCache, endJob, setStore } from '../src/user.js'
import { outputJson, functionName, debugLog, despace } from '../src/utils.js'
import { getOrg } from '../src/moedelo.js'
import { amoBaseUrl, findAmoCompany, findAmoDeals, getAmoContact, getAmoStatuses, getDealNotes } from '../src/amo.js'
import { createTask, createTaskComment, doTaskAction, getProj, getProjTasks } from '../src/megaplan.js'
import { constructMoveMessageText } from './transfer-accounting.js'
import { ceoImapConfig, EMAIL_USERS, serverSmtpTransporter } from '../src/mail.js'

const handlePostReceipt = async data => {
	if (process.env.debug) debugLog(functionName())
	const { post, move } = data

	if (!post) return askForRPO(data)

	if (!post.dataIsPrepared) return prepareData(data)

	if (!post.tracking) return getRPOInfo(data)

	if (!post.company) return askForRecipient(data)
	
	if (!post.deal) return askForDeal(data)

	if (!post.project) return askForPostProject(data)

	if (!post.task) return askForPostTask(data)
	
	if (!move) return createMove(data)

	if (!post.comment) return commentOnPost(data)
	
	if (!post.contact) return askForContact(data)
	
	if (!post.email_to_reply) return askForEmailToReply(data)

	if (!post.sent_reply) return sendPostReply(data)

	endJob(data)
}

const askForRPO = async data => {
	if (process.env.debug) debugLog(functionName(), data)
	const { msg: { text }, state, transfer: { receipt } } = data

	if (state !== 'ask-for-rpo') {
		data._rpo_start = receipt.ticket.document.receipt.retailPlace.slice(-6)
		data.msg = await bot.sendMessage( data.user.chat_id,
			`Добейте трек номер после ${data._rpo_start}...`
		)
		data.state = 'ask-for-rpo'
		return setStore(data)
	}

	data.post = {
		rpo: data._rpo_start + text
	}

	handlePostReceipt(clearCache(data))
}

const prepareData = async data => {
	if (process.env.debug) debugLog(functionName(), data)
	const { post } = data

	post.dataIsPrepared = true
	handlePostReceipt({ ...data, from_org: data.to_org, to_org: data.from_org })
}



const getRPOInfo = async data => {
	if (process.env.debug) debugLog(functionName(), data)
	const { post } = data

	const form = new FormData()
	form.append('barcodes', post.rpo)
	const headers = form.getHeaders()
	try {
		data.post.tracking = (await axios.post(
			`https://www.pochta.ru/tracking?p_p_id=trackingPortlet_WAR_portalportlet&p_p_lifecycle=2&p_p_state=normal&p_p_mode=view&p_p_resource_id=tracking.get-by-barcodes&p_p_cacheability=cacheLevelPage&p_p_col_id=column-1&p_p_col_count=1`,
			form,
			{ headers }
		)).data.response[0].trackingItem
	}
	catch (err) {
		await bot.sendMessage( data.user.chat_id, `Не получилось получить данные с сервера Почты России по трек номеру ${post.rpo}.` )
		delete data.post
	}
	handlePostReceipt(data)
}

const askForRecipient = async data => {
	if (process.env.debug) debugLog(functionName(), data)
	const { msg: { text }, state, post } = data

	if (state !== 'ask-for-recipient') {
		data._search = post.tracking.recipient.trim().replace(/ООО /, '')
		data._moedelo_org = await getOrg({ name: data._search })
		data._amo_company = await findAmoCompany(data._search)
		if (data._amo_company) {
			post.company = data._amo_company
			data.msg = await bot.sendMessage( data.user.chat_id,
				`Выбрана организация ${post.company.name}`,
			)
			return handlePostReceipt(clearCache(data))
		}
		

		// TODO select org if multiple found or find by search
	}
}

const askForDeal = async data => {
	if (process.env.debug) debugLog(functionName(), data)
	const { msg: { text }, state, actions, post } = data

	if (state !== 'ask-for-deal') {
		data._deals = await findAmoDeals({ id: post.company.leads.id })
		data._statuses = await getAmoStatuses()
		if (data._deals?.length === 1) {
			post.deal = data._deals[0]
			data.msg = await bot.sendMessage( data.user.chat_id,
				`Выбрана единственная сделка ${post.deal.name}`,
			)
			return handlePostReceipt(clearCache(data))
		}
		data.msg = await bot.sendMessage( data.user.chat_id,
			`Выберите сделку, либо введите её AmoId`,
			{
				reply_markup: {
					inline_keyboard: [
						...data._deals.map(({ id, name, status_id }) => [{
							text: `🤝 ${name} (${data._statuses[status_id].name})`,
							callback_data: `ask-for-deal:${id}`
						}]),
					]
				}
			}
		)
		data.state = 'ask-for-deal'
		return setStore(data)
	}

	data.post.deal = actions?.length
		? data._deals.find(({ id }) => id === parseInt(actions[0]))
		: (await findAmoDeals({ id: parseInt(text) }))?.[0]

	handlePostReceipt(clearCache(data))
}

const askForPostProject = async data => {
	if (process.env.debug) debugLog(functionName(), data)
	const { msg: { text }, state, actions, post } = data

	if (state !== 'ask-for-post-project') {
		data._project = await getProj(post.deal.custom_fields.find(f => f.name === 'mpId').values[0].value)
		if (!data._project.subProjects?.find(sp => sp.name.startsWith('Обработка №'))) {
			post.project = data._project
			data.msg = await bot.sendMessage( data.user.chat_id,
				`Выбран проект <a href='https://${process.env.MEGAPLAN_HOST}/project/${post.project.id}/card/'>${post.project.name}</a>`, {
				parse_mode: 'HTML',
				disable_web_page_preview: true
			})
			return handlePostReceipt(clearCache(data))
		}
		// TODO select subproject of regular deals
	}

	handlePostReceipt(clearCache(data))
}

const askForPostTask = async data => {
	if (process.env.debug) debugLog(functionName(), data)
	const { msg: { text }, state, actions, post } = data

	if (state !== 'ask-for-post-task') {
		data._task = (await getProjTasks(post.project.id))?.find(t => t.name === 'Корреспонденция')
		if (data._task) {
			post.task = data._task
			data.msg = await bot.sendMessage( data.user.chat_id,
				`Выбрана существовавшая задача <a href='https://${process.env.MEGAPLAN_HOST}/task/${post.task.id}/card/'>${post.task.name}</a>`, {
				parse_mode: 'HTML',
				disable_web_page_preview: true
			})
		}
		else {
			post.task = await createTask({
				name: 'Корреспонденция',
				parent: {id: post.project.id, contentType: 'Project'}
			})
			data.msg = await bot.sendMessage( data.user.chat_id,
				`Создана задача <a href='https://${process.env.MEGAPLAN_HOST}/task/${post.task.id}/card/'>${post.task.name}</a>`, {
				parse_mode: 'HTML',
				disable_web_page_preview: true
			})
		}

		if (post.task.status === 'assigned')
			await doTaskAction(post.task.id, {action: 'act_accept_work', checkTodos: true})
		// await doTaskAction(post.task.id, {action: 'act_done', checkTodos: true})
	}

	handlePostReceipt(clearCache(data))
}

const createMove = async data => {
	if (process.env.debug) debugLog(functionName(), data)
	const { msg: { text }, state, actions, post } = data

	data._move = {
		transfer_id: data.transfer.id,
		amount: data.transfer.amount,
		paid: data.transfer.amount,
		from_amo_id: data.to_account.amo_id,
		from_inn: data.to_account.inn,
		to_amo_id: data.from_account.amo_id,
		to_inn: data.from_account.inn,
		task_id: data.post.task.id,
		proj_id: null,
	}

	data.move = await db.oneOrNone(
		`SELECT * FROM public.move 
		WHERE transfer_id = $<transfer_id> AND task_id = $<task_id>`,
		data._move
	)
	if (!data.move) {
		data.move = await db.one(
			`INSERT INTO public.move(transfer_id, from_amo_id, from_inn, to_amo_id, to_inn, amount, paid, task_id, proj_id)
			VALUES ($<transfer_id>, $<from_amo_id>, $<from_inn>, $<to_amo_id>, $<to_inn>, $<amount>, $<paid>, $<task_id>, $<proj_id>) RETURNING *`,
			data._move
		)
		data.move.was_created = true
	}

	data.msg = await bot.sendMessage( data.user.chat_id,
		constructMoveMessageText(data), {
		parse_mode: 'HTML'
	})

	handlePostReceipt(clearCache(data))
}

const commentOnPost = async data => {
	if (process.env.debug) debugLog(functionName(), data)
	const { state, user, transfer, move, task, from_org, post } = data

	if (!data._company) {
		data._company = await findAmoCompany(from_org.Inn)
		if (!data._company) {
			data.msg = await bot.sendMessage( user.chat_id,
				`Заполните ИНН ${from_org.Inn} поставщика ${from_org.ShortName} в AmoCRM`,
				{
					reply_markup: { inline_keyboard: [
						[{
							text: `Готово`,
							callback_data: `commentOnPurchase:skip`
						}],
					]},
					parse_mode: 'HTML'
				}
			)
			data.state = 'commentOnPost'
			return setStore(data)
		}
	}

	post.comment = await createTaskComment({
		task: post.task,
		content: despace`
			<p>🗓 ${new Date((transfer.datetime + 3*3600)*1000).toISOString().replace(/T|\.000Z/g, ' ')}
			💵 ${move.paid} ₽
			${!!data.from_org ? `🛒🏢 <a href='${amoBaseUrl}/companies/detail/${data._company.id}'>${data.from_org.ShortName}</a>` : ''}
			✉️ https://www.pochta.ru/tracking#${post.rpo}
			</p>
		`
	})

	handlePostReceipt(clearCache(data))
}

const askForContact = async data => {
	if (process.env.debug) debugLog(functionName(), data)
	const { msg: { text }, state, actions, post } = data

	if (state !== 'ask-for-contact') {
		data._contact = await getAmoContact(post.deal.main_contact.id)
		post.contact = data._contact
		post.email_address_to_answer = post.contact.custom_fields.find(cf => cf.code === 'EMAIL').values[0].value
		data.msg = await bot.sendMessage( data.user.chat_id,
			`Выбран основной контакт сделки <a href='${amoBaseUrl}/contacts/detail/${post.contact.id}'>${post.contact.name}</a>`, {
			parse_mode: 'HTML',
			disable_web_page_preview: true
		})
	}

	handlePostReceipt(clearCache(data))
}

const askForEmailToReply = async data => {
	if (process.env.debug) debugLog(functionName(), data)
	const { msg: { text }, state, actions, post } = data
	const lastEmails = []
	const messages = {}

	const connection = await ImapSimple.connect({ imap: ceoImapConfig })
	for (let box of ['INBOX', 'Archive', 'Отправленные']) {
		await connection.openBox(box)
		const emails = await connection.search(
			[
				box === 'INBOX' ? ['FROM', post.email_address_to_answer] :
				box === 'Archive' ? ['OR', ['FROM', post.email_address_to_answer], ['TO', post.email_address_to_answer]] :
				box === 'Отправленные' ? ['TO', post.email_address_to_answer] : [],
				['HEADER', 'SUBJECT', post.project.name.slice(-8)] //Re: Изготовление отбойника. # 
			],
			{ bodies: ['HEADER'] }
		)
		messages[box] = emails
		emails.length && lastEmails.push(emails.pop())
	}
	connection.end()
	
	post.email_to_reply = lastEmails.sort((a, b) => a.attributes.date < b.attributes.date ? 1 : -1)[0]

	if (!post.email_to_reply) {
		data.msg = await bot.sendMessage( data.user.chat_id,
			`Не найдено ни одного email'a в переписке с ${post.email_address_to_answer},
			содержащего в id сделки (${post.project.name.slice(-8)}) в теме`,
		)
		return endJob(data)
	}

	handlePostReceipt(clearCache(data))
}

const sendPostReply = async data => {
	if (process.env.debug) debugLog(functionName(), data)
	const { msg: { text }, state, actions, post } = data

	if (state !== 'send-post-reply') {
		data.msg = await bot.sendMessage( data.user.chat_id,
			despace`Последнее письмо в переписке по сделке:
				От: ${post.email_to_reply.parts[0].body.from[0]}
				Кому: ${post.email_to_reply.parts[0].body.to[0]}
				Тема: ${post.email_to_reply.parts[0].body.subject[0]}
				Дата: ${post.email_to_reply.attributes.date}
			`,
			{
				reply_markup: {
					inline_keyboard: [
						[{
							text: 'Отправить оповещение',
							callback_data: `send-post-reply`
						}]
					]
				}
			}
		)
		data.state = 'send-post-reply'
		return setStore(data)
	}

	// DEBUG
	post.email_address_to_answer = EMAIL_USERS[EMAIL_USERS.length - 1]

	const info = await serverSmtpTransporter.sendMail({
		from: `"Сервер ХОНИНГОВАНИЕ.РУ" <${EMAIL_USERS[2]}>`,
		to: post.email_address_to_answer,
		cc: EMAIL_USERS[1],
		subject: post.email_to_reply.parts[0].body.subject[0],
		inReplyTo: post.email_to_reply.parts[0].body['message-id'][0],
		html: `
			<p style="color:rgb( 46 , 54 , 64 );">Добрый день!</p>
			<p>Корреспонденция отправлена почтой https://www.pochta.ru/tracking#${post.rpo}</p>
			<p style="color:rgb( 46 , 54 , 64 );font-size:13px;">--------------------------------------</p>
			<p style="color:rgb( 46 , 54 , 64 );font-size:13px;">Это письмо отправлено автоматически, отвечать на него не нужно.</p>
		`,
	})

	post.sent_reply = info || true
	const msg_text = post.sent_reply?.accepted.includes(post.email_address_to_answer)
		? `Письмо отправлено`
		: `Что-то пошло не так. Письмо не отправлено`
	data.msg = await bot.sendMessage( data.user.chat_id, msg_text	)

	handlePostReceipt(clearCache(data))
}

export {
	handlePostReceipt,
	askForRPO,
	askForDeal,
	askForPostProject,
	askForPostTask,
	askForEmailToReply,
	sendPostReply
}