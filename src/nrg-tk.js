import axios from 'axios'

const nrgTk = axios.create({
	baseURL: 'https://mainapi.nrg-tk.ru/v3',
	headers: {
		'NrgApi-DevToken': process.env.NRG_DEV_TOKEN,
		'Content-Type': 'application/json',
		'Accept': 'application/json'
	}
})

const login = async () => {
	const result = (await nrgTk.get(`/login`, {
		params: {
			user: process.env.NRG_USER,
			password: process.env.NRG_PASSWORD
		}
	}))?.data?.token
	return result
}

const getNrgSendings = async ({ beginDate, endDate }) => {
	const result = (await nrgTk.get(`/${process.env.NRG_ACCOUNT_ID}/${process.env.NRG_USER_ID}/sendings`, {
		params: {
			beginDate,
			endDate,
			token: await login()
		}
	}))?.data
	|| []
	
	//#region schema
	// result >  [
	// 	{
	// 		"id": 88145614963269,
	// 		"docNum": "7702-1234567",
	// 		"secondarySendingName": "7702-1234567",
	// 		"sendDate": 1624632960,
	// 		"clientFromFullTitle": "Петров Петр Петрович",
	// 		"clientToFullTitle": "ИП Иванов Иван Иванович",
	// 		"clientPayerFullTitle": "ИП Иванов Иван Иванович",
	// 		"clientFromAgent": "",
	// 		"idClientFrom": 88145614820123,
	// 		"idClientTo": 86981678683123,
	// 		"idClientPayer": 86981678683123,
	// 		"idCityFrom": 495,
	// 		"idCityTo": 4966,
	// 		"cityFromTitle": "МОСКВА",
	// 		"cityToTitle": "Коломна",
	// 		"idWareFrom": 20523,
	// 		"idWareTo": 20252,
	// 		"description": "",
	// 		"priceFreight": 490,
	// 		"priceCityFrom": 0,
	// 		"priceCityTo": 0,
	// 		"priceFee": 0,
	// 		"priceServiceFrom": 0,
	// 		"serviceFrom": 0,
	// 		"priceServiceTo": 0,
	// 		"priceCargo": 5800,
	// 		"weight": 58,
	// 		"volume": 0.0101,
	// 		"packaging": "БЕЗ УП",
	// 		"cargoname": "МЕТАЛЛИЧЕСКИЙ КРУГ",
	// 		"cargotype": 0,
	// 		"isDelivery": 0,
	// 		"isZayavka": 0,
	// 		"requestDate": 0,
	// 		"idTripType": 1,
	// 		"deliveryFromDate": 1624924800,
	// 		"deliveryToDate": 1625097600,
	// 		"place": 1,
	// 		"isSpCityFrom": 0,
	// 		"isSpCityTo": 0,
	// 		"isSpFreight": 0,
	// 		"isSpFee": 0,
	// 		"isSpServiceFrom": 0,
	// 		"isSpServiceTo": 0,
	// 		"states": [
	// 			{
	// 				"idState": 20,
	// 				"title": "Выдана",
	// 				"idSubState": 0,
	// 				"subStateTitle": "",
	// 				"movingDate": 1625657359,
	// 				"amount": 1,
	// 				"stateInfo": {
	// 					"idWare": 0,
	// 					"warehouse": null,
	// 					"trip": null,
	// 					"issued": {
	// 						"to": "ИвановИИИП",
	// 						"issueDate": 1625657365,
	// 						"idWare": 20252,
	// 						"warehouse": {
	// 							"id": 20252,
	// 							"title": "Коломна",
	// 							"address": "ул. Колхозная, 12 А, склад № 4",
	// 							"workTime": [
	// 								{
	// 									"day": 1,
	// 									"begin": "09:00",
	// 									"end": "18:00"
	// 								},
	// 								{
	// 									"day": 2,
	// 									"begin": "09:00",
	// 									"end": "18:00"
	// 								},
	// 								{
	// 									"day": 3,
	// 									"begin": "09:00",
	// 									"end": "18:00"
	// 								},
	// 								{
	// 									"day": 4,
	// 									"begin": "09:00",
	// 									"end": "18:00"
	// 								},
	// 								{
	// 									"day": 5,
	// 									"begin": "09:00",
	// 									"end": "18:00"
	// 								},
	// 								{
	// 									"day": 6,
	// 									"begin": "10:00",
	// 									"end": "14:00"
	// 								},
	// 								{
	// 									"day": 7,
	// 									"begin": "",
	// 									"end": ""
	// 								}
	// 							],
	// 							"phone": "+7-968-979-6313",
	// 							"email": "kolomna@nrg-tk.ru",
	// 							"zipcode": 140415,
	// 							"latitude": 55.0947,
	// 							"longitude": 38.7816,
	// 							"idCity": 4966,
	// 							"isInternal": 0,
	// 							"code": "5004",
	// 							"isIssuer": 1,
	// 							"type": 4
	// 						}
	// 					}
	// 				}
	// 			}
	// 		],
	// 		"isPaidSender": false,
	// 		"isPaidRecipient": true,
	// 		"addressRequest": "",
	// 		"addressDelivery": "",
	// 		"isPending": false,
	// 		"barcode": "",
	// 		"placeBarcodes": []
	// 	}
	// ]
	//#endregion
	return result
}
	

export {
	nrgTk,
	getNrgSendings
}