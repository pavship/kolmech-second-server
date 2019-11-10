const axios = require('axios')
const qs = require('qs')

const disk = axios.create({
	baseURL: 'https://cloud-api.yandex.net/v1/disk/resources',
	headers: {
		'content-type': 'application/json',
		'Authorization': 'OAuth ' + process.env.DOCS_KOLMECH_TOKEN,
	}
})

const getDiskResources = async path => {
	const { data: { _embedded: { items: resources }}} = await disk.get('?'+
		qs.stringify({ path, limit: 10000 }))
	return resources
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
				parent: level1[i]
			}))
	})
	return resources
}

module.exports = { 
  disk,
  getDiskResources,
  getFolderName,
  getDiskResources2Levels
}