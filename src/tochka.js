import axios from 'axios'

const baseUrl = 'https://enter.tochka.com/api/v1/statement'

const baseHeaders = {
	'Host': 'enter.tochka.com',
	'Accept': 'application/json',
	'Content-Type': 'application/json'
}

const accounts = [{
	token: process.env.TOCHKA_API_TOKEN,
	account_code: process.env.TOCHKA_ACCOUNT_CODE_IP,
	initialDate: '2019-01-01'
},
// {
// 	token: process.env.TOCHKA_KFSUPPORT_API_TOKEN,
// 	account_code: process.env.TOCHKA_KFSUPPORT_ACCOUNT_CODE,
// 	initialDate: '2019-07-01'
// }
]

const tochka = axios.create({
	baseURL: 'https://enter.tochka.com/api/v1/statement',
	headers: {
		'Host': 'enter.tochka.com',
		'Accept': 'application/json',
		'Content-Type': 'application/x-www-form-urlencoded',
		'Authorization': 'Bearer ' + process.env.TOCHKA_API_TOKEN
	}
})

const getTochkaRequestId = async date => tochka.post('', {
	account_code: process.env.TOCHKA_ACCOUNT_CODE_IP,
	bank_code: '044525999',
	date_start: '2021-05-30',
	date_end: '2021-06-06'
})

const getTochkaPayments = async date => {
	const { data: { request_id } } = await getTochkaRequestId(date)
	//#region schema
	// console.log('request_id > ', request_id)
	// request_id >  044525999.2021-06-06.2021-06-01.40802810301500021080
	//#endregion
	await new Promise(resolve => setTimeout(resolve, 500))
	const { data: { payments } } = await tochka.get(baseUrl + '/result/' + request_id, { responseType: 'json' })
	//#region schema
	// console.log('payments > ', payments)
	// payments > [
	// 	{
	// 		counterparty_account_number: '30232810100500005065',
	// 		counterparty_bank_bic: '044525999',
	// 		counterparty_bank_name: 'ТОЧКА ПАО БАНКА "ФК ОТКРЫТИЕ"',
	// 		counterparty_inn: '7706092528',
	// 		counterparty_kpp: '770543002',
	// 		counterparty_name: 'Точка ПАО Банка "ФК Открытие"',
	// 		operation_type: '17',
	// 		payment_amount: '-2326.41',
	// 		payment_bank_system_id: '794288111;1',
	// 		payment_charge_date: '06.06.2021',
	// 		payment_date: '06.06.2021',
	// 		payment_number: '123456789',
	// 		payment_purpose: 'Покупка товара(Терминал:YM*AliExpress, ULITCA LVA TOLSTOGO, 16, Moscow, RU,дата операции:04/06/2021 13:54(МСК),на сумму:2326.41 RUB,карта 5140********1234)',        
	// 		supplier_bill_id: '',
	// 		tax_info_document_date: '',
	// 		tax_info_document_number: '',
	// 		tax_info_kbk: '',
	// 		tax_info_okato: '',
	// 		tax_info_period: '',
	// 		tax_info_reason_code: '',
	// 		tax_info_status: '',
	// 		x_payment_id: '794288111;1'
	// 	},
	// 	{
	// 		counterparty_account_number: '40702810540112345678',
	// 		counterparty_bank_bic: '044525225',
	// 		counterparty_bank_name: 'ПАО СБЕРБАНК',
	// 		counterparty_inn: '5018131234',
	// 		counterparty_kpp: '501287009',
	// 		counterparty_name: 'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "КОМПАНИЯ-РОМАШКА"',
	// 		operation_type: '1',
	// 		payment_amount: '-68123.36',
	// 		payment_bank_system_id: '789871234;1',
	// 		payment_charge_date: '31.05.2021',
	// 		payment_date: '31.05.2021',
	// 		payment_number: '41',
	// 		payment_purpose: 'за электрокомпоненты по Счету на оплату № 123 от 28 мая 2021, в т.ч. НДС 20%',
	// 		supplier_bill_id: '0',
	// 		tax_info_document_date: '',
	// 		tax_info_document_number: '',
	// 		tax_info_kbk: '',
	// 		tax_info_okato: '',
	// 		tax_info_period: '',
	// 		tax_info_reason_code: '',
	// 		tax_info_status: '',
	// 		x_payment_id: '789871234;1'
	// 	}
	// ]
	//#endregion
	return payments
}

const getTochkaPayments1 = async date => {
	const paymentArrs = await Promise.all(accounts.map(async ({
		token,
		account_code,
		date_start
	}, i) => {
		const headers = {
			...baseHeaders,
			'Authorization': 'Bearer ' + token
		}
		// 1. get request_id
		const res = await fetch(baseUrl, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				account_code,
				bank_code: '044525999',
				date_start,
				// date_start: '2020-03-30',
				date_end: toLocalISOString(new Date).slice(0,10)
			})
		})
		const { request_id } = await res.json()

		console.log('request_id > ', request_id)
		// 2. fetch payments from tochka server
		const statementUrl = baseUrl + '/result/' + request_id
		const res1 = await fetch(statementUrl, {
			method: 'GET',
			headers
		})
		// console.log('res1 > ', res1)
		// require('fs').writeFileSync('res1.json', safeStringify(res1))
		// const tp = JSON.parse(require('fs').readFileSync('payments.json'))
		// console.log('tp.length > ', tp.length)
		if (res1.statusText !== 'OK')
			throw new Error(`Ошибка сервера Точка. Статус запроса для счета № ${i + 1}: ` + res1.statusText)
		return (await res1.json()).payments
			.map(p => ({ ...p, account_code }))
	}))
	const payments = paymentArrs
		.reduce((payments, arr) => [ ...payments, ...arr ], [])
		.sort(({ x_payment_id: a }, { x_payment_id: b }) => a < b ? -1 : a === b ? 0 : 1)
	// require('fs').writeFileSync('payments.json', JSON.stringify(payments, null, 2))
	return payments
}

export {
	getTochkaPayments
}