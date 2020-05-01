const imaps = require('imap-simple')

const mail = async user => {
  const userIndex = process.env.EMAIL_USERS.split(' ').indexOf(user)
  if (!userIndex) return console.log(`there are no imap credentials for user > ${user}`)
  
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
  
  const delay = 24 * 3600 * 1000
  let yesterday = new Date()
  yesterday.setTime(Date.now() - delay)
  yesterday = yesterday.toISOString()
  var searchCriteria = ['UNSEEN', ['SINCE', yesterday]]
  // var searchCriteria = ['FROM', ['SINCE', yesterday]]
  var fetchOptions = {
    bodies: ['HEADER', 'TEXT'],
    markSeen: false
  }
  const results = await connection.search(searchCriteria, fetchOptions)
  const subjects = results.map(function (res) {
    return res.parts.filter(function (part) {
      return part.which === 'HEADER'
    })[0].body.subject[0]
  })
  console.log('subjects > ', subjects)
}

module.exports = {
  mail
}
