const express = require('express')
const app = express()
require('dotenv').config()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const {
	checkDealChanges, 
	upsertDealDiskFolder, 
	deleteDealDiskFolder, 
	upsertDealMpProject, 
	deleteDealMpProject,
	upsertMpProjectKolmechRecord
} = require('./src/lead')

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

app.post('/megaplan', async (req, res) => {
	try {
		res.status(200).send('Request handled')
		const {
			data,
			model,
			event
		} = req.body
		console.log('/megaplan model, event, data.id > ', model, event, data.id)
		if (model === 'Project' && ['on_after_create', 'on_after_update', 'on_after_drop'].includes(event)) {
			await upsertMpProjectKolmechRecord(data)
		}
	} catch (err) {
		console.log('app.post(/megaplan) caught err.message > ', err.message)
	}
})

upsertMpProjectKolmechRecord({id: 1})

const port = process.env.PORT || 8000
app.listen(port, () => {
	console.log(`Listening on port ${port}!...`)
})


