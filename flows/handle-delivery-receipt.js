import axios from 'axios'
import { stringify } from 'qs'
import FormData from 'form-data'
import ImapSimple from 'imap-simple'
import { db } from '../src/postgres.js'
import bot from '../bot.js'
import { clearCache, endJob, setStore } from '../src/user.js'
import { outputJson, functionName, debugLog, despace } from '../src/utils.js'
import { getOrg } from '../src/moedelo.js'
import { amoBaseUrl, findAmoCompany, findAmoContacts, getAmoContact } from '../src/amo.js'
import { createTask, createTaskComment, doTaskAction, getProj, getProjTasks, megaplan_v3 } from '../src/megaplan.js'
import { constructMoveMessageText } from './transfer-accounting.js'
import { ceoImapConfig, serverSmtpTransporter } from '../src/mail.js'
import { getNrgSendings } from '../src/nrg-tk.js'

const handleDeliveryReceipt = async data => {
	if (process.env.debug) debugLog(functionName())
	const { delivery, from_org, move } = data

	if (!delivery) return prepareData(data)

	if (delivery.supplier === 'nrg-tk') {

		if (!delivery.sendings) return getDeliverySendings(data)

		for (const sending of delivery.sendings) {

			if (!sending.sender && !sending.project) return askForDeliverySender(data)
			
			if (!sending.project && delivery.project) 
			['task', 'project'].forEach(k => { sending[k] = delivery[k]; delete delivery[k] })
			
			if (sending.sender && !sending.project) return askForDeliverySenderProject(data)
			
			if (!sending.move) return createMove(data)

			if (!sending.comment) return commentOnDelivery(data)

			delete data.move
			
			outputJson(data)
		
			return
		}

	}


	if (!delivery.task) return askForDeliveryProject(data)

	if (!move) return createMove(data)

	if (!delivery.comment) return commentOnDelivery(data)
	
	endJob(data)

	return
	
	// if (from_org.inn === '502210907346') 

	if (!delivery.track_number) return askForRPO(data)


	// if (!delivery.tracking) return getRPOInfo(data)

	// if (!delivery.company) return askForRecipient(data)
	
	// if (!delivery.deal) return askForDeal(data)

	// 

	// if (!delivery.task) return askForPostTask(data)
	
	
	// if (!delivery.contact) return askForContact(data)
	
	// if (!delivery.email_to_reply) return askForEmailToReply(data)

	// if (!delivery.sent_reply) return sendPostReply(data)

	endJob(data)
}

const prepareData = async data => {
	if (process.env.debug) debugLog(functionName(), data)

	data.delivery = {
		dataIsPrepared: true,
		supplier:
			data.to_org.Inn === '7724315304' ? 'nrg-tk' :
			data.to_org.Inn === '502210907346' ? 'cdek' : null
	}
	handleDeliveryReceipt({ ...data, from_org: data.to_org, to_org: data.from_org })
}

const getDeliverySendings = async data => {
	if (process.env.debug) debugLog(functionName(), data)
	const { msg: { text }, state, actions, transfer, delivery } = data

	//get sendings for period of 1 month before the transfer date
	delivery.sendings = (await getNrgSendings({
		beginDate: new Date((transfer.datetime + 3*3600 - 31*24*3600)*1000).toISOString().slice(0,10).split('-').reverse().join('.'),
		endDate: new Date((transfer.datetime + 3*3600)*1000).toISOString().slice(0,10).split('-').reverse().join('.')
	})).map(s => ({
		supplier_item: s,
		receipt_item: transfer.receipt.ticket.document.receipt.items.find(i => i.sum/100 === s.priceFreight)
	})).filter(s => s.receipt_item)

	handleDeliveryReceipt(clearCache(data))
}

const askForDeliverySender = async data => {
	if (process.env.debug) debugLog(functionName(), data)
	const { msg: { text }, state, actions, transfer, delivery } = data
	
	if (state !== 'askForDeliverySender') {
		const sending = delivery.sendings.find(s => !Object.keys(s).includes('sender'))
		data._sender = (await findAmoContacts({ query: sending.supplier_item.clientFromFullTitle }))[0]
		if (data._sender) {
			sending.sender = data._sender
			data.msg = await bot.sendMessage( data.user.chat_id,
				`Выбран контакт 👤 <a href='${amoBaseUrl}/contacts/detail/${sending.sender.id}'>${sending.sender.name}</a>`, {
				parse_mode: 'HTML'
			})
			return handleDeliveryReceipt(clearCache(data))
		}
		else {
			data.msg = await bot.sendMessage( data.user.chat_id,
				`Не удалось найти контакт AmoCRM для отправителя ${sending.supplier_item.clientFromFullTitle}`)
			return askForDeliveryProject(clearCache(data))
		}
	}

	// data._contact = getAmoContact(text)
	// if (data._contact) sending.sender = data._contact
	// else {
	// 	data._project = getProj(text)
	// 	if (data._project) sending.project = data._project
	// }

	// handleDeliveryReceipt(clearCache(data))
}

const askForDeliverySenderProject = async data => {
	if (process.env.debug) debugLog(functionName(), data)
	const { msg: { text }, state, actions, delivery } = data
	
	if (state !== 'askForDeliverySenderProject') {
		data._sending = delivery.sendings.find(s => s.sender && !s.project)
		data._sender_projects_ids = (await db.any(
			`SELECT DISTINCT proj_id FROM public.move
			WHERE from_amo_id = $1`,
			data._sending.sender.id
		)).reduce((res, { proj_id }) => [ ...res, proj_id ], [])
		data._sender_projects = await Promise.all(data._sender_projects_ids.map(id => getProj(id)))
		data.msg = await bot.sendMessage( data.user.chat_id,
			`Выберите проект или введите соотв. Megaplan ProjectId`,
			{
				reply_markup: {
					inline_keyboard: [
						...data._sender_projects.map(p => [{
							text: `${p.status === 'assigned' ? '🟢' : p.status === 'completed' ? '⚪️' : p.status === 'done' ? '🔵' : p.status === 'accepted' ? '⚫️' : 'Неожиданный статус!'} ${p.humanNumber}. ${p.name}`,
							callback_data: `askForDeliverySenderProject:${p.id}`
						}]),
					]
				}
			}
		)
		data.state = 'askForDeliverySenderProject'
		return setStore(data)
	}

	const project_id = actions ? actions[0] : text
	delivery.task = (await getProjTasks(project_id))?.find(t => t.name === 'Доставка')
		|| await createTask({
				name: 'Доставка',
				parent: { contentType: 'Project', id: project_id},
				actualStart: {contentType: 'DateTime', value: new Date((data._sending.supplier_item.sendDate)*1000).toISOString() },
				plannedFinish: {contentType: 'DateTime', value: new Date((data._sending.supplier_item.states.find(s => s.title === 'Выдана').movingDate)*1000).toISOString() },
			})
	delivery.project = delivery.task.project

	if (delivery.task.status === 'assigned')
			await doTaskAction(delivery.task.id, {action: 'act_accept_work', checkTodos: true})

	handleDeliveryReceipt(clearCache(data))
}

const askForDeliveryProject = async data => {
	if (process.env.debug) debugLog(functionName(), data)
	const { msg: { text }, state, actions, delivery } = data
	const sending = delivery.sendings?.find(s => !s.sender && !s.project)

	if (state !== 'askForDeliveryProject') {
		data._deliveryTasks = (await megaplan_v3( 'GET', `/api/v3/task?{"fields":["name","finishedTodosCount","actualTodosCount","activity","deadline","responsible","owner","unreadCommentsCount","isFavorite","status","project"],"sortBy":[{"contentType":"SortField","fieldName":"activity","desc":true}],"filter":{"contentType":"TaskFilter","id":null,"config":{"contentType":"FilterConfig","termGroup":{"contentType":"FilterTermGroup","join":"and","terms":[{"contentType":"FilterTermEnum","field":"status","comparison":"equals","value":["filter_actual"]},{"contentType":"FilterTermString","field":"name","comparison":"equals","value":"%D0%94%D0%BE%D1%81%D1%82%D0%B0%D0%B2%D0%BA%D0%B0"}]}}},"limit":50}` )).data
		data.msg = await bot.sendMessage( data.user.chat_id,
			`Выберите проект или введите соотв. Megaplan ProjectId`, {
			reply_markup: { inline_keyboard: [
				...data._deliveryTasks.map(t => [{
					text: `${t.project.status === 'assigned' ? '🟢' : t.project.status === 'completed' ? '⚪️' : t.project.status === 'done' ? '🔵' : t.project.status === 'accepted' ? '⚫️' : 'Неожиданный статус!'} ${t.project.humanNumber}. ${t.project.name}`,
					callback_data: `askForDeliveryProject:${t.project.id}`
				}]),
			]}
		})
		data.state = 'askForDeliveryProject'
		return setStore(data)
	}

	delivery.task = actions
		? data._deliveryTasks.find(t => t.project.id === actions[0])
		: (await getProjTasks(text))?.find(t => t.name === 'Доставка')
			|| await createTask({ name: 'Доставка', parent: {id: text, contentType: 'Project'} })
	delivery.project = delivery.task.project

	if (delivery.task.status === 'assigned')
			await doTaskAction(delivery.task.id, {action: 'act_accept_work', checkTodos: true})

	handleDeliveryReceipt(clearCache(data))
}

const createMove = async data => {
	if (process.env.debug) debugLog(functionName(), data)
	const { msg: { text }, state, actions, transfer, to_account, from_account, delivery } = data
	const sending = delivery.sendings?.find(s => s.task && !s.move)

	data._move = {
		transfer_id: transfer.id,
		amount: sending ? sending.receipt_item.sum/100 : transfer.amount,
		paid: sending ? sending.receipt_item.sum/100 : transfer.amount,
		from_amo_id: to_account.amo_id,
		from_inn: to_account.inn,
		to_amo_id: from_account.amo_id,
		to_inn: from_account.inn,
		task_id: sending ? sending.task.id : delivery.task.id,
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

	if (sending) {
		sending.move = data.move
		// delete data.move
	}

	data.msg = await bot.sendMessage( data.user.chat_id,
		constructMoveMessageText(data), {
		parse_mode: 'HTML'
	})

	handleDeliveryReceipt(clearCache(data))
}

const commentOnDelivery = async data => {
	if (process.env.debug) debugLog(functionName(), data)
	const { state, user, transfer, move, from_org, delivery } = data
	const sending = delivery.sendings?.find(s => s.move && !s.comment)

	if (!data._company) {
		data._company = await findAmoCompany(from_org.Inn)
		if (!data._company) {
			data.msg = await bot.sendMessage( user.chat_id,
				`Заполните ИНН ${from_org.Inn} поставщика ${from_org.ShortName} в AmoCRM`,
				{
					reply_markup: { inline_keyboard: [
						[{
							text: `Готово`,
							callback_data: `commentOnDelivery:skip`
						}],
					]},
					parse_mode: 'HTML'
				}
			)
			data.state = 'commentOnDelivery'
			return setStore(data)
		}
	}

	delivery.comment = await createTaskComment({
		task: sending?.task || delivery.task,
		content: despace`
			<p>🗓 ${new Date((transfer.datetime + 3*3600)*1000).toISOString().replace(/T|\.000Z/g, ' ')}
			💵 ${move.paid} ₽
			${!!data.from_org ? `🛒🏢 <a href='${amoBaseUrl}/companies/detail/${data._company.id}'>${data.from_org.ShortName}</a>` : ''}
			</p>
		`
	})

	if (sending) {
		sending.comment = delivery.comment
		delete delivery.comment
	}

	handleDeliveryReceipt(clearCache(data))
}

export {
	handleDeliveryReceipt,
	askForDeliverySenderProject,
	askForDeliveryProject,
	commentOnDelivery
}