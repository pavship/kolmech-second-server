import { db } from '../src/postgres.js'
import bot from '../bot.js'
import { endJob, setStore } from './../src/user.js'
import { getTask, getProj, megaplan_v3, setTaskBudget, getTasksToPay } from '../src/megaplan.js'
import { outputJson, functionName, despace } from './../src/utils.js'
import { amoBaseUrl, findAmoContacts, getAmoContact } from './../src/amo.js'
import { getOrg } from '../src/moedelo.js'
// outputJson(data) ; return endJob(data)

const transferAccounting0 = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const { to_org, actions } = data
	const edit_move_id = parseInt(actions.shift())
	if (edit_move_id) return checkoutMove({ ...data, move: await db.one("SELECT * FROM public.move WHERE id = $1", edit_move_id) })

	// 1. Copy known props
	data.move = {
		transfer_id: data.transfer.id,
		from_amo_id: data.to_account.amo_id,
		from_inn: data.to_account.inn,
		to_amo_id: data.from_account.amo_id,
		to_inn: data.from_account.inn,
		task_id: null,
		proj_id: null,
	}
	
	// 2. Find probable sellers
	const from_amo_ids = (await db.any(
		`SELECT DISTINCT from_amo_id FROM public.move
		WHERE from_amo_id IS NOT NULL 
		AND transfer_id IN ( SELECT id FROM public.transfer WHERE to_account_id = $1 )`,
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
					...!!to_org ? [[{
						text: `🏢: ${to_org.ShortName} (ИНН: ${to_org.Inn})`,
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
	const { msg: { text }, actions, to_org } = data

	// 4. TODO Validate answer

	if (actions?.[0] === 'org') {
		data.move.from_inn = to_org.Inn
	}
	else {
		data.move.from_amo_id = parseInt(text) || parseInt(actions.shift())
		// 5. Find probable tasks
		const employee_user = await db.oneOrNone( `SELECT * FROM public.users WHERE amo_id = $1`, data.move.from_amo_id )
		data.tasks = employee_user ? await getTasksToPay(employee_user.employee_id) : []
	}
	if (await findRequiredCompensations(data)) {
		data.tasks = [ ...data.tasks || [], ...await Promise.all(data.required_compensations.filter(m => m.task_id).map(async m => getTask(m.task_id))) ]
		data.projs = await Promise.all(data.required_compensations.filter(m => m.proj_id).map(async m => getProj(m.proj_id)))
	}
	
	// 6. Ask for task_id
	data.msg = await bot.sendMessage( data.user.chat_id,
		`Выберите услугу/задачу или введите соотв. Megaplan TaskId`,
		{
			reply_markup: {
				inline_keyboard: [
					...(data.tasks ? data.tasks.map(t => [{
						text: `${t.status === 'assigned' ? '🟢' : t.status === 'completed' ? '⚪️' : t.status === 'done' ? '🔵' : t.status === 'accepted' ? '⚫️' : 'Неожиданный статус!'} ${t.humanNumber}. ${t.name} - ${t.Category130CustomFieldPlanovieZatrati} ₽ ${(t.compensation = data.required_compensations.find(m => m.task_id == t.id)) ? `⤵️ (move_id ${t.compensation.id})` : ''}`,
						callback_data: `select-entity:task:${t.id}`
					}]): []),
					...(data.projs ? data.projs.map(p => [{
						text: `${p.humanNumber}. ${p.name} ${data.required_compensations.find(m => m.proj_id == p.id) ? '⤵️' : ''}`,
						callback_data: `select-entity:proj:${p.id}`
					}]): []),
				[{
					text: 'Закончить 🔚',
					callback_data: `cancel`
				}]]
			}
		}
	)
	data.state = 'select-entity'
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

const selectEntity = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const { msg: { text }, actions, move, user } = data

	const text_input_id = parseInt(text)
	if (text_input_id) {
		const task = await getTask(text_input_id)
		const proj = await getProj(text_input_id)
		console.log('task, proj > ', task, proj)
		if (task && !proj) return askForAmount({ ...data, task })
		if (proj && !task) return askForAmount({ ...data, proj })
		data.msg = await bot.sendMessage( user.chat_id,
			`Уазанному id соответствуют задача и проект. Уточните выбор`,
			{
				reply_markup: {
					inline_keyboard: [
					...task ? [[{
						text: `Task: ${task.humanNumber}. ${task.name}`,
						callback_data: `select-entity:task:${task.id}`
					}]] : [],
					...proj ? [[{
						text: `Project: ${proj.humanNumber}. ${proj.name}`,
						callback_data: `select-entity:proj:${proj.id}`
					}]] : [],
					[{
						text: 'Закончить 🔚',
						callback_data: `cancel`
					}]]
				}
			}
		)
		data.state = 'select-entity'
		return setStore(data)
	}

	const entity_type = actions.shift()
	const id = parseInt(actions.shift())
	if (entity_type === 'task') data.task = data.tasks?.find(t => t.id == id)	|| await getTask(id)
	if (entity_type === 'proj') data.proj = await getProj(id)

	askForAmount(data)
}

const askForAmount = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const { transfer, task } = data
	// const { msg: { text }, actions, move, transfer, task, proj } = data
	// move.task_id = parseInt(text) || parseInt(actions.shift())
	// data.task = data.tasks?.find(t => t.id == move.task_id)
	// 	|| await getTask(move.task_id)
	data.required_compensation = data.required_compensations.find(m => m.task_id == task?.id)

	// 7. TODO Check answer
	
	// 8. Ask for amount paid
	data.msg = await bot.sendMessage( data.user.chat_id,
		`Укажите или выберите сумму, которую нужно списать на выбранную задачу/услугу`,
		{
			reply_markup: {
				inline_keyboard: [
				...task ? [[{
					text: `Сумму плановых затрат: ${task.Category130CustomFieldPlanovieZatrati} ₽`,
					callback_data: `transfer-accounting-15:${task.Category130CustomFieldPlanovieZatrati}`
				}]] : [],
				...data.required_compensation ? [[{
					text: `Сумму компенсации: ${data.required_compensation.amount - data.required_compensation.paid} ₽/${data.required_compensation.amount} ₽`,
					callback_data: `transfer-accounting-15:${data.required_compensation.amount - data.required_compensation.paid}`
				}]] : [],
				[{
					text: `Всю сумму платежа: ${transfer.amount} ₽`,
					callback_data: `transfer-accounting-15:${transfer.amount}`
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
	const { msg: { text }, actions, move, task, proj } = data
	move.amount = move.paid = parseFloat(text) || parseFloat(actions.shift())
	if (task) move.task_id = task.id
	if (proj) move.proj_id = proj.id

	// 9. TODO Check answer

	// 10. Create or update move
	data.move = data.required_compensation
		? await allocateCompensation(data)
		: await createMove(data)

	// 11. Notify user
	checkoutMove(data)
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
	const { move, task } = data
	let result
	outputJson(data)

	result = await db.one(
		`INSERT INTO public.move(transfer_id, from_amo_id, from_inn, to_amo_id, to_inn, amount, paid, task_id, proj_id)
		VALUES ($<transfer_id>, $<from_amo_id>, $<from_inn>, $<to_amo_id>, $<to_inn>, $<amount>, $<paid>, $<task_id>, $<proj_id>) RETURNING *`,
		move
	)

	if (task) await setTaskBudget(task.id, task.Category130CustomFieldPlanovieZatrati - move.paid)

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
						text: 'Назначенная компенсация ⤵️',
						callback_data: `transfer-accounting-0:${data.compensation.id}`
					}]]
					// : data.to_org?.Inn !== '502238521208'
					// ? [[{
					// 	text: 'Запросить компенсацию у ИП ШПС ⤵️',
					// 	callback_data: `require-compensation:inn:502238521208`
					// }]]
					// : data.to_amo?.id !== 22575633
					// ? [[{
					// 	text: 'Запросить компенсацию у ШПС ⤵️',
					// 	callback_data: `require-compensation:amo_id:22575633`
					// }]] : [],
					: [[{
						text: 'Запросить компенсацию ⤵️',
						callback_data: `require-compensation`
					}]],
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
	const { msg: { text }, actions, state, move } = data
	let result

	if (state !== 'require-compensation') {
		data.msg = await bot.sendMessage( data.user.chat_id,
			`Введите ИНН или AmoId контрагента, с которого требуется компенсация`,
			{
				reply_markup: {
					inline_keyboard: [
						[{
							text: 'ИП ШПС',
							callback_data: `require-compensation:inn:502238521208`
						}],
						[{
							text: 'ШПС (ФЛ)',
							callback_data: `require-compensation:amo_id:22575633`
						}],
						[{
							text: 'Закончить 🔚',
							callback_data: `cancel`
						}],
					]
				}
			}
		)
		data.state = 'require-compensation'
		return setStore(data)
	}

	const counterparty_type =	actions?.length
		? actions[0]
		:	text.length === 8 ? 'amo_id' : 'inn'
	const counterparty_id = actions?.length ? actions[1] : text
	move.from_inn = move.to_inn
	move.from_amo_id = move.to_amo_id
	move.to_inn = counterparty_type === 'inn' ? counterparty_id : null
	move.to_amo_id = counterparty_type === 'amo_id' ? counterparty_id : null

	result = await db.one(
		`INSERT INTO public.move(transfer_id, from_amo_id, from_inn, to_amo_id, to_inn, amount, paid, task_id, proj_id, compensation_for)
		VALUES (null, $<from_amo_id>, $<from_inn>, $<to_amo_id>, $<to_inn>, $<amount>, 0, $<task_id>, $<proj_id>, $<id>) RETURNING *`,
		move
	)

	;['actions', 'state', 'result_field'].forEach(k => delete data[k])
	checkoutMove({ ...data, move: { ...result, was_created: true }})
}

export {
	transferAccounting0,
	transferAccounting5,
	selectEntity,
	transferAccounting15,
	checkoutMove,
	requireCompensaton,
}