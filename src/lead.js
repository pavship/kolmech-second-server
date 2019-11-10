const qs = require('qs')
const { disk, getFolderName, getDiskResources, getDiskResources2Levels } = require('./disk')

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

const upsertDealDiskFolder = async deal => {
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
}

const deleteDealDiskFolder = async deal => {
  const resourses = await getDiskResources2Levels(dealsDirPath)
  const resourse = resourses.find(r => r.id === deal.id)
  if (!resourse) throw new Error('Не найдена папка удаляемой сделки # ' + deal.id)
  const dealFolderPath = `${dealsDirPath}/${resourse.parent}/${resourse.name}`
  const dealResourses = await getDiskResources(dealFolderPath)
  const { statusText: deleteFolderStatusText } = await disk.delete('?'+
    qs.stringify({ path: dealFolderPath, permanently: !dealResourses.length })
  )
  console.log('deleteFolderStatusText > ', deleteFolderStatusText)
}

module.exports = { 
  upsertDealDiskFolder,
  deleteDealDiskFolder
}