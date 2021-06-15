process.env.NTBA_FIX_319 = 1
process.env.debug = true
import dotenv from 'dotenv'
import TelegramBot from 'node-telegram-bot-api'
import tesseract from 'tesseract.js'
import pdfParse from 'pdf-parse'
import fs from 'fs'
import axios from 'axios'
import { handleTransfer5, askForAccount, selectTochkaPayment, askForInn, askForAmount, askForDate, askForTransferId } from './flows/handle-transfer.js'
import { checkoutMove, requireCompensaton, transferAccounting0, selectEntity, transferAccounting15, transferAccounting5 } from './flows/transfer-accounting.js'
import { createCompanyFolder, createPostInlet5, createPostInlet10, handleCompany } from './src/company.js'
import { endJob, getStore, getUser } from './src/user.js'
import { outputJson } from './src/utils.js'

dotenv.config()

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {polling: true})

bot.on('text', async (msg) => {
	// console.log('text msg > ', msg)

	const data = await getStore(msg.chat.id)
	if (!data) return
	data.msg = msg
	if (data.state) switch (data.state) {
		case 'get-payer-account-5':
			askForAccount(data)
			break
		case 'ask-for-transfer-id':
			askForTransferId(data)
			break
		case 'ask-for-inn':
			askForInn(data)
			break
		case 'ask-for-amount':
			askForAmount(data)
			break
		case 'ask-for-date':
			askForDate(data)
			break
		case 'transfer-accounting-0':
			transferAccounting5(data)
			break
		case 'select-entity':
			selectEntity(data)
			break
		case 'transfer-accounting-10':
			transferAccounting15(data)
			break
		default:
			console.log('unhandled state with data> ', data)
	}
})

bot.onText(/\/transfer/, async msg => {
  const data = {
		user: await getUser(msg.chat.id),
		msg,
	}
	handleTransfer5(data)
})

bot.onText(/^t$/, async msg => {
	// console.log('text t msg > ', msg)
	const data = {
		user: await getUser(msg.chat.id),
		msg,
		text: fs.readFileSync('output.txt', 'utf-8')
	}
	handleTransfer5(data)
	// await axios.post('https://hook.integromat.com/tfj6964s5ba98tfdpdwilmoymm7nbxo5', result)
})

bot.onText(/\.amocrm\.ru\/companies\/detail/, async (msg) => {
	// console.log('companies/detail/ msg > ', msg)
	const data = {
		user: await getUser(msg.chat.id),
		msg
	}
	handleCompany(data)
})

bot.on('photo', async (msg) => {
	// console.log('photo msg > ', msg)
	const data = {
		user: await getUser(msg.chat.id),
		msg
	}

	const href = await bot.getFileLink(msg.photo[msg.photo.length - 1].file_id)
	bot.sendMessage(msg.chat.id, 'Картинка распознаётся, подождите..')
	const { data: { text } } = await tesseract.recognize( href, 'rus+eng',
		{ logger: m => console.log(m) }
	)
	bot.sendMessage(msg.chat.id, 'Картинка распознана.')

	fs.writeFileSync('output.txt', text)
})

bot.on('document', async (msg) => {
	console.log('document msg > ', msg)
	let data = await getStore(msg.chat.id)
	if (!data) data = {
		user: await getUser(msg.chat.id),
		msg
	}

	const href = await bot.getFileLink(msg.document.file_id)
	if (msg.document.file_name.endsWith('.pdf')) {
		const { data: doc } = await axios.get( href, { responseType: 'arraybuffer'} )
		data.text = (await pdfParse(doc)).text
		//#region schema
				


		// 17.05.2021  07:35:04
		// 12 738 iИтого
		// ПереводКлиенту Тинькофф
		// СтатусУспешно
		// 12 738 iСумма
		// ОтправительИван Иванов
		// Карта получателя*1011
		// ПолучательИван И.
		// Служба поддержки fb@tinkoff.ru
		// По вопросам зачисления обращайтесь к получателю
		// Квитанция  No 1-2-123-123-123
		//#endregion
		fs.writeFileSync('output.txt', data.text)
	}
	if (msg.document.file_name.endsWith('.json')) {
		data.receipt = (await axios.get(href)).data[0]
	}
	handleTransfer5(data)
	return
})

bot.on('callback_query', async (callbackData) => {
	//#region schema
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
	//#endregion
	bot.answerCallbackQuery(callbackData.id, { cache_time: 60 })
	const { data: actions, message: msg } = callbackData
	const data = await getStore(msg.chat.id)
	if (!data || data.msg.message_id !== msg.message_id) return
	data.actions = actions.split(':')
	console.log('data.actions > ', data.actions)
	switch (data.actions.shift()) {
		case 'select-tochka-payment':
			selectTochkaPayment(data)
			break
		case 'ask-for-transfer-id':
			askForTransferId(data)
			break
		case 'ask-for-account':
			askForAccount(data)
			break
		case 'transfer-accounting-0':
			transferAccounting0(data)
			break
		case 'transfer-accounting-5':
			transferAccounting5(data)
			break
		case 'select-entity':
			selectEntity(data)
			break
		case 'transfer-accounting-15':
			transferAccounting15(data)
			break
		case 'checkout-move':
			checkoutMove(data)
			break
		case 'require-compensation':
			requireCompensaton(data)
			break
		case 'create-company-folder':
			createCompanyFolder(data)
			break
		case 'create-post-inlet-5':
			createPostInlet5(data)
			break
		case 'create-post-inlet-10':
			createPostInlet10(data)
			break
		case 'cancel':
			endJob(data)
			break
		default:
			console.log('unhandled callback_query > ', callbackData)
	}
})

export default bot