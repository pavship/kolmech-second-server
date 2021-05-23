// const https = require('https')

// const sendDevMessage = text => https.get('https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${process.env.TELEGRAM_DEV_CHAT_ID}&text=sdfsdf', (res) => {
//   console.log('statusCode:', res.statusCode)
//   console.log('headers:', res.headers)

//   // res.on('data', (d) => {
//   //   console.log('data:', d)
//   // })

// }).on('error', (e) => {
//   console.error(e)
// }).end()

// module.exports = { 
//   // sendDevMessage: text => telegram.get(`sendMessage?chat_id=${process.env.TELEGRAM_DEV_CHAT_ID}&text=${text}`)
//   sendDevMessage
// }



import axios from 'axios'

const telegram = axios.create({
  baseURL: `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/`,
})

export function sendDevMessage(text) { return telegram.get(`sendMessage?chat_id=${process.env.TELEGRAM_DEV_CHAT_ID}&text=${text}`) }
