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

// // Deprecated legacy use V3
// const getAllTasksV1 = async() => {
//   const results = await Promise.all([0, 100, 200, 300, 400, 500, 600, 700].map(offset =>
//     megaplan(
//         'GET',
//         '/BumsTaskApiV01/Task/list.api?Limit=100&RequestedFields=[Id,Name]&Offset=' + offset
//       )
//   ))
//   const tasks = results.reduce((tasks, res) => [...tasks, ...res.data.tasks], [])
//   return tasks
// }

// const trackTask = async(id, status) => {
//   if (status.name === 'accepted') {
//     const res = await pgRequest('SELECT 1 FROM tasklog WHERE id = $1 AND "from" = $2', [id, status.changeTime])
//     // const res = await pgRequest('SELECT 1 FROM tasklog WHERE id = $1 AND "from" = $2', [1000332, '2020-03-06T22:03:31+00:00'])
//     console.log('res.rowCount > ', res.rowCount, res.rowCount > 0 ? '> skip' : '')
//     if (res.rowCount > 0) return null
//     const res1 = await pgRequest('INSERT INTO tasklog VALUES ($1, $2)', [id, status.changeTime])
//     console.log(id, status.name, 'res1.rowCount > ', res1.rowCount)
//   }
//   if (['delayed', 'cancelled', 'expired', 'done', 'completed'].includes(status.name)) {
//     const res = await pgRequest('UPDATE tasklog SET "to" = $2 WHERE id = $1 AND "to" IS NULL', [id, status.changeTime])
//     console.log(id, status.name, 'res.rowCount > ', res.rowCount)
//   }
//   return null
// }

// const getTaskLog = async() => {
//   //const res = await pgRequest(`SELECT id, "from" AT TIME ZONE 'msk' as "from", "to" AT TIME ZONE 'msk' as "to", ROUND((EXTRACT(EPOCH FROM "to"-"from")/3600)::numeric, 2) as "dur" FROM tasklog`)
//   const res = await pgRequest(`SELECT id, "from", "to", ROUND((EXTRACT(EPOCH FROM "to"-"from")/3600)::numeric, 2) as "dur" FROM tasklog`)
//   return res.rows
// }

export { 
  getAllTasks,
  getOneTask,
  // trackTask,
  // getTaskLog
}
