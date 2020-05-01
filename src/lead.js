const qs = require('qs')
const gql = require('graphql-tag')
const { disk, getFolderName, getDiskResource2Levels } = require('./disk')
const { megaplan } = require('./megaplan')
const { kolmech } = require('./kolmech')
const { amoConnect } = require('./amo')
const { mail } = require('./mail')

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
    '/BumsProjectApiV01/Project/list.api?' + qs.stringify({
      Search: deal.id
    }, { encodeValuesOnly: true })
  )
  if (!projects.length) console.log('Megaplan Project not found for AmoCRM Deal ' + deal.id)
  return projects.length ? projects[0].Id : undefined
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

  mail('sdf')

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

const deleteDealDiskFolder = async (deal) => {
  const { path, children } = await getDiskResource2Levels(dealsDirPath, deal.id)
  if (!path) return console.log('Не найдена папка сделки # ' + deal.id)
  const { statusText: deleteFolderStatusText } = await disk.delete('?'+
    qs.stringify({ path, permanently: !children.length })
  )
  console.log('deleteFolderStatusText > ', deleteFolderStatusText)
}

const upsertDealMpProject = async (deal, { oldPath, oldName, oldStatus, newPath, newName }) => {
  const mpId = await getDealMpId(deal)
  if (!oldPath && !mpId) {
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
    if (oldName !== newName) {
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
    if (deal.status_id === '142') {
      const { status } = await megaplan(
        'POST',
        '/BumsProjectApiV01/Project/action.api?' + qs.stringify({
          Id: mpId,
          Action: 'act_done'
        })
      )
      console.log('megaplan project act_done status > ', status)
    }
    if (deal.status_id === '143') {
      const { status } = await megaplan(
        'POST',
        '/BumsProjectApiV01/Project/action.api?' + qs.stringify({
          Id: mpId,
          Action: 'act_expire'
        })
      )
      console.log('megaplan project act_expire (fail project) status > ', status)
    }
    console.log('oldStatus > ', oldStatus)
    if (['142', '143'].includes(oldStatus) && !['142', '143'].includes(deal.status_id)) {
      const { status } = await megaplan(
        'POST',
        '/BumsProjectApiV01/Project/action.api?' + qs.stringify({
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
    '/BumsProjectApiV01/Project/action.api?' + qs.stringify({
      Id: mpId,
      Action: 'act_delete'
    })
  )
  console.log('megaplan project delete status > ', status)
}

const upsertMpProjectKolmechRecord = async project => {
  try {
    const ar = []
    for (let i = 93; i < 369; i + 10) {
      ar.push(i)
    }
    console.log('ar > ', ar)
    for (let num of ar) {
      const nums = []
      for (let i = 0; i < 10; i++) {
        nums[i] = i + num
      }
      // const statuses = await Promise.all(nums.map(async mpId => {
      //   const { status } = await megaplan(
      //     'POST',
      //     '/BumsProjectApiV01/Project/action.api?' + qs.stringify({
      //       Id: mpId,
      //       Action: 'act_delete'
      //     })
      //   )
      //   return mpId + ' ' + status
      // }))
      console.log('num > ', num)
      console.log('nums > ', nums)
      // console.log(num + 'statuses > ', statuses)
    }
    console.log('megaplan project delete status > ', status)
  } catch (err) {
    console.log('err > ', err)
    
  }

}

module.exports = {
  checkDealChanges,
  upsertDealDiskFolder,
  deleteDealDiskFolder,
  upsertDealMpProject,
  deleteDealMpProject,
  upsertMpProjectKolmechRecord
}