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
		(await (await amoConnect()).get('/api/v2/companies', { params: { query: text } })).data?._embedded?.items
		|| (await (await amoConnect()).get(`/api/v2/companies?id=${text}`)).data?._embedded?.items
	return result?.[0] || null
}

export {
	amoBaseUrl,
	amoConnect,
	getAmoContact,
	findAmoContacts,
	getAmoContacts,
	findAmoCompany
}