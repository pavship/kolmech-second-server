import dotenv from 'dotenv'
import pg from 'pg'
import pgPromise from 'pg-promise'

dotenv.config()


const pool = new pg.Pool({
  connectionString: process.env.PGCONSTRING
})

const pgQuery = async(text, params) => {
	return pool.query(text, params)
}

const pgp = pgPromise()
pgp.pg.types.setTypeParser(1700, parseFloat);
const db = pgp(process.env.PGCONSTRING)

// // with logging
// const query = async (text, params) {
// 	const start = Date.now()
// 	const res = await pool.query(text, params)
// 	const duration = Date.now() - start
// 	console.log('executed query', { text, duration, rows: res.rowCount })
// 	return res
// }




export { pgQuery, db }