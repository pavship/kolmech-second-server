const express = require('express')
const app = express()

let counter = 0

app.get('/', (req, res) => {
  console.log('received request > ' + counter)
  res.send('Hello World!')
})

const port = process.env.PORT || 8000
app.listen(port, () => {
  console.log(`Listening on port ${port}!...`)
})
