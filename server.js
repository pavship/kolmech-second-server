const express = require('express')
const app = express()
require('dotenv').config()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const { checkDealChanges, upsertDealDiskFolder, deleteDealDiskFolder, upsertDealMpProject, deleteDealMpProject } = require('./src/lead')

app.get('/', (req, res) => {
	res.send('Hello World!')
})

app.post('/lead/update', async (req, res) => {
	try {
		res.status(200).send('Request handled')
		const deal = req.body.leads.add
			? req.body.leads.add[0]
			: req.body.leads.update[0]
		console.log('/lead/update deal > ', deal)
		const upsertInfo = await checkDealChanges(deal)
		await Promise.all([
			upsertDealDiskFolder(deal, upsertInfo),
			upsertDealMpProject(deal, upsertInfo)
		])
	} catch (err) {
		console.log('app.post(/lead/update) caught err.message > ', err.message)
	}
})

app.post('/lead/delete', async (req, res) => {
	try {
		res.status(200).send('Request handled')
		const deal = req.body.leads.delete[0]
		console.log('/lead/delete deal > ', deal)
		await Promise.all([
			deleteDealDiskFolder(deal),
			deleteDealMpProject(deal)
		])
	} catch (err) {
		console.log('app.post(/lead/delete) caught err.message > ', err.message)
	}
})

const port = process.env.PORT || 8000
app.listen(port, () => {
	console.log(`Listening on port ${port}!...`)
})


