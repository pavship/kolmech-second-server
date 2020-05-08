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
	downloadMailAttachments,
} = require('./src/lead')

let lastUpdatedDeal = {}

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
		if (deal.id === lastUpdatedDeal.id && deal.updated_at - lastUpdatedDeal.created_at < 10 && !deal.link_changed)
		console.log(`deal ${deal.id} update handling skipped as duplicated event`)
		else {
			lastUpdatedDeal = deal
			const upsertInfo = await checkDealChanges(deal)
			if (deal.link_changed)
				return setTimeout(async () => {
					await downloadMailAttachments(deal, upsertInfo)
				}, 5000)
			await Promise.all([
				upsertDealDiskFolder(deal, upsertInfo),
				upsertDealMpProject(deal, upsertInfo)
			])
		}
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

var status = {}

app.post('/megaplan', async (req, res) => {
	try {
		res.status(200).send('Request handled')
		const {
			data,
			model,
			event
		} = req.body
		console.log('/megaplan model, event, data.id > ', model, event, data.id)
		// require('fs').writeFileSync('output.json', JSON.stringify(req.body, null, 2))
		status = {
			name: data.status,
			changeTime: data.statusChangeTime.value
		}
		console.log('status > ', status)
	} catch (err) {
		console.log('app.post(/megaplan) caught err.message > ', err.message)
	}
})

const port = process.env.PORT || 8000
app.listen(port, () => {
	console.log(`Listening on port ${port}!...`)
})


