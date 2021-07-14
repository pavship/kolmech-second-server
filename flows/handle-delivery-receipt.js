import axios from 'axios'
import { stringify } from 'qs'
import FormData from 'form-data'
import ImapSimple from 'imap-simple'
import { db } from '../src/postgres.js'
import bot from '../bot.js'
import { clearCache, endJob, setStore } from '../src/user.js'
import { outputJson, functionName, debugLog, despace } from '../src/utils.js'
import { getOrg } from '../src/moedelo.js'
import { amoBaseUrl, findAmoCompany, findAmoDeals, getAmoContact, getAmoStatuses, getDealNotes } from '../src/amo.js'
import { createTask, createTaskComment, doTaskAction, getProj, getProjTasks, megaplan_v3 } from '../src/megaplan.js'
import { constructMoveMessageText } from './transfer-accounting.js'
import { ceoImapConfig, serverSmtpTransporter } from '../src/mail.js'

const handleDeliveryReceipt = async data => {
	if (process.env.debug) debugLog(functionName())
	const { delivery, from_org, move } = data

	if (!delivery) return prepareData(data)

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

	data.delivery = { dataIsPrepared: true }
	handleDeliveryReceipt({ ...data, from_org: data.to_org, to_org: data.from_org })
}

const askForDeliveryProject = async data => {
	if (process.env.debug) debugLog(functionName(), data)
	const { msg: { text }, state, actions, delivery } = data

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

	data._move = {
		transfer_id: transfer.id,
		amount: transfer.amount,
		paid: transfer.amount,
		from_amo_id: to_account.amo_id,
		from_inn: to_account.inn,
		to_amo_id: from_account.amo_id,
		to_inn: from_account.inn,
		task_id: delivery.task.id,
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

	handleDeliveryReceipt(clearCache(data))
}

const commentOnDelivery = async data => {
	if (process.env.debug) debugLog(functionName(), data)
	const { state, user, transfer, move, from_org, delivery } = data

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
		task: delivery.task,
		content: despace`
			<p>🗓 ${new Date((transfer.datetime + 3*3600)*1000).toISOString().replace(/T|\.000Z/g, ' ')}
			💵 ${move.paid} ₽
			${!!data.from_org ? `🛒🏢 <a href='${amoBaseUrl}/companies/detail/${data._company.id}'>${data.from_org.ShortName}</a>` : ''}
			</p>
		`
	})

	handleDeliveryReceipt(clearCache(data))
}

export {
	handleDeliveryReceipt,
	askForDeliveryProject,
	commentOnDelivery
}