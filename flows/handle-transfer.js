import { db } from '../src/postgres.js'
import bot from '../bot.js'
import { endJob, setStore } from '../src/user.js'
import { outputJson, functionName, despace } from '../src/utils.js'
import { amoBaseUrl, findAmoContacts, getAmoContact } from '../src/amo.js'
import { getOrg } from '../src/moedelo.js'
import { getTask } from '../src/megaplan.js'

const handleTransfer5 = async data => {
	// 1. Parse text
	data.input = data.text && parseText(data.text)
	
	// 2. Check or parse receipt
	if (data.receipt) {
		if (await checkReceipt(data)) return checkoutTransfer(data)
		data.input = parseReceipt(data.receipt)
	}
	
	// 4. Get payer account
	getPayerAccount5(data)
}

const handleTransfer10 = async data => {
	
	// 5. Get payee account
	data.to_account = await getPayeeAccount(data)

	// 6. Create transfer
	await createTransfer(data)

	// 7. Notify user
	checkoutTransfer(data)
}

const parseText = text => {
	if (process.env.debug) console.log(functionName(), '>')
	const result = {
		from_account_bank_name: 'Сбер',
		to_account_type: 'card'
	}
	const regex = /(?<date>[0-9]{2}.[0-9]{2}.[0-9]{4})|(?<time>[0-9]{2}:[0-9]{2}:[0-9]{2})|(?<=.+MASTERCARD .+)(?<from_account_number>[0-9]{4})$|(?<=ПОЛУЧАТЕЛЬ:.+)(?<to_account_number>[0-9]{4})$|(?<=НОМЕР ТЕЛЕФОНА ПОЛУЧАТЕЛЯ: )(?<to_account_phone>.+)|(?<=СУММА ОПЕРАЦИИ: )(?<amount>.+) РУБ.|(?<=КОМИССИЯ: )(?<bank_fee>.+) РУБ.|(?<=ФИО: )(?<to_account_holder>.+)/gm;
	for (const match of text.matchAll(regex)) {
		for (const key in match.groups) {
			if (!!match.groups[key]) result[key] = match.groups[key]
		}
	}
	result.datetime = Date.parse(result.date.split('.').reverse().join('-') + 'T' + result.time + 'Z')/1000 - 3*3600 //Moscow time to Epoch
	result.to_account_phone = result.to_account_phone?.replace(/[ |(|)|-]/g, '')
	//#region schema
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
	// 	datetime: 1620212791,
	// 	to_account_phone: undefined, // '+79261234567'
	//	to_account_type: 'card',
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
	if (!receipt) data.from_account = await db.oneOrNone(
		`SELECT * FROM public.account WHERE type = 'card'
		AND bank_name = $<from_account_bank_name>
		AND number LIKE '%'||$<from_account_number>`,
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

	else {
		// Ask user for payer
		const usersAmoIds = await db.map( "SELECT * FROM public.users", [], r => r.amo_id )
		const contacts = await findAmoContacts({ id: usersAmoIds })
		data.msg = await bot.sendMessage( data.user.chat_id,
			`Выберите плательщика или введите AmoId последнего.`,
			{
				reply_markup: {
					inline_keyboard: [
						...contacts.map(c => [{
							text: `${c.name}`,
							callback_data: `get-payer-account-10:${c.id}`
						}]),
					[{
						text: 'Закончить 🔚',
						callback_data: `cancel`
					}]]
				}
			}
		)
		data.state = 'get-payer-account-5'
		return setStore(data)
	}
}

const getPayerAccount10 = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const { msg: { text }, actions } = data
	const	amo_id = parseInt(text) || parseInt(actions.shift())
	let result

	result = await db.oneOrNone(
		`SELECT * FROM public.account WHERE type = 'general' AND amo_id = $1`,
		amo_id
	) || await db.one(
		"INSERT INTO public.account(type, amo_id) VALUES('general', $1) RETURNING *",
		amo_id
	)

	data.from_account = result
	// await setStore(data)
	return handleTransfer10(data)
}

const getPayeeAccount = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const { input, receipt } = data
	let result
	
	const query = 
		`SELECT * FROM public.account WHERE type = $<to_account_type> ` + (
			receipt
				? `AND inn = $<to_account_inn>`
				: `AND holder = $<to_account_holder>
					AND number LIKE '%'||$<to_account_number>
					AND phone ${!!input.to_account_phone ? '= $<to_account_phone>::VARCHAR(12)' : 'IS NULL'}`
		)
	result = await db.oneOrNone(query, input)
	//#region schema 
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
	// 	phone: null, // '+79261234567'
	// 	inn: null
	// }
	//#endregion
	if (result) return result

	result = await db.one(
		`INSERT INTO public.account(type, holder, number, phone, inn)
		VALUES($<to_account_type>, $<to_account_holder>, $<to_account_number>, $<to_account_phone>, $<to_account_inn>) RETURNING *`,
		input
	)
	// console.log(functionName(), ' result > ', result)
	return result
}

const createTransfer = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const { input, receipt, text } = data
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
			[data.from_account.id, data.to_account.id, input.amount, input.datetime, receipt, text, data.user.id]
		)
		result.was_created = true
	}

	data.transfer = result
	await setStore(data)
}

const getMoves = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const { transfer } = data
	return db.any(
		"SELECT * FROM public.move WHERE transfer_id = $1",
		transfer.id
	)
}

const getAccount = async id => db.one( "SELECT * FROM public.account WHERE id = $1", id )

const checkoutTransfer = async data => {
	if (process.env.debug) console.log(functionName(), '>')
	const {user, transfer, receipt, from_account, to_account} = data
	data.moves = await getMoves(data)
	if (data.moves) {
		transfer.paid_total = data.moves.reduce((prev, cur, i) => prev + cur.paid, 0)
		data.tasks = await Promise.all(data.moves.map(async m => getTask(m.task_id)))
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
								${data.from_account.type === 'card' ? '💳' : data.from_account.type} ${data.from_account.bank_name || ''} ${data.from_account.number || ''} ${data.from_account.holder || ''}
								Получатель: ${!!data.to_amo ? `👤 <a href='${amoBaseUrl}/contacts/detail/${data.to_amo.id}'>${data.to_amo.name}</a>` : ''}
								${!!data.to_org ? `🏢 <a href='https://www.list-org.com/search?type=inn&val=${data.to_org.Inn}'>${data.to_org.ShortName}</a>` : ''}
								${data.to_account.type === 'card' ? '💳' : data.to_account.type} ${data.to_account.bank_name || ''} ${data.to_account.number || ''} ${data.to_account.holder || ''}
								${!!transfer.was_existent ? `Учтено: ${transfer.paid_total} ₽` : ''}`
								// ${!!data.from_amo ? `📤👤 <a href='${amoBaseUrl}/contacts/detail/${data.from_amo.id}'>${data.from_amo.name}</a>` : ''}
								// ${!!data.org ? `📥🏢 <a href='https://www.list-org.com/search?type=inn&val=${data.org.Inn}'>${data.org.ShortName}</a>` : ''}
	data.msg = await bot.sendMessage( user.chat_id, text,
		{
			reply_markup: {
				inline_keyboard: [
				...data.moves.map(m => {
					const { name, humanNumber } = data.tasks.find(t => t.id == m.task_id)
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

export {
	handleTransfer5,
	handleTransfer10,
	getPayerAccount10,
}