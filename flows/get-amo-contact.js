import { findAmoContacts } from '../src/amo.js'
import dedent from 'dedent-js'
import bot from '../bot.js'

export default async function getAmoContact(input) {
	let result

	// 1. Find amo contacts
	const contacts = await findAmoContacts(input.name)

	if (contacts?.length === 1) {
		// 2.1 Return single found contact
	}

	else {
		// 2.2. Ask user
		const text = 
		result = await requestUserForAmoContact(
			input.chatId,
			dedent`Предлагается привязать карту получателя
						${input.name}
						к контакту AmoCRM.
						Введите AmoId`,
			contacts
		)
	}
}

const requestUserForAmoContact = async (chatId, text, contacts) => {
	let result
	await bot.sendMessage(chatId, text, {
		reply_markup: {
			inline_keyboard: [[{
				text: 'sdfsdf',
				callback_data: 'kdajlkfjj'
			}]]
		}
	})

}