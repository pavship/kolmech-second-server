import { db } from '../src/postgres.js'
import bot from '../bot.js'
import { endJob, setStore } from '../src/user.js'
import { outputJson, functionName, despace } from '../src/utils.js'
import { amoBaseUrl, findAmoContacts, getAmoContact } from '../src/amo.js'
import { getOrg } from '../src/moedelo.js'
import { getProj, getTask } from '../src/megaplan.js'
import { getTochkaPayments } from '../src/tochka.js'
// outputJson(data); // return endJob(data)

const handleTransfer5 = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const { text, receipt } = data

	// 1. Parse text
	data.input = text && parseText(data)
	
	// 2. Check or parse receipt
	if (receipt) {
		if (await checkReceipt(data)) return checkoutTransfer(data)
		data.input = parseReceipt(receipt)
	}

	handleTransfer10(data)
}

const handleTransfer10 = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const { input, receipt, from_account, to_account, transfer } = data

	// 4. Get payer account
	if (!from_account) return getPayerAccount5(data)

	// 5. Get payee account
	if (!input && !receipt) return askForInn(data)
	if (!to_account) await getPayeeAccount(data)

	// 6. Check or ask for amount
	if (!input.amount) return askForAmount(data)

	// 7. Check or ask for date
	if (!input.datetime) return askForDate(data)

	// 7. Create transfer
	if (!transfer) return createTransfer(data)

	// 8. Notify user
	checkoutTransfer(data)
}

const parseText = data => {
	if (process.env.debug) console.log(functionName(), '>')
	const { text, msg } = data
	
	const bank = msg.document?.file_name.endsWith('.pdf') ? 'tinkoff' : 'sber'
	const result = {
		from_account_type: 'card',
		to_account_type: 'card',
		to_account_inn: null,
		to_account_bank_bik: null,
		...(bank === 'sber') && {
			from_account_bank_name: 'Сбер',
			from_account_holder: null,
			to_account_bank_name: null
		},
		...(bank === 'tinkoff') && {
			from_account_bank_name: 'Тинькофф',
			from_account_number: null
		},
	}
	const regex =
		(bank === 'sber') ? /(?<date>[0-9]{2}.[0-9]{2}.[0-9]{4})|(?<time>[0-9]{2}:[0-9]{2}:[0-9]{2})|(?<=.+MASTERCARD .+|ОТПРАВИТЕЛЬ:.+)(?<from_account_number>[0-9]{4})$|(?<=ПОЛУЧАТЕЛЬ:.+)(?<to_account_number>[0-9]{4})$|(?<=НОМЕР ТЕЛЕФОНА ПОЛУЧАТЕЛЯ: )(?<to_account_phone>.+)|(?<=СУММА ОПЕРАЦИИ: )(?<amount>.+) РУБ.|(?<=КОМИССИЯ: )(?<bank_fee>.+) РУБ.|(?<=ФИО: )(?<to_account_holder>.+)/gm :
		(bank === 'tinkoff') ? /(?<date>[0-9]{2}.[0-9]{2}.[0-9]{4})|(?<time>[0-9]{2}:[0-9]{2}:[0-9]{2})|(?<=ПереводКлиенту )(?<to_account_bank_name>.*)$|(?<=Получатель)(?<to_account_holder>.*)$|(?<=НОМЕР ТЕЛЕФОНА ПОЛУЧАТЕЛЯ: )(?<to_account_phone>.+)|(?<amount>.+)(?= iСумма)|(?<=КОМИССИЯ: )(?<bank_fee>.+) РУБ.|(?<=Отправитель)(?<from_account_holder>.+)|(?<=Карта получателя\*)(?<to_account_number>[0-9]{4}$)/gm
		: null
	for (const match of text.matchAll(regex)) {
		for (const key in match.groups) {
			if (!!match.groups[key]) result[key] = match.groups[key]
		}
	}
	result.datetime = Date.parse(result.date.split('.').reverse().join('-') + 'T' + result.time + 'Z')/1000 - 3*3600 //Moscow time to Epoch
	result.to_account_phone = result.to_account_phone?.replace(/[ |(|)|-]/g, '')
	result.amount = result.amount?.replace(/ /g, '')
	//#region schema
	// console.log(functionName(), ' result > ', result)
	// result >  {
	//	to_account_type: 'card',
	//	to_account_inn: null,
	// 	from_account_bank_name: 'Сбер',
	// 	from_account_holder: null,
	// 	date: '05.05.2021',
	// 	time: '14:06:31',
	// 	from_account_number: '1234',
	// 	to_account_number: '1234',
	// 	amount: '8805.00',
	// 	bank_fee: '0.00',
	// 	to_account_holder: 'ИВАН ИВАНОВИЧ И.',
	// 	datetime: 1620212791,
	// 	to_account_phone: undefined, // '+79261234567'
	// }
	// result >  {
	// 	"to_account_type": "card",
	// 	"to_account_inn": null,
	// 	"date": "17.05.2021",
	// 	"time": "07:35:04",
	// 	"to_account_bank_name": "Тинькофф",
	// 	"amount": "12 738",
	// 	"from_account_holder": "Павел Шипицын",
	// 	"to_account_number": "1038",
	// 	"to_account_holder": "Иван О.",
	// 	"datetime": 1621226104
	// }
	//#endregion
	return result
}

// check if this receipt is already in db
const checkReceipt = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const { receipt } = data
	const found = await db.oneOrNone(
		`SELECT * FROM public.transfer
		WHERE receipt ->> 'id' = $1`,
		receipt.id
	)
	if (found) data.transfer = { ...found, was_existent: true }
	return !!found
}

const parseReceipt = receipt => {
	return {
		to_account_inn: receipt.seller.inn,
		to_account_type: 'bank',
		to_account_bank_name: null,
		to_account_bank_bik: null,
		amount: receipt.query.sum/100,
		datetime: Date.parse(receipt.query.date + 'Z')/1000 - 3*3600, //Moscow time to Epoch
		to_account_holder: null,
		to_account_number: null,
		to_account_phone: null,
	}
}

const getPayerAccount5 = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const { input, receipt } = data
	
	if (input && !receipt) data.from_account = await db.oneOrNone(
		`SELECT * FROM public.account
		WHERE type = $<from_account_type>
		AND bank_name = $<from_account_bank_name>
		AND (number LIKE '%'||$<from_account_number> OR holder = $<from_account_holder>)`,
		input
	)
	//#region schema
	// console.log(functionName(), ' result > ', result)
	// result > null
	// result > {
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
	//#endregion
	if (data.from_account) return handleTransfer10(data)

	// Ask user for payer
	else {
		const usersAmoIds = await db.map( "SELECT amo_id FROM public.users", [], r => r.amo_id )
		const contacts = await findAmoContacts({ id: usersAmoIds })
		data.msg = await bot.sendMessage( data.user.chat_id,
			`Выберите плательщика или введите AmoId последнего.`,
			{
				reply_markup: {
					inline_keyboard: [
						...contacts.map(c => [{
							text: `${c.name}`,
							callback_data: `ask-for-account:amo_id:${c.id}`
						}]),
					[{
						text: 'Подтянуть из Точки',
						callback_data: `select-tochka-payment`
					}],
					[{
						text: 'Ввести id перевода',
						callback_data: `ask-for-transfer-id`
					}],
					[{
						text: 'Закончить 🔚',
						callback_data: `cancel`
					}]]
				}
			}
		)
		data.state = 'get-payer-account-5'
		data.result_field = 'from_account'
		return setStore(data)
	}
}

const askForTransferId = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const {  msg: { text }, state } = data

	if (state !== 'ask-for-transfer-id') {
		data.msg = await bot.sendMessage( data.user.chat_id,
			`Введите id перевода`,
			{
				reply_markup: {
					inline_keyboard: [
					[{
						text: 'Закончить 🔚',
						callback_data: `cancel`
					}]]
				}
			}
		)
		data.state = 'ask-for-transfer-id'
		return setStore(data)
	}

	else {
		data.transfer = await getTransfer(parseInt(text))
		data.transfer.was_existent = true
		;['actions', 'state', 'result_field', 'ask_for_account'].forEach(k => delete data[k])
		return checkoutTransfer(data)
	}
}

const askForAccount = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const { msg: { text }, actions, state, result_field, ask_for_account: cache = {} } = data

	if (state !== 'ask-for-account') {
		const cache = data.ask_for_account = {}
		cache.id_type = actions.length ? actions.shift() : 'amo_id'
		cache.id = actions.length ? actions.shift() : parseInt(text)
		cache.accounts = await db.any(
			`SELECT * FROM public.account WHERE
			${cache.id_type === 'amo_id' ? 'amo_id = $1' : ''}
			${cache.id_type === 'inn' ? 'inn = $1' : ''}`,
			cache.id
		)
		const general_account = cache.accounts.find(a => a.type === 'general')
		data.msg = await bot.sendMessage( data.user.chat_id,
			`Введите ИНН получателя платежа`,
			{
				reply_markup: {
					inline_keyboard: [
						...cache.accounts.map(a => [{
							text: `${
								a.type === 'card' ? '💳' :
								a.type === 'bank' ? '🏦' :
								a.type === 'cash' ? '💰' :
								a.type === 'general' ? 'Какой-то счёт (невозможно узнать)' : 
								'Тип счета неопределен (Ошибка системы!)'
							} ${a.bank_name} ${a.number}`,
							callback_data: `ask-for-account:${a.id}`
						}]),
						...!general_account ? [[{
							text: 'Какой-то счёт (невозможно узнать)',
							callback_data: `ask-for-account:create-general-account`
						}]] : [],
					[{
						text: 'Закончить 🔚',
						callback_data: `cancel`
					}]]
				}
			}
		)
		data.state = 'ask-for-account'
		return setStore(data)
	}

	const param = actions.shift()
	data[result_field] = param === 'create-general-account'
		? await db.one(
			`INSERT INTO public.account(type, ${cache.id_type}) VALUES('general', $1) RETURNING *`,
			cache.id
		)
		: cache.accounts.find(a => a.id === parseInt(param))

	;['actions', 'state', 'result_field', 'ask_for_account'].forEach(k => delete data[k])
	return handleTransfer10(data)
}

const selectTochkaPayment = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const { state, actions } = data

	if (state !== 'select-tochka-payment') {
		data.payments = await getTochkaPayments()
		data.msg = await bot.sendMessage( data.user.chat_id,
			`Выберите платеж`,
			{
				reply_markup: {
					inline_keyboard: [
						...data.payments.map(p => [{
							text: `${p.payment_purpose}`,
							callback_data: `select-tochka-payment:${p.x_payment_id}`
						}]),
					[{
						text: 'Закончить 🔚',
						callback_data: `cancel`
					}]]
				}
			}
		)
		data.state = 'select-tochka-payment'
		return setStore(data)
	}

	else {
		data.payment = data.payments.find(p => p.x_payment_id === actions[0])
		data.input = {
			from_account_type: 'bank',
			from_account_bank_name: 'Точка',
			from_account_number: process.env.TOCHKA_ACCOUNT_CODE_IP,
			from_account_holder: null,
			to_account_type: 'bank',
			to_account_inn: data.payment.counterparty_inn,
			to_account_number: data.payment.counterparty_account_number,
			to_account_holder: null,
			to_account_phone: null,
			to_account_bank_name: null,
			to_account_bank_bik: data.payment.counterparty_bank_bic,
			amount: Math.abs(data.payment.payment_amount),
			datetime: Date.parse(data.payment.payment_date.split('.').reverse().join('-') + 'T00:00:00Z')/1000 - 3*3600 //Moscow date to Epoch
		}
		return getPayerAccount5(data)
	}
}

const askForInn = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const {  msg: { text }, state } = data

	if (state !== 'ask-for-inn') {
		data.msg = await bot.sendMessage( data.user.chat_id,
			`Введите ИНН получателя платежа`,
			{
				reply_markup: {
					inline_keyboard: [
					[{
						text: 'Закончить 🔚',
						callback_data: `cancel`
					}]]
				}
			}
		)
		data.state = 'ask-for-inn'
		return setStore(data)
	}

	else {
		data.input = {}
		data.actions = ['inn', text]
		data.result_field = 'to_account'
		return askForAccount(data)
	}
}

const getPayeeAccount = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const { input } = data
	let result
	
	const query = 
		`SELECT * FROM public.account
		WHERE type = $<to_account_type>
		AND inn ${!!input.to_account_inn ? '= $<to_account_inn>' : 'IS NULL'}
		AND holder ${!!input.to_account_holder ? '= $<to_account_holder>' : 'IS NULL'}
		AND number ${!!input.to_account_number ? "LIKE '%'||$<to_account_number>" : 'IS NULL'}
		AND phone ${!!input.to_account_phone ? '= $<to_account_phone>::VARCHAR(12)' : 'IS NULL'}`
	result = await db.oneOrNone(query, input)
		|| await db.one(
				`INSERT INTO public.account(type, holder, number, phone, inn, bank_name, bank_bik)
				VALUES($<to_account_type>, $<to_account_holder>, $<to_account_number>, $<to_account_phone>, $<to_account_inn>, $<to_account_bank_name>, $<to_account_bank_bik>) RETURNING *`,
				input
			)
	//#region schema 
	// console.log(functionName(), ' result > ', result)
	// result >  {
	// 	id: 11,
	// 	type: 'card',
	// 	amo_id: null,
	// 	bank_name: null,
	// 	bank_bik: null,
	// 	number: '9702',
	// 	holder: 'ИВАН ИВАНОВИЧ И.',
	// 	phone: null, // '+79261234567'
	// 	inn: null
	// }
	//#endregion

	return data.to_account = result
}

const askForAmount = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const {  msg: { text }, state, input } = data

	if (state !== 'ask-for-amount') {
		data.msg = await bot.sendMessage( data.user.chat_id,
			`Введите сумму платежа`,
			{
				reply_markup: {
					inline_keyboard: [
					[{
						text: 'Закончить 🔚',
						callback_data: `cancel`
					}]]
				}
			}
		)
		data.state = 'ask-for-amount'
		return setStore(data)
	}

	else {
		input.amount = parseFloat(text)
		return handleTransfer10(data)
	}
}

const askForDate = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const {  msg: { text }, state, input } = data

	if (state !== 'ask-for-date') {
		data.msg = await bot.sendMessage( data.user.chat_id,
			`Укажите дату платежа в формате ГГГГ-ММ-ДД`,
			{
				reply_markup: {
					inline_keyboard: [
					[{
						text: 'Закончить 🔚',
						callback_data: `cancel`
					}]]
				}
			}
		)
		data.state = 'ask-for-date'
		return setStore(data)
	}

	else {
		input.datetime = Date.parse(text + 'T00:00:00Z')/1000 - 3*3600 //Moscow date to Epoch
		return handleTransfer10(data)
	}
}

const createTransfer = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const { input, receipt, text, payment } = data
	let result

	result = await db.oneOrNone(
		"SELECT * FROM public.transfer WHERE from_account_id = $1 AND to_account_id = $2 and amount = $3 and datetime = $4",
		[data.from_account.id, data.to_account.id, data.input.amount, data.input.datetime]
	)
	//#region schema
	// console.log(functionName(), ' data.transfer > ', data.transfer)
	// data.transfer >  undefined
	// data.transfer >  {
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
	//#endregion
	if (result) result.was_existent = true

	else {
		result = await db.one(
			`INSERT INTO public.transfer(from_account_id, to_account_id, amount, datetime, receipt, document, created_by)
			VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
			[data.from_account.id, data.to_account.id, input.amount, input.datetime, receipt || payment, text, data.user.id]
		)
		result.was_created = true
	}

	handleTransfer10({ ...data, transfer: result })
}

const getAccount = async id => db.one( "SELECT * FROM public.account WHERE id = $1", id )

const getTransfer = async id => db.one( "SELECT * FROM public.transfer WHERE id = $1", id )

const checkoutTransfer = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const {user, transfer, from_account, to_account} = data
	data.moves = await getMoves(data)
	transfer.paid_total = data.moves.reduce((prev, cur, i) => prev + cur.paid, 0)
	if (data.moves.length) {
		data.tasks = await Promise.all(data.moves.filter(m => m.task_id).map(async m => getTask(m.task_id)))
		data.projs = await Promise.all(data.moves.filter(m => m.proj_id).map(async m => getProj(m.proj_id)))
		data.compensations = await db.any("SELECT * FROM public.move WHERE compensation_for IN ($1:list)", [data.moves.map(({id}) => id)])
	}
	if (!from_account) data.from_account = await getAccount(transfer.from_account_id)
	if (!to_account) data.to_account = await getAccount(transfer.to_account_id)
	data.from_amo = data.to_amo = data.from_org = data.to_org = data.compensation = undefined
	if (data.from_account.amo_id) data.from_amo = await getAmoContact(data.from_account.amo_id)
	if (data.to_account.amo_id) data.to_amo = await getAmoContact(data.to_account.amo_id)
	if (data.from_account.inn) data.from_org = await getOrg(data.from_account.inn)
	if (data.to_account.inn) data.to_org = await getOrg(data.to_account.inn)

	const text = despace`Перевод ${transfer.was_existent ? 'уже был ' : ''}зарегистрирован
								#️⃣ ${transfer.id}
								🗓 ${new Date((transfer.datetime + 3*3600)*1000).toISOString().replace(/T|\.000Z/g, ' ')}
								💵 ${transfer.amount} ₽
								Плательщик: ${!!data.from_amo ? `👤 <a href='${amoBaseUrl}/contacts/detail/${data.from_amo.id}'>${data.from_amo.name}</a>` : ''}
								${!!data.from_org ? `🏢 <a href='https://www.list-org.com/search?type=inn&val=${data.from_org.Inn}'>${data.from_org.ShortName}</a>` : ''}
								${data.from_account.type === 'card' ? '💳' : data.from_account.type === 'bank' ? '🏦' : data.from_account.type} ${data.from_account.bank_name || ''} ${data.from_account.number || ''} ${data.from_account.holder || ''}
								Получатель: ${!!data.to_amo ? `👤 <a href='${amoBaseUrl}/contacts/detail/${data.to_amo.id}'>${data.to_amo.name}</a>` : ''}
								${!!data.to_org ? `🏢 <a href='https://www.list-org.com/search?type=inn&val=${data.to_org.Inn}'>${data.to_org.ShortName}</a>` : ''}
								${data.to_account.type === 'card' ? '💳' : data.to_account.type === 'bank' ? '🏦' : data.to_account.type} ${data.to_account.bank_name || ''} ${data.to_account.number || ''} ${data.to_account.holder || ''}
								${!!transfer.was_existent ? `Учтено: ${transfer.paid_total} ₽` : ''}`
	data.msg = await bot.sendMessage( user.chat_id, text,
		{
			reply_markup: {
				inline_keyboard: [
				...data.moves.map(m => {
					const { name, humanNumber } = 
						m.task_id ? data.tasks.find(t => t.id == m.task_id) :
						m.proj_id ? data.projs.find(p => p.id == m.proj_id) :
						{ humanNumber: 0, name: 'Начисление не привязано к задаче или проекту!'}
					const compensation = data.compensations.find(c => c.compensation_for == m.id)
					return [{
						text: `${m.paid} ₽/${m.amount} ₽ - ${humanNumber}. ${name} ${compensation ? '⤵️' : ''}`,
						callback_data: `transfer-accounting-0:${m.id}`
					}]
				}),
				[{
					text: 'Учесть 📊',
					callback_data: `transfer-accounting-0`
				}],[{
					text: 'Закончить 🔚',
					callback_data: `cancel`
				}]]
			},
			parse_mode: 'HTML'
		}
	)
	
	return setStore(data)
}

const getMoves = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const { transfer } = data
	return db.any(
		"SELECT * FROM public.move WHERE transfer_id = $1",
		transfer.id
	)
}

export {
	handleTransfer5,
	handleTransfer10,
	askForTransferId,
	askForAccount,
	selectTochkaPayment,
	askForInn,
	askForAmount,
	askForDate,
}