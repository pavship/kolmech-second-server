import axios from 'axios'

const moedelo = axios.create({
	baseURL: 'https://restapi.moedelo.org',
  headers: {
    'md-api-key': process.env.MOEDELO_SECRET,
    'Content-Type': 'application/json',
  }
})

export {
	moedelo
}