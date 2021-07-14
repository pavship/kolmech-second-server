import ImapSimple from 'imap-simple'
import { mimeWordsDecode } from 'emailjs-mime-codec'
import nodemailer from 'nodemailer'

// const boxes = await connection.getBoxes()
// console.log('boxes > ', boxes)

const EMAIL_USERS = process.env.EMAIL_USERS.split(' ')
const EMAIL_PASSWORDS = process.env.EMAIL_PASSWORDS.split(' ')

const serverSmtpTransporter = nodemailer.createTransport({
	service: '"Yandex"', // no need to set host or port etc.
	auth: {
			user: EMAIL_USERS[2],
			pass: EMAIL_PASSWORDS[2]
	}
})

const ceoImapConfig = {
	user: process.env.EMAIL_USERS.split(' ')[0],
	password: EMAIL_PASSWORDS[0],
	host: process.env.EMAIL_HOST,
	port: 993,
	tls: true,
	authTimeout: 5000
}

const getEmailAttachments = async (user, from, time) => {
	const userIndex = EMAIL_USERS.indexOf(user)
	if (userIndex === -1) return console.log(`there are no imap credentials for user > ${user}`)

	const connection = await ImapSimple.connect({
		imap: {
			user,
			password: EMAIL_PASSWORDS[userIndex],
			host: process.env.EMAIL_HOST,
			port: 993,
			tls: true,
			authTimeout: 10000
		}
	})
	await connection.openBox('INBOX')
	// Examples
	// const delay = 96 * 3600 * 1000
	// let yesterday = new Date()
	// yesterday.setTime(Date.now() - delay)
	// yesterday = yesterday.toISOString()
	// var searchCriteria = ['UNSEEN', ['SINCE', yesterday]]
	// var searchCriteria = [['FROM', 'pdo@kkkk.ru'], ['SINCE', yesterday]]

	const on = new Date(time * 1000).toISOString() // AmoCRM uses seconds instead of milliseconds, that's why * 1000 is required
	const searchCriteria = [['FROM', from], ['ON', on]]
	const fetchOptions = {
		bodies: ['HEADER', 'TEXT'],
		struct: true,
		markSeen: false
	}
	const messages = await connection.search(searchCriteria, fetchOptions)
	// console.log('messages > ', messages)
	const message = messages.find(m => m.attributes.date.toISOString() === on)
	// console.log('message.attributes > ', JSON.stringify(message.attributes, null, 2))
	// console.log('message.attributes.struct > ', JSON.stringify(message.attributes.struct, null, 2))
	// const subjects = messages
	//   .map(message => {
	//     console.log('message.attributes > ', message.attributes)
	//     return message.parts.filter(part => part.which === 'HEADER')[0].body.subject[0]
	//   })
	// console.log('subjects > ', subjects)
	
	const attachments = []
	const parts = ImapSimple.getParts(message.attributes.struct)
	console.log('parts > ', JSON.stringify(parts, null, 2))
	for (const part of parts) {
		if (!(part.disposition && part.disposition.type.toUpperCase === 'ATTACHMENT') && part.type.toUpperCase() !== 'IMAGE') continue  // use this line to download images embedded into message
		// if (!(part.disposition && part.disposition.type.toUpperCase === 'ATTACHMENT')) continue
		const partData = await connection.getPartData(message, part)
		// console.log('part.disposition > ', part.disposition)
		const encodedFilename = part.disposition ? part.disposition.params.filename : part.params.name
		console.log('encodedFilename > ', encodedFilename)
		const filename = encodedFilename.startsWith("utf-8''")
			? decodeURI(encodedFilename.slice(7))
			: mimeWordsDecode(encodedFilename)
		// console.log('filename > ', filename)
		// encodedFilename.startsWith("=?windows-1251?B?")
		//   ? windows1251.decode(Buffer.from(part.disposition.params.filename.slice(17,-2), 'base64').toString('binary'))
		//   : Buffer.from(part.disposition.params.filename.replace('?=\t=?UTF-8?B?', '').slice(10,-2), 'base64').toString('utf-8')
		// =?windows-1251?B?0ffl8szCwDA0MzAxNjQzLnBkZg==?=
		// TODO distribute files in accordance to their name
		// 1. Company folder
		// "письмо", "гарантийное"
		// TODO lowercase file extension
		attachments.push({
			filename,
			data: partData
		})
		// require('fs').writeFileSync(Buffer.from(part.disposition.params.filename.replace('?=\t=?UTF-8?B?', '').slice(10,-2), 'base64').toString('utf-8'), partData)
	}
	connection.end()
	return attachments
}

export {
	EMAIL_USERS,
	EMAIL_PASSWORDS,
	serverSmtpTransporter,
	ceoImapConfig,
	getEmailAttachments
}