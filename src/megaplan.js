const axios = require('axios')
const crypto = require('crypto')

const megaplan = async ( method, uri ) => {
  const date = new Date().toUTCString()
  const auth_key = process.env.MEGAPLAN_ACCESS_ID + ':' +
    Buffer.from(
      crypto
        .createHmac('sha1', process.env.MEGAPLAN_SECRET_KEY)
        .update([
          method,
          '',
          'application/x-www-form-urlencoded',
          date,
          process.env.MEGAPLAN_HOST + uri
        ].join('\n') )
        .digest('hex')
    ).toString('base64')
  try {
    const res = await axios.request({
			method: method.toLowerCase(),
			url: 'https://' + process.env.MEGAPLAN_HOST + uri,
      headers: {
        'Date': date,
        'X-Authorization': auth_key,
				'Accept': 'application/json',
				'Content-Type': 'application/x-www-form-urlencoded'
      },
    })
		// console.log('megaplan res.data > ', res.data)
		return res.data
    // console.log('megaplan res.data > ', JSON.stringify(res.data, null, 2))
  } catch (err) {
    // console.log('err > ', err)
    // console.log('err > ', JSON.stringify(err, null, 2))
		console.log('megaplan err.response > ', err.response)
  }
}

module.exports = { 
  megaplan
}