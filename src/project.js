import { megaplan_v3 } from './megaplan.js'
// import fs from 'fs'

const getAllprojects = async() => {
	let items = []
	let outcasts = []
	let pageAfterId = 0
	let newItemsCount = 1
	while (newItemsCount) {
		const { data } = await megaplan_v3(
			'GET',
			'/api/v3/project?{"fields":["superProject"],"filter":{"id":252},"limit":100' + (pageAfterId ? `,"pageAfter":{"id":"${pageAfterId}","contentType":"Project"}` : '') + '}'
		)
		newItemsCount = data.length
		const newItems = data.map(item => {
			let superProject = item.superProject
			while (!!superProject?.humanNumber) {
				outcasts.push(JSON.parse(JSON.stringify(superProject, null, 2)))
				superProject = superProject.superProject
				// item.superProject = {
				// 	contentType: item.superProject.contentType,
				// 	id: item.superProject.id
				// }
			}
			return item
		})
		items = [...items, ...newItems]
		pageAfterId = data[data.length - 1]?.id
		console.log('pageAfterId > ', pageAfterId)
	}
	const result = items.map(item => {
		if (!item.humanNumber)
			return outcasts.find(o => o.id === item.id)
		else return item
	})
	// fs.writeFileSync('../output.json', JSON.stringify(result, null, 2))
	return result
}

export { 
	getAllprojects
}
