import axios from 'axios'
import { stringify } from 'qs'
// const { sendDevMessage } = require('./telegram.js')

const disk = axios.create({
	baseURL: 'https://cloud-api.yandex.net/v1/disk/resources',
	headers: {
		'content-type': 'application/json',
		'Authorization': 'OAuth ' + process.env.DOCS_KOLMECH_TOKEN,
	}
})

// {
//   "name": "2019-09-30_Рама велосипеда_21502237",
//   "exif": {},
//   "created": "2019-09-30T06:29:47+00:00",
//   "resource_id": "873797308:75e38fb4536207ea11b79f782f2fdf36cc84c4fa647a1acb1304936eaace2850",
//   "share": {
//     "is_root": false,
//     "is_owned": true,
//     "rights": "rw"
//   },
//   "modified": "2019-11-08T23:45:57+00:00",
//   "path": "disk:/Заявки ХОНИНГОВАНИЕ.РУ/93_Закрыто и не реализовано_143/2019-09-30_Рама велосипеда_21502237",
//   "comment_ids": {
//     "private_resource": "873797308:75e38fb4536207ea11b79f782f2fdf36cc84c4fa647a1acb1304936eaace2850",
//     "public_resource": "873797308:75e38fb4536207ea11b79f782f2fdf36cc84c4fa647a1acb1304936eaace2850"
//   },
//   "type": "dir",
//   "revision": 1573256757670060
// }

const getDiskResources = async path => {
	const { data: { _embedded: { items: resources }}} = await disk.get('?'+
		stringify({ path, limit: 10000 }))
	// console.log('resources > ', resources)
	// [
	// 	{
	// 		name: 'Инновационные Решения',
	// 		exif: {},
	// 		created: '2020-02-02T17:04:13+00:00',
	// 		resource_id: '873797308:00c164aa65ac4f81dc8f3a7d6700d1ff41181736e5f35b7013',
	// 		share: { is_root: false, is_owned: true, rights: 'rw' },
	// 		modified: '2020-02-02T17:04:13+00:00',
	// 		path: 'disk:/Компании/Инновационные Решения',
	// 		comment_ids: {
	// 			private_resource: '873797308:00c164aa65ac4f81dc8f3a7d61c9eff41181736e5f35b7013',
	// 			public_resource: '873797308:00c164aa65ac4f81dc8f3a7fdfcfee700d1ff41181736e5f35b7013'
	// 		},
	// 		type: 'dir',
	// 		revision: 1580663053903086
	// 	},
	// 	{
	// 		name: 'Ваникор ГТ_58854281',
	// 		exif: {},
	// 		created: '2019-08-26T10:37:05+00:00',
	// 		resource_id: '873797308:ef68e7c886b712f37d71024ed4fb8191c111d70bdb10e42953db8a',
	// 		share: { is_root: false, is_owned: true, rights: 'rw' },
	// 		modified: '2019-08-26T10:37:05+00:00',
	// 		path: 'disk:/Компании/Ваникор ГТ_58854281',
	// 		comment_ids: {
	// 			private_resource: '873797308:ef68e7c886b712f37d71024ed4f7f1c111d70bdb10e42953db8a',
	// 			public_resource: '873797308:ef68e7c886b712f37d71024ed4fb819a0bdb10e42953db8a'
	// 		},
	// 		type: 'dir',
	// 		revision: 1566815825521169
	// 	},
	// 	... 162 more items
	// ]
	return resources
}

const getDiskResource = async (path, id) => {
  const resources = await getDiskResources(path)
	// resources.forEach(r => console.log('r.name.slice(-id.length), id > ', r.name.slice(-id.length), id))
  const resource = resources.find(r => r.name.slice(-8) == id)
  if (!resource) return null
  return {
    ...resource,
    children: await getDiskResources(resource.path)
  }
}

const getFolderName = async (path, id) => {
	const dirFoldersNames = (await getDiskResources(path))
		.filter(r => r.type === 'dir').map(({ name }) => name)
	return dirFoldersNames.find(n => n.slice(-id.length) === id)
}

const getDiskResources2Levels = async path => {
	const level1 = (await getDiskResources(path))
		.filter(r => r.type === 'dir')
		.map(({ name }) => name)
	const level2 = await Promise.all(level1.map(folder => getDiskResources(`${path}/${folder}`)))
  const resources = []
	level2.forEach((rs, i) => {
		rs.filter(r => r.type === 'dir')
			.forEach(r => resources.push({
				name: r.name,
				id: r.name.slice(r.name.lastIndexOf('_') + 1),
        parent: level1[i],
        path: r.path.slice(5)
			}))
  })
	return resources
}

const getDiskResource2Levels = async (path, id) => {
  const resources = await getDiskResources2Levels(path)
  const resource = resources.find(r => r.id === id)
  if (!resource) return
  return {
    ...resource,
    children: await getDiskResources(resource.path)
  }
}

const getResourceUploadUrl = async (path, overwrite = true) => {
	console.log('getResourceUploadUrl > path > ', path)
	try {
		const { data: { href }} = await disk.get('/upload?'+
			stringify({ path, overwrite }))
		console.log('upload href > ', href)
		return href
	} catch (err) {
		console.log('disk > getResourceUploadUrl error')
		console.log('err > ', err)
	}
}

const upload = async (path, buffer) => {
	try {
		axios.put(
			await getResourceUploadUrl(path),
			buffer,
			{ responseType: 'arraybuffer'}
		)
	} catch (err) {
		console.log('disk > upload error for path > ', path)
		// sendDevMessage(`kolmech-second-server > disk > upload error for path > ${path}`)
	}
}

export {
	disk,
  getDiskResources,
	getDiskResource,
  getFolderName,
  getDiskResources2Levels,
	getDiskResource2Levels,
	upload
}