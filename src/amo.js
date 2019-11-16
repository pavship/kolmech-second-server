const { db } = require('./prisma')

const process = async () => {
  const res = await db.query.serverDatas({}, '{ id amoExpiresAt, amoCookie }')
  console.log('res > ', res)
}

module.exports = { 
  process
}
