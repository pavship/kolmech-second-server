const axios = require('axios')

let Amo = null
let amoExpiresAt = 0
let amoCookie = ''
const baseURL = `https://${process.env.AMO_DOMAIN}.amocrm.ru`

const amoConnect = async () => {
  const isExpired = amoExpiresAt < Date.now()/1000
  if (isExpired) {
    const res = await axios.post(
      baseURL + '/private/api/auth.php?type=json',
      {
        USER_LOGIN: process.env.AMO_LOGIN,
        USER_HASH: process.env.AMO_HASH
      }
    )
    if (res.statusText !== 'OK') throw new Error('Amo authorization request failed with res.statusText > ' , res.statusText)
    amoExpiresAt = res.data.response.server_time + 14.5*60
    amoCookie = res.headers['set-cookie']
      .map(c => c.slice(0, c.indexOf(';')))
      .join(';')
  }
  if (Amo === null || isExpired)
    Amo = axios.create({
      baseURL,
      headers: {
        'cookie': amoCookie,
      }
    })
  return Amo
}

const findAmoContact = async text => {
  const { data: { _embedded: { items: contacts } } } = await (await amoConnect())
    .get('/api/v2/contacts?query=' + text)
  return contacts.length ? contacts[0] : null
}


module.exports = {
  amoConnect,
  findAmoContact
}
