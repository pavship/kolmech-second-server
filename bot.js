process.env.NTBA_FIX_319 = 1
process.env.debug = true
import dotenv from 'dotenv'
import TelegramBot from 'node-telegram-bot-api'
import tesseract from 'tesseract.js'
import pdfParse from 'pdf-parse'
import fs from 'fs'
import axios from 'axios'
import { handleTransfer5, askForAccount, selectTochkaPayment, askForPayee, askForAmount, askForDate, askForTransferId, askForPayer } from './flows/handle-transfer.js'
import { checkoutMove, requireCompensaton, transferAccounting0, selectEntity, transferAccounting15, askForSeller, askForQty, commentOnPurchase } from './flows/transfer-accounting.js'
import { createCompanyFolder, createPostInlet5, createPostInlet10, handleCompany } from './src/company.js'
import { endJob, getStore, getUser } from './src/user.js'
import { outputJson } from './src/utils.js'
import { askForDeal, askForEmailToReply, askForPostProject, askForPostTask, askForRPO, handlePostReceipt, sendPostReply } from './flows/handle-post-receipt.js'
import { askForDeliveryProject, commentOnDelivery, handleDeliveryReceipt } from './flows/handle-delivery-receipt.js'

dotenv.config()

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {polling: true})

bot.on('text', async (msg) => {
	// console.log('text msg > ', msg)
	if (msg.text === '/cancel') return

	const data = await getStore(msg.chat.id)
	if (!data) return
	data.msg = msg
	if (data.state) switch (data.state) {
		case 'ask-for-payer':
			askForPayer(data)
			break
		case 'ask-for-transfer-id':
			askForTransferId(data)
			break
		case 'selectTochkaPayment':
			selectTochkaPayment(data)
			break
		case 'ask-for-payee':
			askForPayee(data)
			break
		case 'askForQty':
			askForQty(data)
			break
		case 'ask-for-amount':
			askForAmount(data)
			break
		case 'ask-for-date':
			askForDate(data)
			break
		case 'ask-for-seller':
			askForSeller(data)
			break
		case 'select-entity':
			selectEntity(data)
			break
		case 'transfer-accounting-10':
			transferAccounting15(data)
			break
		case 'require-compensation':
			requireCompensaton(data)
			break
		case 'ask-for-rpo':
			askForRPO(data)
			break
		case 'askForDeliveryProject':
			askForDeliveryProject(data)
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

bot.onText(/\/cancel/, async msg => {
  const data = {
		user: await getUser(msg.chat.id),
	}
	endJob(data)
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

// DEBUG
bot.onText(/^s$/, async msg => {
	const data = JSON.parse(fs.readFileSync('outputdebug.json', 'utf-8'))
	askForPostProject(data)
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
	if (msg.document.file_name.toLowerCase().endsWith('.pdf')) {
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
	const action = data.actions.shift()
	if (!data.actions.length) delete data.actions
	switch (action) {
		case 'selectTochkaPayment':
			selectTochkaPayment(data)
			break
		case 'ask-for-transfer-id':
			askForTransferId(data)
			break
		case 'ask-for-payer':
			askForPayer(data)
			break
		case 'ask-for-account':
			askForAccount(data)
			break
		case 'transfer-accounting-0':
			transferAccounting0(data)
			break
		case 'ask-for-seller':
			askForSeller(data)
			break
		case 'select-entity':
			selectEntity(data)
			break
		case 'askForQty': askForQty(data); break
		case 'transfer-accounting-15':
			transferAccounting15(data)
			break
		case 'commentOnPurchase':
			commentOnPurchase(data)
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
		case 'handlePostReceipt':
			handlePostReceipt(data)
			break
		case 'ask-for-deal':
			askForDeal(data)
			break
		case 'ask-for-post-project':
			askForPostProject(data)
			break
		case 'ask-for-post-task':
			askForPostTask(data)
			break
		case 'send-post-reply':
			sendPostReply(data)
			break
		case 'handleDeliveryReceipt':
			handleDeliveryReceipt(data)
			break
		case 'askForDeliveryProject':
			askForDeliveryProject(data)
			break
		case 'commentOnDelivery':
			commentOnDelivery(data)
			break
		case 'cancel':
			endJob(data)
			break
		default:
			console.log('unhandled callback_query > ', callbackData)
	}
})

export default bot