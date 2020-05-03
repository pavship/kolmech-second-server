const axios = require('axios')

const telegram = axios.create({
  baseURL: `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/`,
})

module.exports = { 
  telegram
}
