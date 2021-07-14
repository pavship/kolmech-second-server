import { pgQuery } from './postgres.js'
import bot from '../bot.js'
import { emptyDebugLog } from './utils.js'

async function getUser(chat_id) {
	let result
	let res = await pgQuery(
		"SELECT * FROM public.users WHERE chat_id = $1",
		[chat_id]
	)
	result = res.rows[0]
	// result >  {
	// 	id: 1,
	// 	chat_id: 123456789,
	// 	is_superuser: true,
	// 	amo_id: 12345678,
	// 	store: null
	// }
	return result
}

async function getStore(chat_id) {
	let res = await pgQuery(
		"SELECT store FROM public.users WHERE chat_id = $1",
		[chat_id]
	)
	return res.rows[0]?.store
}

async function setStore(data) {
	let res = await pgQuery(
		"UPDATE users SET store = $1 WHERE id = $2",
		[data, data.user.id]
	)
}

async function clearStore(chat_id) {
	let res = await pgQuery(
		"UPDATE users SET store = null WHERE chat_id = $1",
		[chat_id]
	)
}

async function endJob(data, text) {
	if (process.env.debug) console.log('< cancel')
	clearStore(data.user.chat_id)
	emptyDebugLog()
	bot.sendMessage(data.user.chat_id, `${text ? text + '. ' : ''}Работа завершена`)
}

const clearCache = data => {
	['actions', 'state', 'result_field'].forEach(k => delete data[k])
	for (const k in data) { if (k.startsWith('_')) delete data[k] }
	return data
}

export {
	getUser,
	getStore,
	setStore,
	clearStore,
	endJob,
	clearCache,
}