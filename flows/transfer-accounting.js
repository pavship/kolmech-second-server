import { pgQuery } from '../src/postgres.js'
import getAmoContact from '../flows/get-amo-contact.js'
import functionName from '../src/function-name.js'
import bot from '../bot.js'
import { getUser, setStore } from './../src/user.js'
import dedent from 'dedent-js'

export async function transferAccounting0(data) {
	// 1. Copy known props
	data.move = {
		transfer_id: data.transfer.id,
		datetime: data.transfer.datetime,
		from_amo_id: data.to_account.amo_id,
		from_inn: data.to_account.inn,
		to_amo_id: data.from_account.amo_id,
		to_inn: data.from_account.inn,
		amount: data.transfer.amount,
		amount_paid: data.transfer.amount_paid
	}
	
	// 2. Ask for seller
	data.msg = await bot.sendMessage( data.user.chat_id,
		`Введите AmoId продавца/исполнителя`
	)
	data.state = 'transfer-accounting-0'
	return setStore(data)
}

export async function transferAccounting5(data) {
	const { msg: { text } } = data
	data.move.from_amo_id = parseInt(text)
	
	// 3. TODO Check answer

	// 4. Ask for task_id
	data.msg = await bot.sendMessage( data.user.chat_id,
		`Введите Megaplan TaskId услуги`
	)
	data.state = 'transfer-accounting-5'
	return setStore(data)
}

export async function transferAccounting10(data) {
	const { msg: { text } } = data
	data.move.task_id = parseInt(text)

	// 5. TODO Check answer

	// 6. Create move
	data.move = await createMove(data)

	// 7. Notify user
	await notifyUser(data)

	// 8. Finish
	bot.sendMessage(data.user.chat_id, 'Работа завершена')
	clearStore(data.user.chat_id)
}

const createMove = async (data) => {
	const { transfer_id, datetime, from_amo_id, from_inn, to_amo_id, to_inn, amount, amount_paid, task_id } = data.move
	let result

	let res = await pgQuery(
		dedent`INSERT INTO public.move(transfer_id, datetime, from_amo_id, from_inn, to_amo_id, to_inn, amount, amount_paid, task_id)
					VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
		[transfer_id, datetime, from_amo_id, from_inn, to_amo_id, to_inn, amount, amount_paid, task_id]
	)
	result = res.rows[0]
	// console.log(functionName(), ' result > ', result)
	return { ...result, was_created: true }
}

const notifyUser = async ({user, move}) => {
	if (move.was_created) return bot.sendMessage( user.chat_id,
		dedent`Платеж зарегистрирован move_id = ${move.id}`,
			// 		🗓 <b>${transfer['made_at']}</b>\n"\
			// f"💸 <b>{'{:.2f} ₽'.format(transfer['amount'])}</b>\n\n"\
			// f"📤 {transfer['from_account']['name']}\n"\
			// f"📥 {transfer['to_account']['name']}\n"`
		// {
		// 	reply_markup: {
		// 		inline_keyboard: [[{
		// 			text: 'Учесть',
		// 			callback_data: `transfer-accounting:${transfer.id}`
		// 		}]]
		// 	}
		// }
	)
}