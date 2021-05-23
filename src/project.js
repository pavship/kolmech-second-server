import { megaplan_v3 } from './megaplan'

const getAllprojects = async() => {
  let tasks = []
  let pageAfterId = 0
  while (1 > 0) {
    const { data } = await megaplan_v3(
      'GET',
      '/api/v3/project?{"filter":{"id":252},"limit":100' + (pageAfterId ? `,"pageAfter":{"id":"${pageAfterId}","contentType":"Task"}` : '') + '}' // "fields":["parent"],
    )
    if (!data.length) return tasks
    tasks = [...tasks, ...data]
    pageAfterId = data[data.length - 1].id
    console.log('pageAfterId > ', pageAfterId)
  }
  return tasks
}

export default { 
  getAllprojects
}
