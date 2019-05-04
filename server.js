const express = require('express')
const app = express()

require('dotenv').config()

app.use(express.json())
app.use(express.urlencoded())

const axios = require('axios')

const disk = axios.create({
  baseURL: 'https://cloud-api.yandex.net/v1/disk/resources',
  headers: {
    'content-type': 'application/json',
    'Authorization': 'OAuth ' + process.env.DOCS_KOLMECH_TOKEN,
  }
})
// const diskBaseUrl = 'https://cloud-api.yandex.net/v1/disk/resources'
// const headers = {
//   'content-type': 'application/json',
//   'Authorization': 'OAuth ' + process.env.DOCS_KOLMECH_TOKEN,
// }

let getCounter = 1
let postCounter = 1

const skipStatusId = '27256984'

console.log('new Date(1556927568000).toISOString() > ', new Date(1556927568000).toISOString())
console.log('new Date().getTimezoneOffset() > ', new Date().getTimezoneOffset())

app.get('/', (req, res) => {
  console.log('received GET request > ' + getCounter++)
  res.send('Hello World!')
})

app.post('/lead/status', async (req, res) => {
  console.log('received POST request > ' + postCounter++)
  res.status(200).send('Request handled')
  const body = req.body
  console.log('body > ', JSON.stringify(body, null, 2))
  const deal = body.leads && body.leads.status[0]
  const created = await disk.put('/', {
    params: {
      path: `/Заявки ХОНИНГОВАНИЕ.РУ/${deal.name}_${deal.id}`,
    }
  })
  console.log('created > ', created)
})

const port = process.env.PORT || 8000
app.listen(port, () => {
  console.log(`Listening on port ${port}!...`)
})

// {
//   0|server  |         "id": "164837",
//   0|server  |         "name": "Разработка интернет-магазина",
//   0|server  |         "status_id": "27256984",
//   0|server  |         "old_status_id": "27256981",
//   0|server  |         "price": "",
//   0|server  |         "responsible_user_id": "3458350",
//   0|server  |         "last_modified": "1556933093",
//   0|server  |         "modified_user_id": "3458350",
//   0|server  |         "created_user_id": "3458350",
//   0|server  |         "date_create": "1556927568",
//   0|server  |         "pipeline_id": "1779352",
//   0|server  |         "account_id": "27256969"
//   0|server  |       }
