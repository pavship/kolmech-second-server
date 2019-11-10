const express = require('express')
const app = express()
require('dotenv').config()
const qs = require('qs')
app.use(express.json())
app.use(express.urlencoded())

const { disk, getFolderName, getDiskResources, getDiskResources2Levels } = require('./src/disk')

const dealsDirPath = '/Заявки ХОНИНГОВАНИЕ.РУ'

const skipStatusId = '24659131' //leads with this (PROJECTS) status are not handled

// const deal = {
// 	id: "164837",
// 	name: "Разработка интернет-магазина",
// 	status_id: "27256984",
// 	old_status_id: "27256981",
// 	price: "",
// 	responsible_user_id: "3458350",
// 	last_modified: "1556933093",
// 	modified_user_id: "3458350",
// 	created_user_id: "3458350",
// 	date_create: "1556927568",
// 	pipeline_id: "1779352",
// 	account_id: "27256969"
// }

app.get('/', (req, res) => {
	res.send('Hello World!')
})

// app.post('/lead/status', async (req, res) => {
// 	try {
// 		res.status(200).send('Request handled')
// 		const body = req.body
// 		console.log('/lead/status req body > ', JSON.stringify(body, null, 2))
// 		const deal = body.leads.status[0]
// 		console.log('deal > ', deal)
// 		if (deal.status_id === skipStatusId) return console.log('skipped project type deal <')
// 		const createdLocalDate = new Date(parseInt(deal.date_create + '000', 10)+180*60000).toISOString().slice(0,10)
// 		const { statusText: createFolderStatusText } = await disk.put('?'+
// 			qs.stringify({
// 				path: `${dealsDirPath}/${createdLocalDate}_${deal.name}_${deal.id}`,
// 			})
// 		)
// 		console.log('createFolderStatusText > ', createFolderStatusText)
// 	} catch (err) {
// 		console.log('err.message > ', err.message)
// 	}
// })


app.post('/lead/update', async (req, res) => {
	try {
		res.status(200).send('Request handled')
		const deal = req.body.leads.add
			? req.body.leads.add[0]
			: req.body.leads.update[0]
		console.log('/lead/update deal > ', deal)
		if (deal.status_id === skipStatusId) return console.log('skipped project type deal <')
		const oldStatusFolderName = await getFolderName(dealsDirPath, deal.old_status_id)
		const newStatusFolderName = await getFolderName(dealsDirPath, deal.status_id)
		const oldFolderName = oldStatusFolderName
			&& await getFolderName(dealsDirPath +'/' + oldStatusFolderName, deal.id)
		if (!oldFolderName) {
			const localCreatedDate = new Date(parseInt(deal.date_create + '000', 10)+180*60000).toISOString().slice(0,10)
			const { statusText: createFolderStatusText } = await disk.put('?'+
				qs.stringify({
					path: `${dealsDirPath}/${newStatusFolderName}/${localCreatedDate}_${deal.name}_${deal.id}`,
				})
			)
			console.log('createFolderStatusText > ', createFolderStatusText)
			return
		}
		const newFolderName = `${oldFolderName.slice(0, oldFolderName.indexOf('_'))}_${deal.name}_${deal.id}`
		const { statusText: renameFolderStatusText } = await disk.post('/move?'+
			qs.stringify({
				from: `${dealsDirPath}/${oldStatusFolderName}/${oldFolderName}`,
				path: `${dealsDirPath}/${newStatusFolderName}/${newFolderName}`,
			})
		)
		console.log('renameFolderStatusText > ', renameFolderStatusText)
	} catch (err) {
		console.log('err.message > ', err.message)
	}
})

app.post('/lead/delete', async (req, res) => {
	try {
		res.status(200).send('Request handled')
		const deal = req.body.leads.delete[0]
		console.log('/lead/delete deal > ', deal)
		const resourses = await getDiskResources2Levels(dealsDirPath)
		const resourse = resourses.find(r => r.id === deal.id)
		if (!resourse) throw new Error('Не найдена папка удаляемой сделки # ' + deal.id)
		const dealFolderPath = `${dealsDirPath}/${resourse.parent}/${resourse.name}`
		const dealResourses = await getDiskResources(dealFolderPath)
		const { statusText: deleteFolderStatusText } = await disk.delete('?'+
			qs.stringify({ path: dealFolderPath, permanently: !dealResourses.length })
		)
		console.log('deleteFolderStatusText > ', deleteFolderStatusText)
	} catch (err) {
		console.log('err.message > ', err.message)
	}
})

const port = process.env.PORT || 8000
app.listen(port, () => {
	console.log(`Listening on port ${port}!...`)
})


