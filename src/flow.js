const axios = require('axios')
const qs = require('qs')
// const { sendDevMessage } = require('./telegram')

const honingAccounting = axios.create({
	baseURL: 'https://prod-188.westus.logic.azure.com:443/workflows/4738f8e02a1f4d02ba1266179e8ac3f4/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=SI4cXCZwjOVJs0NseQBcHpefW_XVNiFm6K_1zwKWhrI',
	headers: {
		'content-type': 'application/json',
	}
})

const sendTaskToFlow = async task => {
	const res = await honingAccounting.post({
		hello: 'world'
	})
	console.log('res > ', res)
}

module.exports = {
  sendTaskToFlow
}