import axios from 'axios'

let Amo = null
let amoExpiresAt = 0
let amoCookie = ''
const baseURL = `https://${process.env.AMO_DOMAIN}.amocrm.ru`
const amoBaseUrl = baseURL

const amoConnect = async () => {
	const isExpired = amoExpiresAt < Date.now()/1000
	if (isExpired) {
		const res = await axios.post(
			baseURL + '/private/api/auth.php?type=json',
			{
				USER_LOGIN: process.env.AMO_LOGIN,
				USER_HASH: process.env.AMO_HASH
			}
		)
		if (res.statusText !== 'OK') throw new Error('Amo authorization request failed with res.statusText > ' , res.statusText)
		amoExpiresAt = res.data.response.server_time + 14.5*60
		amoCookie = res.headers['set-cookie']
			.map(c => c.slice(0, c.indexOf(';')))
			.join(';')
	}
	if (Amo === null || isExpired)
		Amo = axios.create({
			baseURL,
			headers: {
				'cookie': amoCookie,
			}
		})
	return Amo
}

const getAmoContact = async id => (await findAmoContacts({ id }))?.[0] || null
//#region schema
// {
// 	"id": 12345678,
// 	"name": "Иванов Иван Иванович",
// 	"tags": [
// 			{
// 					"id": 297358,
// 					"name": "металл"
// 			}
// 	],
// 	"leads": {},
// 	"_links": {
// 			"self": {
// 					"href": "/api/v2/contacts?id=12345678",
// 					"method": "get"
// 			}
// 	},
// 	"company": {},
// 	"group_id": 123456,
// 	"customers": {},
// 	"last_name": "",
// 	"account_id": 12345678,
// 	"created_at": 1616851377,
// 	"created_by": 1234567,
// 	"first_name": "Иванов Иван Иванович",
// 	"updated_at": 1622405882,
// 	"updated_by": 1234567,
// 	"custom_fields": [
// 			{
// 					"id": 317989,
// 					"code": "PHONE",
// 					"name": "Телефон",
// 					"values": [
// 							{
// 									"enum": 499363,
// 									"value": "+7 917 123 45 67"
// 							}
// 					],
// 					"type_id": 8,
// 					"is_system": true
// 			},
// 			{
// 					"id": 404675,
// 					"name": "Примечания",
// 					"values": [
// 							{
// 									"value": "Примечания"
// 							}
// 					],
// 					"type_id": 9,
// 					"is_system": false
// 			}
// 	],
// 	"closest_task_at": 0,
// 	"responsible_user_id": 1234567
// }
//#endregion

const findAmoContacts = async params => {
	const { data: { _embedded } } = await (await amoConnect())
		.get('/api/v2/contacts', { params })
	const result = _embedded?.items || []
	return result
}

// all amo contacts
const getAmoContacts = async () => {
	const Amo = await amoConnect()
	const results = await Promise.all([0, 500, 1000, 1500, 2000, 2500, 3000, 3500].map(offset =>
		Amo.get('/api/v2/contacts?limit_rows=500&limit_offset=' + offset)
	))
	const contacts = results
		.filter(({ status }) => status === 200)
		.map(({ data: {_embedded: { items }}}) => items.map(({ id, name }) => ({ id, name })))
		.reduce((contacts, items) => [...contacts, ...items], [])
	return contacts
}

const findAmoCompany = async text => {
	const result = 
		(await (await amoConnect()).get('/api/v2/companies', { params: { query: text } })).data?._embedded?.items?.[0]
		|| (await (await amoConnect()).get(`/api/v2/companies?id=${text}`)).data?._embedded?.items?.[0]
		|| null
	return result
}

const findAmoDeals = async params => {
	const { data: { _embedded } } = await (await amoConnect())
		.get('/api/v2/leads', { params })
	const result = _embedded?.items || []
	return result
}

const getAmoStatuses = async () => {
	const result = (await (await amoConnect())
			.get('/api/v2/pipelines?id=1593157')
		).data?._embedded?.items?.['1593157']?.statuses
		|| null
	// const { data: { _embedded } } = res
	// console.log('res.data > ', res.data)
	// const result = _embedded?.items || []
	return result
}

export {
	amoBaseUrl,
	amoConnect,
	getAmoContact,
	findAmoContacts,
	getAmoContacts,
	findAmoCompany,
	findAmoDeals,
	getAmoStatuses
}