const qs = require('qs')
const { disk, getFolderName, getDiskResource2Levels } = require('./disk')
const { megaplan } = require('./megaplan')
const { amoConnect } = require('./amo')

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

const upsertDealDiskFolder = async deal => {
  const resource = await getDiskResource2Levels(dealsDirPath, deal.id)
  const newStatusFolderName = await getFolderName(dealsDirPath, deal.status_id)
  const newPath = `${dealsDirPath}/${newStatusFolderName}/${composeDealName(deal)}`
  if (!resource) {
    const { statusText: createFolderStatusText } = await disk.put('?'+
      qs.stringify({
        path: newPath,
      })
    )
    console.log('createFolderStatusText > ', createFolderStatusText)
    return
  }
  const { statusText: renameFolderStatusText } = await disk.post('/move?'+
    qs.stringify({
      from: resource.path,
      path: newPath,
    })
  )
  console.log('renameFolderStatusText > ', renameFolderStatusText)
}

const deleteDealDiskFolder = async deal => {
  const resource = await getDiskResource2Levels(dealsDirPath, deal.id)
  if (!resource) return console.log('Не найдена папка сделки # ' + deal.id)
  const { path, children } = resource
  const { statusText: deleteFolderStatusText } = await disk.delete('?'+
    qs.stringify({ path, permanently: !children.length })
  )
  console.log('deleteFolderStatusText > ', deleteFolderStatusText)
}

const upsertDealMpProject = async deal => {
  if (!deal.custom_fields) {
    const { status, data } = await megaplan(
      'POST',
      '/BumsProjectApiV01/Project/create.api?' + qs.stringify({
        Model: {
          Name: composeDealName(deal),
          Responsible: 1000005,
          SuperProject: 1000034
        }
      }, { encodeValuesOnly: true })
    )
    console.log('data.project.Id > ', data.project.Id)
  }
  // const mpIdCustomField = deal.custom_fields.find(cf => cf.name === 'mpId')
}

const deleteDealMpProject = async deal => {
  const { data: {_embedded: { items: [ company ] }}} = await (await amoConnect())
    .get(`api/v2/companies?id=${'66968371'}`)
  console.log('company > ', company)
}

module.exports = { 
  upsertDealDiskFolder,
  deleteDealDiskFolder,
  upsertDealMpProject,
  deleteDealMpProject
}