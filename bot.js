process.env.NTBA_FIX_319 = 1
import dotenv from 'dotenv'
import TelegramBot from 'node-telegram-bot-api'
import tesseract from 'tesseract.js'
import fs from 'fs'
// import axios from 'axios'
import handleSberTransfer from './flows/handle-sber-transfer.js'
import { transferAccounting0, transferAccounting10, transferAccounting5 } from './flows/transfer-accounting.js'
import { clearStore, getStore, getUser } from './src/user.js'

dotenv.config()

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {polling: true})

bot.on('text', async (msg) => {
	console.log('text msg > ', msg)

	let data = await getStore(msg.chat.id)
	if (!data) return
	// if (!data) data = {
	// 	user: getUser(msg.chat.id)
	// }
	data.msg = msg
	if (data.state) switch (data.state) {
		case 'transfer-accounting-0':
			transferAccounting5(data)
			break
		case 'transfer-accounting-5':
			transferAccounting10(data)
			break
		default:
			console.log('unhandled state with data> ', data)
	}
})

bot.onText(/t/, async (msg) => {
	// console.log('text t > ', msg)

	const data = {}

	data.user = await getUser(msg.chat.id)

	data.text = fs.readFileSync('output.txt', 'utf-8')

	handleSberTransfer(data)

	// await axios.post('https://hook.integromat.com/tfj6964s5ba98tfdpdwilmoymm7nbxo5', result)
})

bot.on('photo', async (msg) => {
	console.log('photo msg > ', msg)

	const photoHref = await bot.getFileLink(msg.photo[msg.photo.length - 1].file_id)
	const { data: { text } } = await tesseract.recognize(
		photoHref,
		'rus+eng',
		{ logger: m => console.log(m) }
	)
	fs.writeFileSync('output.txt', text)
})

bot.on('callback_query', async (callbackData) => {
	// console.log('callbackData > ', callbackData)
	// callbackData >  {
	// 	id: '2780624024969796000',
	// 	from: {
	// 		id: 123456789,
	// 		is_bot: false,
	// 		first_name: 'ПЕТРОВИЧ',
	// 		username: 'petrovich',
	// 		language_code: 'ru'
	// 	},
	// 	message: {
	// 		message_id: 4445,
	// 		from: {
	// 			id: 776961397,
	// 			is_bot: true,
	// 			first_name: 'selo',
	// 			username: 'seloBot'
	// 		},
	// 		chat: {
	// 			id: 123456789,
	// 			first_name: 'ПЕТРОВИЧ',
	// 			username: 'petrovich',
	// 			type: 'private'
	// 		},
	// 		date: 1621537675,
	// 		text: 'Платеж уже зарегистрирован transfer_id = 2',
	// 		reply_markup: { inline_keyboard: [Array] }
	// 	},
	// 	chat_instance: '8440646773580874000',
	// 	data: 'transfer-accounting-0'
	// }
	// await bot.answerCallbackQuery(callbackData.id, { cache_time: 60 })
	const { data: actions, message: msg } = callbackData
	const data = await getStore(msg.chat.id)
	if (!data || data.msg.message_id !== msg.message_id) return
	data.actions = actions.split(':')
	switch (data.actions.shift()) {
		case 'transfer-accounting-0':
			transferAccounting0(data)
			break
		case 'cancel':
			clearStore(msg.chat.id)
			bot.sendMessage(msg.chat.id, 'Работа завершена')
			break
		default:
			console.log('unhandled callback_query > ', callbackData)
	}
})

export default bot