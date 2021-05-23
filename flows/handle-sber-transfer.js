import { pgQuery } from '../src/postgres.js'
import getAmoContact from '../flows/get-amo-contact.js'
import functionName from '../src/function-name.js'
import bot from '../bot.js'
import { getUser, setStore } from './../src/user.js'
import dedent from 'dedent-js'

export default async function handleSberTransfer(data) {
	// 1. Parse text
	data.input = parseText(data.text)
	
	// 2. Get payer account
	data.from_account = await getPayerAccount(data)

	// 3. Get payee account
	data.to_account = await getPayeeAccount(data)

	// 4. Create transfer
	data.transfer = await createTransfer(data)

	// 5. Notify user
	notifyUser(data)
}

const parseText = (text) => {
	const result = {
		from_account_bank_name: 'Сбер'
	}
	const regex = /(?<date>[0-9]{2}.[0-9]{2}.[0-9]{4})|(?<time>[0-9]{2}:[0-9]{2}:[0-9]{2})|(?<=ОТПРАВИТЕЛЬ:.+)(?<from_account_number>[0-9]{4})$|(?<=ПОЛУЧАТЕЛЬ:.+)(?<to_account_number>[0-9]{4})$|(?<=НОМЕР ТЕЛЕФОНА ПОЛУЧАТЕЛЯ: )(?<phone>.+)|(?<=СУММА ОПЕРАЦИИ: )(?<amount>.+) РУБ.|(?<=КОМИССИЯ: )(?<bank_fee>.+) РУБ.|(?<=ФИО: )(?<holder>.+)/gm;
	for (const match of text.matchAll(regex)) {
		for (const key in match.groups) {
			if (!!match.groups[key]) result[key] = match.groups[key]
		}
	}
	result.datetime = Date.parse(result.date.split('.').reverse().join('-') + 'T' + result.time + 'Z')/1000 - 3*3600 //Moscow time to Epoch
	// console.log(functionName(), ' result > ', result)
	// result >  {
	// 	from_account_bank_name: 'Сбер',
	// 	date: '05.05.2021',
	// 	time: '14:06:31',
	// 	from_account_number: '1234',
	// 	to_account_number: '1234',
	// 	amount: '8805.00',
	// 	bank_fee: '0.00',
	// 	holder: 'ИВАН ИВАНОВИЧ И.',
	// 	datetime: 1620212791
	// }
	return result
}

const getPayerAccount = async ({ input }) => {
	const res = await pgQuery(
		"SELECT * FROM public.account WHERE bank_name = $1 AND number LIKE '%'||$2 and type = 'card'",
		[input.from_account_bank_name, input.from_account_number]
	)
	const result = res.rows[0]
	// console.log(functionName(), ' result > ', result)
	// result >  {
	// 	id: 1,
	// 	type: 'card',
	// 	amo_id: null,
	// 	bank_name: 'Сбер',
	// 	bank_bik: null,
	// 	number: '1234567890123456',
	// 	holder: null,
	// 	phone: null,
	// 	inn: '123456789012'
	// }
	return result
}

const getPayeeAccount = async ({ input }) => {
	let result
	let res = await pgQuery(
		"SELECT * FROM public.account WHERE holder = $1 AND number LIKE '%'||$2 and type = 'card'",
		[input.holder, input.to_account_number]
	)
	result = res.rows[0]
	// console.log(functionName(), ' result > ', result)
	// result >  undefined
	// OR
	// result >  {
	// 	id: 11,
	// 	type: 'card',
	// 	amo_id: null,
	// 	bank_name: null,
	// 	bank_bik: null,
	// 	number: '9702',
	// 	holder: 'ИВАН ИВАНОВИЧ И.',
	// 	phone: null,
	// 	inn: null
	// }
	if (result) return result

	res = await pgQuery(
		"INSERT INTO public.account(type, holder, number) VALUES('card', $1, $2) RETURNING *",
		[input.holder, input.to_account_number]
	)
	result = res.rows[0]
	// console.log(functionName(), ' result > ', result)
	return result
}

const createTransfer = async (data) => {
	let result

	let res = await pgQuery(
		"SELECT * FROM public.transfer WHERE from_account_id = $1 AND to_account_id = $2 and amount = $3 and datetime = $4",
		[data.from_account.id, data.to_account.id, data.input.amount, data.input.datetime]
	)
	result = res.rows[0]
	// console.log(functionName(), ' result > ', result)
	// result >  undefined
	// OR
	// result >  {
	// 	id: 2,
	// 	amount: '8805.00',
	// 	from_account_id: 1,
	// 	to_account_id: 11,
	// 	created_by: 1,
	// 	updated_by: null,
	// 	created_at: 2021-05-20T15:18:28.642Z,
	// 	updated_at: null,
	// 	datetime: 1620212791
	// }
	if (result) return { ...result, was_existent: true }

	res = await pgQuery(
		"INSERT INTO public.transfer(from_account_id, to_account_id, amount, datetime, created_by) VALUES($1, $2, $3, $4, $5) RETURNING *",
		[data.from_account.id, data.to_account.id, data.input.amount, data.input.datetime, data.user.id]
	)
	result = res.rows[0]
	// console.log(functionName(), ' result > ', result)
	return { ...result, was_created: true }
}

const notifyUser = async (data) => {
	const {user, transfer} = data
	let msg

	if (transfer.was_existent) {
		msg = await bot.sendMessage( user.chat_id,
			dedent`Платеж уже зарегистрирован transfer_id = ${transfer.id}`,
				// 		🗓 <b>${transfer['made_at']}</b>\n"\
				// f"💸 <b>{'{:.2f} ₽'.format(transfer['amount'])}</b>\n\n"\
				// f"📤 {transfer['from_account']['name']}\n"\
				// f"📥 {transfer['to_account']['name']}\n"`
			{
				reply_markup: {
					inline_keyboard: [[{
						text: 'Учесть 📊',
						callback_data: `transfer-accounting-0`
					}],[{
						text: 'Закончить 🔚',
						callback_data: `cancel`
					}]]
				}
			}
		)
	}

	if (transfer.was_created) {
		msg = await bot.sendMessage( user.chat_id,
			dedent`Платеж зарегистрирован transfer_id = ${transfer.id}`,
				// 		🗓 <b>${transfer['made_at']}</b>\n"\
				// f"💸 <b>{'{:.2f} ₽'.format(transfer['amount'])}</b>\n\n"\
				// f"📤 {transfer['from_account']['name']}\n"\
				// f"📥 {transfer['to_account']['name']}\n"`
			{
				reply_markup: {
					inline_keyboard: [[{
						text: 'Учесть 📊',
						callback_data: `transfer-accounting-0`
					}],[{
						text: 'Закончить 🔚',
						callback_data: `cancel`
					}]]
				}
			}
		)
	}
	
	data.msg = msg
	return setStore(data)
}