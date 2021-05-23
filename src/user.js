import { pgQuery } from './postgres.js'
import functionName from './function-name.js'

export async function getUser(chat_id) {
	let result
	let res = await pgQuery(
		"SELECT * FROM public.users WHERE chat_id = $1",
		[chat_id]
	)
	result = res.rows[0]
	// console.log(functionName(), ' result > ', result)
	// result >  {
	// 	id: 1,
	// 	chat_id: 123456789,
	// 	is_superuser: true,
	// 	amo_id: 12345678,
	// 	store: null
	// }
	return result
}

export async function getStore(chat_id) {
	let res = await pgQuery(
		"SELECT store FROM public.users WHERE chat_id = $1",
		[chat_id]
	)
	return res.rows[0]?.store
}

export async function setStore(data) {
	let res = await pgQuery(
		"UPDATE users SET store = $1 WHERE id = $2",
		[data, data.user.id]
	)
}

export async function clearStore(chat_id) {
	let res = await pgQuery(
		"UPDATE users SET store = null WHERE chat_id = $1",
		[chat_id]
	)
}