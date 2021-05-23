import dotenv from 'dotenv'
dotenv.config()

import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.PGCONSTRING
})

const pgQuery = async(text, params) => {
	return pool.query(text, params)
}

// // with logging
// const query = async (text, params) {
// 	const start = Date.now()
// 	const res = await pool.query(text, params)
// 	const duration = Date.now() - start
// 	console.log('executed query', { text, duration, rows: res.rowCount })
// 	return res
// }

export { pgQuery }