const express = require('express')
const app = express()

app.use(express.json())

let getCounter = 1
let postCounter = 1

app.get('/', (req, res) => {
  console.log('received GET request > ' + getCounter++)
  res.send('Hello World!')
})

app.post('/', (req, res) => {
  console.log('received POST request > ' + postCounter++)
  const body = req.body
  console.log('body > ', body)
  res.status(200).send('Request handled')
})

const port = process.env.PORT || 8000
app.listen(port, () => {
  console.log(`Listening on port ${port}!...`)
})
