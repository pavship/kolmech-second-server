import { megaplan, megaplan_v3 } from './megaplan.js'

const getAllTasks = async() => {
	let items = []
	let outcasts = []
	let pageAfterId = 0
	let newItemsCount = 1
	while (newItemsCount) {
		const { data } = await megaplan_v3(
			'GET',
			'/api/v3/task?{"fields":["parent"],"filter":{"id":352},"limit":100' + (pageAfterId ? `,"pageAfter":{"id":"${pageAfterId}","contentType":"Task"}` : '') + '}'
		)
		newItemsCount = data.length
		const newItems = data.map(item => {
			if (!!item.parent?.humanNumber) {
				outcasts.push({ ...item.parent })
				item.parent = {
					contentType: item.parent.contentType,
					id: item.parent.id
				}
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
	return result
}

const getOneTask = async() => {
	const task = await megaplan(
		'GET',
		'/BumsTaskApiV01/Task/card.api?Id=1000042&RequestedFields=[Id,Name]'
	)
	return [task]
}

export { 
	getAllTasks,
	getOneTask,
}
