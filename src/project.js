import { megaplan_v3 } from './megaplan.js'

const getAllprojects = async() => {
  let items = []
  let pageAfterId = 0
  while (1 > 0) {
    const { data } = await megaplan_v3(
      'GET',
      '/api/v3/project?{"filter":{"id":252},"limit":100' + (pageAfterId ? `,"pageAfter":{"id":"${pageAfterId}","contentType":"Project"}` : '') + '}' // "fields":["parent"],
    )
    if (!data.length) return items
    items = [...items, ...data]
    pageAfterId = data[data.length - 1].id
    console.log('pageAfterId > ', pageAfterId)
  }
  return items
}

export { 
  getAllprojects
}
