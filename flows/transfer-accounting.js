import { db } from '../src/postgres.js'
import bot from '../bot.js'
import { endJob, getUser, setStore } from './../src/user.js'
import { getTask, megaplan_v3 } from '../src/megaplan.js'
import { outputJson, functionName, despace } from './../src/utils.js'
import { amoBaseUrl, findAmoContacts, getAmoContact } from './../src/amo.js'
import { getOrg } from '../src/moedelo.js'

const transferAccounting0 = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const { org, actions, moves } = data
	const edit_move_id = parseInt(actions.shift())
	if (edit_move_id) return checkoutMove({ ...data, move: await db.one("SELECT * FROM public.move WHERE id = $1", edit_move_id) })

	// 1. Copy known props
	data.move = {
		transfer_id: data.transfer.id,
		from_amo_id: data.to_account.amo_id,
		from_inn: data.to_account.inn,
		to_amo_id: data.from_account.amo_id,
		to_inn: data.from_account.inn,
		amount: data.transfer.amount,
	}
	
	// 2. Find probable sellers
	const from_amo_ids = (await db.any(
		`SELECT from_amo_id FROM public.move
		WHERE transfer_id IN (
			SELECT id FROM public.transfer
			WHERE to_account_id = $1
		)`,
		data.to_account.id
	)).reduce((prev, { from_amo_id }) => `${prev},${from_amo_id}`, '')
	console.log('from_amo_ids > ', from_amo_ids)
	data.contacts = from_amo_ids.length
		? await findAmoContacts({ id: from_amo_ids })
		: []
	// 3. Ask for seller
	data.msg = await bot.sendMessage( data.user.chat_id,
		`Выберите продавца/исполнителя или введите AmoId последнего.`,
		{
			reply_markup: {
				inline_keyboard: [
					...data.contacts.map(c => [{
						text: c.name,
						callback_data: `transfer-accounting-5:${c.id}`
					}]),
					...!!org ? [[{
						text: `🏢: ${org.ShortName} (ИНН: ${org.Inn})`,
						callback_data: `transfer-accounting-5:org`
					}]] : [],
				[{
					text: 'Закончить 🔚',
					callback_data: `cancel`
				}]]
			}
		}
	)
	data.state = 'transfer-accounting-0'
	return setStore(data)
}

const transferAccounting5 = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const { msg: { text }, actions, org } = data

	// 4. TODO Validate answer

	if (actions?.[0] === 'org') {
		data.move.from_inn = org.Inn
	}
	else {
		data.move.from_amo_id = parseInt(text) || parseInt(actions.shift())
		// 5. Find probable tasks
		const employee = await db.oneOrNone( `SELECT * FROM public.users WHERE amo_id = $1`, data.move.from_amo_id )
		if (employee) data.tasks = (await megaplan_v3( 'GET',
			`/api/v3/task?{ "fields": [ "name", "Category130CustomFieldPlanovieZatrati", "parent", "project" ], "sortBy": [ { "contentType": "SortField", "fieldName": "Category130CustomFieldPlanovieZatrati", "desc": true } ], "filter": { "contentType": "TaskFilter", "id": null, "config": { "contentType": "FilterConfig", "termGroup": { "contentType": "FilterTermGroup", "join": "and", "terms": [ { "contentType": "FilterTermRef", "field": "responsible", "comparison": "equals", "value": [ { "id": "${employee.employee_id}", "contentType": "Employee" } ] }, { "contentType": "FilterTermEnum", "field": "status", "comparison": "equals", "value": [ "filter_any" ] }, { "contentType": "FilterTermEnum", "field": "type", "comparison": "equals", "value": [ "task" ] }, { "contentType": "FilterTermEnum", "field": "status", "comparison": "not_equals", "value": [ "filter_completed" ] } ] } } }, "limit": 25 }`
		)).data
	}
	if (await findRequiredCompensations(data))
		data.tasks = [ ...data.tasks, ...await Promise.all(data.required_compensations.map(async m => getTask(m.task_id))) ]
	
	// 6. Ask for task_id
	data.msg = await bot.sendMessage( data.user.chat_id,
		`Выберите услугу/задачу или введите соотв. Megaplan TaskId`,
		{
			reply_markup: {
				inline_keyboard: [
					...(data.tasks ? data.tasks.map(t => [{
						text: `${t.humanNumber}. ${t.name} ${data.required_compensations.find(m => m.task_id == t.id) ? '⤵️' : ''}`,
						callback_data: `transfer-accounting-10:${t.id}`
					}]): []),
					// data.required_compensations.map(r => [{
					// 	text: `${t.humanNumber}. ${t.name}`,
					// 	callback_data: `transfer-accounting-10:${t.id}`
					// }])
				[{
					text: 'Закончить 🔚',
					callback_data: `cancel`
				}]]
			}
		}
	)
	data.state = 'transfer-accounting-5'
	return setStore(data)
}

const findRequiredCompensations = async data => {
	const { move } = data
	data.required_compensations = await db.any(
		`SELECT * FROM move
		WHERE ((from_amo_id IS NOT NULL AND from_amo_id = $<from_amo_id>) OR (from_inn IS NOT NULL AND from_inn = $<from_inn>))
		AND compensation_for IS NOT NULL AND amount - paid <> 0`,
		move
	)
	return data.required_compensations.length
}

const transferAccounting10 = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const { msg: { text }, actions } = data
	data.move.task_id = parseInt(text) || parseInt(actions.shift())
	data.task = data.tasks?.find(t => t.id == data.move.task_id)
		|| await getTask(data.move.task_id)
	data.required_compensation = data.required_compensations.find(m => m.task_id == data.task.id)

	// 7. TODO Check answer
	
	// 8. Ask for amount paid
	data.msg = await bot.sendMessage( data.user.chat_id,
		`Укажите или выберите сумму, которую нужно списать на выбранную задачу/услугу`,
		{
			reply_markup: {
				inline_keyboard: [
				[{
					text: `Сумму плановых затрат: ${data.task.Category130CustomFieldPlanovieZatrati} ₽`,
					callback_data: `transfer-accounting-15:${data.task.Category130CustomFieldPlanovieZatrati}`
				}],
				...data.required_compensation ? [[{
					text: `Сумму компенсации: ${data.required_compensation.amount - data.required_compensation.paid} ₽/${data.required_compensation.amount} ₽`,
					callback_data: `transfer-accounting-15:${data.required_compensation.amount - data.required_compensation.paid}`
				}]] : [],
				[{
					text: `Всю сумму платежа: ${data.move.amount} ₽`,
					callback_data: `transfer-accounting-15:${data.move.amount}`
				}],
				[{
					text: 'Закончить 🔚',
					callback_data: `cancel`
				}]]
			}
		}
	)
	data.state = 'transfer-accounting-10'
	return setStore(data)
}

const transferAccounting15 = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const { msg: { text }, actions } = data
	data.move.paid = parseFloat(text) || parseFloat(actions.shift())

	// 9. TODO Check answer

	// 10. Create or update move
	data.move = data.required_compensation
		? await allocateCompensation(data)
		: await createMove(data)

	// 11. Notify user
	await checkoutMove(data)

	// 12. Finish
	endJob(data)
}

const allocateCompensation = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	let result

	result = await db.one(
		`UPDATE public.move SET paid = $1, transfer_id = $2 WHERE id = $3 RETURNING *`,
		[data.move.paid, data.move.transfer_id, data.required_compensation.id]
	)
	// console.log(functionName(), ' result > ', result)
	return { ...result, was_updated: true }
}

const createMove = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	let result

	result = await db.one(
		`INSERT INTO public.move(transfer_id, from_amo_id, from_inn, to_amo_id, to_inn, amount, paid, task_id)
		VALUES ($<transfer_id>, $<from_amo_id>, $<from_inn>, $<to_amo_id>, $<to_inn>, $<amount>, $<paid>, $<task_id>) RETURNING *`,
		data.move
	)
	// console.log(functionName(), ' result > ', result)
	return { ...result, was_created: true }
}

const checkoutMove = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const {user, move} = data
	data.from_amo = data.to_amo = data.from_org = data.to_org = data.compensation = undefined
	if (move.from_amo_id) data.from_amo = await getAmoContact(move.from_amo_id)
	if (move.to_amo_id) data.to_amo = await getAmoContact(move.to_amo_id)
	if (move.from_inn) data.from_org = await getOrg(move.from_inn)
	if (move.to_inn) data.to_org = await getOrg(move.to_inn)
	data.compensation = await db.oneOrNone("SELECT * FROM public.move WHERE compensation_for = $1", move.id)

	const text = despace`Начисление ${move.was_created ? 'зарегистрировано' : move.was_updated ? 'компенсировано' : 'уже было зарегистрировано'}
								#️⃣ ${move.id}
								💵 ${move.amount} ₽ начислено
								💵 ${move.paid} ₽ оплачено
								${!!data.from_amo ? `Поставщик: 👤 <a href='${amoBaseUrl}/contacts/detail/${data.from_amo.id}'>${data.from_amo.name}</a>` : ''}
								${!!data.from_org ? `Поставщик: 🏢 <a href='https://www.list-org.com/search?type=inn&val=${data.from_org.Inn}'>${data.from_org.ShortName}</a>` : ''}
								${!!data.to_amo ? `Покупатель: 👤 <a href='${amoBaseUrl}/contacts/detail/${data.to_amo.id}'>${data.to_amo.name}</a>` : ''}
								${!!data.to_org ? `Покупатель: 🏢 <a href='https://www.list-org.com/search?type=inn&val=${data.to_org.Inn}'>${data.to_org.ShortName}</a>` : ''}
								${!!move.compensation_for ? `Начисление является компенсацией за move_id = ${move.compensation_for}` : ''}`
	// 3. Ask for compensation
	data.msg = await bot.sendMessage( user.chat_id, text,
		{
			reply_markup: {
				inline_keyboard: [
				...data.compensation
					? [[{
						text: 'Назначенная компенсация ШПС ⤵️',
						callback_data: `transfer-accounting-0:${data.compensation.id}`
					}]]
					: data.to_org?.Inn !== '502238521208'
					? [[{
						text: 'Запросить компенсацию у ШПС ⤵️',
						callback_data: `require-compensation`
					}]] : [],
				[{
					text: 'Закончить 🔚',
					callback_data: `cancel`
				}]
			]},
			parse_mode: 'HTML'
		}
	)
	data.state = 'transfer-accounting-0'
	return setStore(data)
}

const requireCompensaton = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	let result

	result = await db.one(
		`INSERT INTO public.move(transfer_id, from_amo_id, from_inn, to_amo_id, to_inn, amount, paid, task_id, compensation_for)
		VALUES (null, $<to_amo_id>, $<to_inn>, null, 502238521208, $<amount>, 0, $<task_id>, $<id>) RETURNING *`,
		data.move
	)

	checkoutMove({ ...data, move: { ...result, was_created: true }})
}

export {
	transferAccounting0,
	transferAccounting5,
	transferAccounting10,
	transferAccounting15,
	checkoutMove,
	requireCompensaton,
}