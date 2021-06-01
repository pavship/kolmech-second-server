import { db } from '../src/postgres.js'
import bot from '../bot.js'
import { endJob, getUser, setStore } from './../src/user.js'
import dedent from 'dedent-js'
import { getTask, megaplan_v3 } from '../src/megaplan.js'
import { outputJson, functionName } from './../src/utils.js'
import { findAmoContacts } from './../src/amo.js'

export async function transferAccounting0(data) {
	const { org } = data

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
					org && [{
						text: `🏢: ${org.ShortName} (ИНН: ${org.Inn})`,
						callback_data: `transfer-accounting-5:org`
					}],
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

export async function transferAccounting5(data) {
	const { msg: { text }, actions, org } = data

	// 4. TODO Validate answer

	if (actions?.[0] === 'org') {
		data.move.from_inn = org.Inn
	}
	else {
		data.move.from_amo_id = parseInt(text || actions[0])
		// 5. Find probable tasks
		const employee = await db.oneOrNone( `SELECT * FROM public.users WHERE amo_id = $1`, data.move.from_amo_id )
		if (employee) data.tasks = (await megaplan_v3( 'GET',
			`/api/v3/task?{ "fields": [ "name", "Category130CustomFieldPlanovieZatrati", "parent", "project" ], "sortBy": [ { "contentType": "SortField", "fieldName": "Category130CustomFieldPlanovieZatrati", "desc": true } ], "filter": { "contentType": "TaskFilter", "id": null, "config": { "contentType": "FilterConfig", "termGroup": { "contentType": "FilterTermGroup", "join": "and", "terms": [ { "contentType": "FilterTermRef", "field": "responsible", "comparison": "equals", "value": [ { "id": "${employee.employee_id}", "contentType": "Employee" } ] }, { "contentType": "FilterTermEnum", "field": "status", "comparison": "equals", "value": [ "filter_any" ] }, { "contentType": "FilterTermEnum", "field": "type", "comparison": "equals", "value": [ "task" ] }, { "contentType": "FilterTermEnum", "field": "status", "comparison": "not_equals", "value": [ "filter_completed" ] } ] } } }, "limit": 25 }`
		)).data
	}

	// 6. Ask for task_id
	data.msg = await bot.sendMessage( data.user.chat_id,
		`Выберите услугу/задачу или введите соотв. Megaplan TaskId`,
		{
			reply_markup: {
				inline_keyboard: [
					...(data.tasks ? data.tasks.map(t => [{
						text: `${t.humanNumber}. ${t.name}`,
						callback_data: `transfer-accounting-10:${t.id}`
					}]): []),
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

export async function transferAccounting10(data) {
	const { msg: { text }, actions } = data
	data.move.task_id = parseInt(text || actions[0])
	data.task = data.tasks?.find(t => t.id == data.move.task_id)
		|| await getTask(data.move.task_id)

	// 7. TODO Check answer

	// 8. Ask for amount paid
	data.msg = await bot.sendMessage( data.user.chat_id,
		`Укажите или выберите сумму, которую нужно списать на выбранную задачу/услугу`,
		{
			reply_markup: {
				inline_keyboard: [
				[{
					text: `Сумму плановых затрат: ${data.task.Category130CustomFieldPlanovieZatrati}`,
					callback_data: `transfer-accounting-15:${data.task.Category130CustomFieldPlanovieZatrati}`
				}],
				[{
					text: `Всю сумму платежа: ${data.move.amount}`,
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

export async function transferAccounting15(data) {
	const { msg: { text }, actions } = data
	data.move.paid = parseFloat(text) || parseFloat(actions[0])

	// 9. TODO Check answer

	// 10. Create move
	data.move = await createMove(data)

	// 11. Notify user
	await notifyUser(data)

	// 12. Finish
	endJob(data)
}

const createMove = async (data) => {
	let result

	result = await db.one(
		`INSERT INTO public.move(transfer_id, from_amo_id, from_inn, to_amo_id, to_inn, amount, paid, task_id)
		VALUES ($<transfer_id>, $<from_amo_id>, $<from_inn>, $<to_amo_id>, $<to_inn>, $<amount>, $<paid>, $<task_id>) RETURNING *`,
		data.move
	)
	// console.log(functionName(), ' result > ', result)
	return { ...result, was_created: true }
}

const notifyUser = async ({user, move}) => {
	const text = dedent`Платеж ${!move.was_created ? 'уже был ' : ''}зарегистрирован
								#️⃣ ${move.id}
								💵 ${move.paid} ₽`
	if (move.was_created) return bot.sendMessage( user.chat_id, text )
}