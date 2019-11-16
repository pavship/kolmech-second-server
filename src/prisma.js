const { Prisma } = require('prisma-binding')

const db = new Prisma({
  typeDefs: '../prisma/prisma.graphql', // the auto-generated GraphQL schema of the Prisma API
  endpoint: process.env.PRISMA_ENDPOINT,
  debug: false, // log all GraphQL queries & mutations sent to the Prisma API
  secret: process.env.PRISMA_SECRET,
})

module.exports = { 
  db
}