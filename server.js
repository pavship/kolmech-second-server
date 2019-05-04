const express = require('express')
const app = express()

require('dotenv').config()

const qs = require('qs')
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

const skipStatusId = '27256981'

app.get('/', (req, res) => {
  console.log('received GET request > ' + getCounter++)
  res.send('Hello World!')
})

app.post('/lead/status', async (req, res) => {
  res.status(200).send('Request handled')
  const body = req.body
  console.log('/lead/status req body > ', JSON.stringify(body, null, 2))
  const deal = body.leads.status[0]
  console.log('deal > ', deal)
  if (deal.status_id === skipStatusId) return console.log('skipped <')
  const createdLocalDate = new Date(parseInt(deal.date_create + '000', 10)+180*60000).toISOString().slice(0,10)
  const { statusText: createFolderStatusText } = await disk.put('?'+
    qs.stringify({
      path: `/Заявки ХОНИНГОВАНИЕ.РУ/${createdLocalDate}_${deal.name}_${deal.id}`,
    })
  )
  console.log('createFolderStatusText > ', createFolderStatusText)
})

app.post('/lead/update', async (req, res) => {
  res.status(200).send('Request handled')
  const body = req.body
  console.log('/lead/update req body > ', JSON.stringify(body, null, 2))
  const deal = body.leads.update[0]
  const list = await disk.get('?'+
    qs.stringify({ path: `/Заявки ХОНИНГОВАНИЕ.РУ/`, })
  )
  console.log('list > ', list)
  const dealNames = list._embedded.items.filter(d => d.type === 'dir').map(({ name }) => name)
  console.log('dealNames > ', dealNames)
  // const { statusText: renameFolderStatusText } = await disk.patch('?'+
  //   qs.stringify({
  //     path: `/Заявки ХОНИНГОВАНИЕ.РУ/${createdLocalDate}_${deal.name}_${deal.id}`,
  //   })
  // )
  // console.log('renameFolderStatusText > ', renameFolderStatusText)
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
