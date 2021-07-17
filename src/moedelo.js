import axios from 'axios'

const moedelo = axios.create({
	baseURL: 'https://restapi.moedelo.org',
	headers: {
		'md-api-key': process.env.MOEDELO_SECRET,
		'Content-Type': 'application/json',
	}
})

const getOrg = async ({ inn, name }) => {
	let result
	result = (await moedelo.get(`/kontragents/api/v1/kontragent`, {
		params: {
			pageSize: 1000000,
			...inn ? { inn } : {name}
		}
	}))?.data?.ResourceList?.[0]
	|| inn && (await moedelo.post(`/kontragents/api/v1/kontragent/inn`, { Inn: inn }))?.data
	|| null
	
	//#region schema
	// console.log('result > ', result)
	// result >  {
	// 	Id: 12345678,
	// 	Inn: '7705705370',
	// 	Ogrn: '1057749440781',
	// 	Okpo: null,
	// 	Kpp: '770501001',
	// 	Name: 'АО "ЦЕНТРАЛЬНАЯ ППК"',
	// 	ShortName: 'АО "ЦЕНТРАЛЬНАЯ ППК"',
	// 	Type: 1,
	// 	Form: 1,
	// 	IsArchived: false,
	// 	LegalAddress: '115054, МОСКВА ГОРОД, ПАВЕЛЕЦКАЯ ПЛОЩАДЬ, д. 1А',
	// 	ActualAddress: null,
	// 	RegistrationAddress: null,
	// 	TaxpayerNumber: null,
	// 	AdditionalRegNumber: null,
	// 	SubcontoId: 107499550,
	// 	Fio: null,
	// 	SignerFio: 'ИВАНОВ ИВАН ИВАНОВИЧ',
	// 	InFace: null,
	// 	Position: null,
	// 	InReason: null,
	// 	PersonalData: null
	// }
	//#endregion
	return result
}
	

export {
	moedelo,
	getOrg
}