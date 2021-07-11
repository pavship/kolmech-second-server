import { stringify } from 'qs'
import { disk, getFolderName, getDiskResource2Levels, upload } from './disk.js'
import { megaplan } from './megaplan.js'
import { amoConnect, getDealNotes } from './amo.js'
import { getEmailAttachments } from './mail.js'

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

const dealsDirPath = '/Заявки ХОНИНГОВАНИЕ.РУ'

const composeDealName = deal => {
	const localCreatedDate = new Date(parseInt(deal.date_create + '000', 10)+180*60000).toISOString().slice(0,10)
	return `${localCreatedDate}_${deal.name}_${deal.id}`
}

const getDealMpId = async deal => {
	const mpIdCustomField = deal.custom_fields ? deal.custom_fields.find(cf => cf.name === 'mpId') : undefined
	let mpId = mpIdCustomField ? mpIdCustomField.values[0].value : undefined
	if (mpId) return mpId
	const { data: { projects } } = await megaplan(
		'GET',
		'/BumsProjectApiV01/Project/list.api?' + stringify({
			Search: deal.id
		}, { encodeValuesOnly: true })
	)
	return projects.length
		? projects[0].Id
		: console.log('getDealMpId > no megaplan.ru project for deal id ' + deal.id) || undefined
}

const checkDealChanges = async deal => {
	const { path: oldPath } = await getDiskResource2Levels(dealsDirPath, deal.id) || { path: undefined }
	const oldName = oldPath ? oldPath.slice(oldPath.lastIndexOf('/') + 1) : undefined
	const oldStatus = oldPath ? oldPath.slice(oldPath.lastIndexOf('_', oldPath.length - oldName.length - 2) + 1, oldPath.length - oldName.length - 1) : undefined
	const newStatusFolderName = await getFolderName(dealsDirPath, deal.status_id)
	const newName = composeDealName(deal)
	const newPath = `${dealsDirPath}/${newStatusFolderName}/${newName}`
	return {
		oldPath,
		oldName,
		oldStatus,
		newPath,
		newName
	}
}

const upsertDealDiskFolder = async (deal, { oldPath, newPath }) => {
	if (!oldPath) {
		const { statusText: createFolderStatusText } = await disk.put('?'+
			stringify({ path: newPath })
		)
		console.log('createFolderStatusText > ', createFolderStatusText)
	}
	if (oldPath && oldPath !== newPath) {
		const { statusText: moveFolderStatusText } = await disk.post('/move?'+
			stringify({ from: oldPath, path: newPath })
		)
		console.log('moveFolderStatusText > ', moveFolderStatusText)
	}
}

const deleteDealDiskFolder = async (deal) => {
	const { path, children } = await getDiskResource2Levels(dealsDirPath, deal.id)
	if (!path) return console.log('Не найдена папка сделки # ' + deal.id)
	const { statusText: deleteFolderStatusText } = await disk.delete('?'+
		stringify({ path, permanently: !children.length })
	)
	console.log('deleteFolderStatusText > ', deleteFolderStatusText)
}

const downloadMailAttachments = async (deal, { oldPath, newPath }) => {
	console.log('downloadMailAttachments > ')
	const lastEmail = (await getDealNotes(deal.id))
		.filter(note => note.note_type === 15)
		.pop()
	// console.log('lastEmail > ', lastEmail)
	if (!lastEmail) return console.log('downloadMailAttachments > deal emails not found')
	const { from, to, attach_cnt, delivery: { time } } = lastEmail.params
	if (!attach_cnt) return console.log('downloadMailAttachments > deal lastEmail has no attachments')
	const attachments = await getEmailAttachments(to.email, from.email, time)
	await Promise.all(attachments.map(att => upload(newPath + '/' + att.filename, att.data)))  
}

const upsertDealMpProject = async (deal, { oldPath, oldName, oldStatus, newPath, newName }) => {
	const mpId = await getDealMpId(deal)
	if (!oldPath && !mpId) {
		const { status, data } = await megaplan(
			'POST',
			'/BumsProjectApiV01/Project/create.api?' + stringify({
				Model: {
					Name: newName,
					AmoID: deal.id,
					Responsible: 1000005,
					SuperProject: 1000034
				}
			}, { encodeValuesOnly: true })
		)
		const { data: amoRes } = await (await amoConnect())
			.post('/api/v2/leads', {
				update: [{
					id: deal.id,
					updated_at: Math.round(Date.now()/1000),
					custom_fields: [{
						id: "666773",
						values: [{ value: data.project.Id }]
					}]
				}]
			})
		return
	}
	if (oldPath !== newPath) {
		if (oldName !== newName) {
			const { status } = await megaplan(
				'POST',
				'/BumsProjectApiV01/Project/edit.api?' + stringify({
					Id: mpId,
					Model: {
						Name: newName,
					}
				}, { encodeValuesOnly: true })
			)
			console.log('megaplan project edit status > ', status)
		}
		if (deal.status_id === '142') {
			const { status } = await megaplan(
				'POST',
				'/BumsProjectApiV01/Project/action.api?' + stringify({
					Id: mpId,
					Action: 'act_done'
				})
			)
			console.log('megaplan project act_done status > ', status)
		}
		if (deal.status_id === '143') {
			const { status } = await megaplan(
				'POST',
				'/BumsProjectApiV01/Project/action.api?' + stringify({
					Id: mpId,
					Action: 'act_expire'
				})
			)
			console.log('megaplan project act_expire (fail project) status > ', status)
		}
		if (['142', '143'].includes(oldStatus) && !['142', '143'].includes(deal.status_id)) {
			const { status } = await megaplan(
				'POST',
				'/BumsProjectApiV01/Project/action.api?' + stringify({
					Id: mpId,
					Action: 'act_renew'
				})
			)
			console.log('megaplan project act_renew status > ', status)
		}
	}
}

const deleteDealMpProject = async deal => {
	// const { data: {_embedded: { items: [ dealFull ] }}} = await (await amoConnect())
	//   .get(`/api/v2/leads?id=${deal.id}`)
	const mpId = await getDealMpId(deal)
	const { status } = await megaplan(
		'POST',
		'/BumsProjectApiV01/Project/action.api?' + stringify({
			Id: mpId,
			Action: 'act_delete'
		})
	)
	console.log('megaplan project delete status > ', status)
}

export {
	checkDealChanges,
	upsertDealDiskFolder,
	deleteDealDiskFolder,
	downloadMailAttachments,
	upsertDealMpProject,
	deleteDealMpProject
}