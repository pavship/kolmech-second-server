const imaps = require('imap-simple')
const { mimeWordsDecode } = require('emailjs-mime-codec')

// const mail = async user => {}
const mail = async (user, from, time) => {
  const userIndex = process.env.EMAIL_USERS.split(' ').indexOf(user)
  if (userIndex === -1) return console.log(`there are no imap credentials for user > ${user}`)

  const connection = await imaps.connect({
    imap: {
      user,
      password: process.env.EMAIL_PASSWORDS.split(' ')[userIndex],
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
  // var searchCriteria = [['FROM', 'pdo2@kmzv.ru'], ['SINCE', yesterday]]

  const on = new Date(time * 1000).toISOString() // AmoCRM uses seconds instead of milliseconds, that's why * 1000 is required
  var searchCriteria = [['FROM', from], ['ON', on]]
  var fetchOptions = {
    bodies: ['HEADER', 'TEXT'],
    struct: true,
    markSeen: false
  }
  const messages = await connection.search(searchCriteria, fetchOptions)
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
  const parts = imaps.getParts(message.attributes.struct)
  // console.log('parts > ', JSON.stringify(parts, null, 2))
  for (const part of parts) {
    if (!(part.disposition && part.disposition.type.toUpperCase === 'ATTACHMENT') && part.type.toUpperCase() !== 'IMAGE') continue  // use this line to download images embedded into message
    // if (!(part.disposition && part.disposition.type.toUpperCase === 'ATTACHMENT')) continue
    const partData = await connection.getPartData(message, part)
    // console.log('part.disposition > ', part.disposition)
    const encodedFilename = part.disposition ? part.disposition.params.filename : part.params.name
    console.log('encodedFilename > ', encodedFilename)
    const filename =
      encodedFilename.startsWith("utf-8''") ? decodeURI(encodedFilename.slice(7)) :
      mimeWordsDecode(encodedFilename)
      // encodedFilename.startsWith("=?windows-1251?B?")
      //   ? windows1251.decode(Buffer.from(part.disposition.params.filename.slice(17,-2), 'base64').toString('binary'))
      //   : Buffer.from(part.disposition.params.filename.replace('?=\t=?UTF-8?B?', '').slice(10,-2), 'base64').toString('utf-8')
      // =?windows-1251?B?0ffl8szCwDA0MzAxNjQzLnBkZg==?=
    console.log('filename > ', filename)
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

module.exports = {
  mail
}
