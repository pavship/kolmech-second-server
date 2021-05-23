import { request } from 'axios'
import { createHmac } from 'crypto'
import FormData from 'form-data'

const v3credentials = {
	access_token: '',
	expires_at: Date.now(),
}

const megaplan_v3 = async ( method, uri, data ) => {
	// 1. authorize if needed
	if (Date.now() >= v3credentials.expires_at) {
		const form = new FormData()
		form.append('username', process.env.MEGAPLAN_USERNAME)
		form.append('password', process.env.MEGAPLAN_PASSWORD)
		form.append('grant_type', 'password')
		const headers = form.getHeaders()
		try {
			const res = await request({
				method: 'post',
				url: 'https://' + process.env.MEGAPLAN_HOST + '/api/v3/auth/access_token',
				headers,
				data: form
			})
			v3credentials.access_token = res.data.access_token
			v3credentials.expires_at = Date.now() + res.data.expires_in
		} catch (err) {
			console.log('megaplan v3 authorization err.response > ', err.response)
			return err
		}
	}
	try {
		const res = await request({
			method: method.toLowerCase(),
			url: 'https://' + process.env.MEGAPLAN_HOST + uri,
			headers: {
				'Authorization': 'Bearer ' + v3credentials.access_token,
				'Accept': 'application/json',
				// 'Content-Type': 'application/x-www-form-urlencoded'
			},
			...data && { data }
		})
		// console.log('megaplan v3 res.data > ', JSON.stringify(res.data, null, 2))
		return res.data
	} catch (err) {
		console.log('megaplan v3 err.response > ', err.response)
		return err
	}
}

// DEPRECATED legacy, use megaplan_v3 above
const megaplan = async ( method, uri, data ) => {
	const date = new Date().toUTCString()
	const auth_key = process.env.MEGAPLAN_ACCESS_ID + ':' +
		Buffer.from(
			createHmac('sha1', process.env.MEGAPLAN_SECRET_KEY)
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
		const res = await request({
			method: method.toLowerCase(),
			url: 'https://' + process.env.MEGAPLAN_HOST + uri,
			headers: {
				'Date': date,
				'X-Authorization': auth_key,
				'Accept': 'application/json',
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			...data && { data }
		})
		// console.log('megaplan res.data > ', JSON.stringify(res.data, null, 2))
		return res.data
	} catch (err) {
		// console.log('err > ', err)
		// console.log('err > ', JSON.stringify(err, null, 2))
		console.log('megaplan err.response > ', err.response)
	}
}

export default { 
	megaplan,
	megaplan_v3
}
