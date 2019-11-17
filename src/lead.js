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

const getDealMpId = deal => {
  const mpIdCustomField = deal.custom_fields.find(cf => cf.name === 'mpId')
  return mpIdCustomField ? mpIdCustomField.values.value : undefined
}

const checkDealChanges = async deal => {
  const resource = await getDiskResource2Levels(dealsDirPath, deal.id)
  const newStatusFolderName = await getFolderName(dealsDirPath, deal.status_id)
  const newName = composeDealName(deal)
  const newPath = `${dealsDirPath}/${newStatusFolderName}/${newName}`
  return {
    oldPath: resource ? resource.path : undefined,
    diskChildren: resource ? resource.children : [],
    newPath,
    newName
  }
}

const upsertDealDiskFolder = async (deal, { oldPath, newPath }) => {
  if (!oldPath) {
    const { statusText: createFolderStatusText } = await disk.put('?'+
      qs.stringify({ path: newPath })
    )
    console.log('createFolderStatusText > ', createFolderStatusText)
    return
  }
  if (oldPath !== newPath) {
    const { statusText: moveFolderStatusText } = await disk.post('/move?'+
      qs.stringify({ from: oldPath, path: newPath })
    )
    console.log('moveFolderStatusText > ', moveFolderStatusText)
  }
}

const deleteDealDiskFolder = async (deal, { oldPath, diskChildren }) => {
  if (!oldPath) return console.log('Не найдена папка сделки # ' + deal.id)
  const { statusText: deleteFolderStatusText } = await disk.delete('?'+
    qs.stringify({ oldPath, permanently: !diskChildren.length })
  )
  console.log('deleteFolderStatusText > ', deleteFolderStatusText)
}

const upsertDealMpProject = async (deal, { oldPath, newPath, newName }) => {
  if (!oldPath) {
    const { status, data } = await megaplan(
      'POST',
      '/BumsProjectApiV01/Project/create.api?' + qs.stringify({
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
    const mpId = getDealMpId(deal)
    const { status } = await megaplan(
      'POST',
      '/BumsProjectApiV01/Project/edit.api?' + qs.stringify({
        Id: mpId,
        Model: {
          Name: newName,
        }
      }, { encodeValuesOnly: true })
    )
    console.log('megaplan project edit status > ', status)
  }
}

const deleteDealMpProject = async deal => {
  // const { data: {_embedded: { items: [ dealFull ] }}} = await (await amoConnect())
  //   .get(`/api/v2/leads?id=${deal.id}`)
  // const mpId = getDealMpId(dealFull)
  const { data: { projects: [{ Id: mpId }]} } = await megaplan(
    'GET',
    '/BumsProjectApiV01/Project/list.api?' + qs.stringify({
      Search: deal.id
    }, { encodeValuesOnly: true })
  )
  const { status, data } = await megaplan(
    'POST',
    '/BumsProjectApiV01/Project/action.api?' + qs.stringify({
      Id: mpId,
      Action: 'act_delete'
    }, { encodeValuesOnly: true })
  )
}

module.exports = {
  checkDealChanges,
  upsertDealDiskFolder,
  deleteDealDiskFolder,
  upsertDealMpProject,
  deleteDealMpProject
}