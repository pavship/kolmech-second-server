const { GraphQLClient  } = require('graphql-request')

const kolmech = new GraphQLClient(
  process.env.KOLMECH_HOST, {
    headers: {
      authorization: 'Bearer ' + process.env.KOLMECH_ACCESS_TOKEN,
    },
  }
)

module.exports = { 
  kolmech
}