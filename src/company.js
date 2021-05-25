import bot from '../bot.js'
import { amoConnect, findAmoCompany } from './amo.js'
import { disk, getDiskResource } from './disk.js'
import { endJob, setStore } from './user.js'
import { stringify } from 'qs'
// docxtemplater deps:
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import { moedelo } from './moedelo.js'

const companiesDirPath = '/Компании'

export async function handleCompany(data) {
	const { user, msg } = data
	const id = msg.text.match(/detail\/(\d+)/)[1]
	data.company = await findAmoCompany(id)
	// console.log('company > ', JSON.stringify(data.company, null, 2))
	// company >  {
	// 	id: 88252187,
	// 	name: 'Ромашка',
	// 	responsible_user_id: 3405940,
	// 	created_by: 3405940,
	// 	created_at: 1621835455,
	// 	updated_at: 1621835455,
	// 	account_id: 24238705,
	// 	updated_by: 3405940,
	// 	group_id: 232951,
	// 	leads: { id: [ 24123361 ], _links: { self: [Object] } },
	// 	closest_task_at: 0,
	// 	tags: {},
	// "custom_fields": [
	// 	{
	// 		"id": 317993,
	// 		"name": "Web",
	// 		"type_id": 7,
	// 		"code": "WEB",
	// 		"values": [
	// 			{
	// 				"value": "http://metallo.ru"
	// 			}
	// 		],
	// 		"is_system": true
	// 	},
	// 	{
	// 		"id": 317991,
	// 		"name": "Email",
	// 		"type_id": 8,
	// 		"code": "EMAIL",
	// 		"values": [
	// 			{
	// 				"value": "info@metallo.ru",
	// 				"enum": 499371
	// 			}
	// 		],
	// 		"is_system": true
	// 	},
	// 	{
	// 		"id": 629178,
	// 		"name": "Примечания",
	// 		"type_id": 1,
	// 		"values": [
	// 			{
	// 				"value": "Примечание"
	// 			}
	// 		],
	// 		"is_system": false
	// 	},
	// 	{
	// 		"id": 437899,
	// 		"name": "ИНН",
	// 		"type_id": 2,
	// 		"values": [
	// 			{
	// 				"value": "744718888838"
	// 			}
	// 		],
	// 		"is_system": false
	// 	},
	// 	{
	// 		"id": 660573,
	// 		"name": "Почтовый адрес",
	// 		"type_id": 1,
	// 		"values": [
	// 			{
	// 				"value": "454001, Челябинск, ул. Виктора,  29, кв. 108"
	// 			}
	// 		],
	// 		"is_system": false
	// 	},
	// {
	// 	"id": 317989,
	// 	"name": "Телефон",
	// 	"type_id": 8,
	// 	"code": "PHONE",
	// 	"values": [
	// 		{
	// 			"value": "+79261234567",
	// 			"enum": 499359
	// 		}
	// 	],
	// 	"is_system": true
	// }
	// ],
	// "contacts": {
	// 	"id": [
	// 		87368325
	// 	],
	// 	"_links": {
	// 		"self": {
	// 			"href": "/api/v2/contacts?id=87368325",
	// 			"method": "get"
	// 		}
	// 	}
	// },
	// 	customers: {},
	// 	_links: { self: { href: '/api/v2/companies?id=88252187', method: 'get' } }
	// }
	if (!data.company) return endJob(data, `Не удалось найти компанию с id = ${id}`)
	data.msg = await bot.sendMessage(user.chat_id, `${data.company.name}. Выберите действие`,
		{
			reply_markup: {
				inline_keyboard: [[{
					text: 'Создать папку Компании 📂',
					callback_data: `create-company-folder`
				}],[{
					text: 'Создать почтовое вложение 📨',
					callback_data: `create-post-inlet-5`
				}],[{
					text: 'Закончить 🔚',
					callback_data: `cancel`
				}]]
			}
		}
	)
	setStore(data)
}

export async function createCompanyFolder(data) {
	const { user, company } = data
	company.folder = await getDiskResource(companiesDirPath, company.id)
	if (company.folder) return endJob(data, `Папка компании уже существует в расположении ${company.folder.path}`)
	const { statusText } = await disk.put('?'+ stringify({ path: `${companiesDirPath}/${company.name}_${company.id}`}))
	console.log('createCompanyFolderStatusText > ', statusText)
	endJob(data, `Папка компании создана`)
}

export async function createPostInlet5(data) {
	const { user, company } = data
	data.inn = company.custom_fields.find(cf => cf.name === 'ИНН')?.values?.[0]?.value
	if (!data.inn) return endJob(data, `В карточке компании нет ИНН`)
	data.org = (await moedelo.get(`/kontragents/api/v1/kontragent?pageSize=1000000&inn=${data.inn}`))?.data?.ResourceList?.[0]
	// console.log('data.org > ', JSON.stringify(data.org, null, 2))
	// data.org >  [
	// 	{
	// 		"Id": 18320606,
	// 		"Inn": "2312108067",
	// 		"Ogrn": "1032307189188",
	// 		"Okpo": null,
	// 		"Kpp": "231201001",
	// 		"Name": "ООО \"МЗ\"",
	// 		"ShortName": "ООО \"МЗ\"",
	// 		"Type": 1,
	// 		"Form": 1,
	// 		"IsArchived": false,
	// 		"LegalAddress": "350080, НИЖЕГОРОДСКИЙ КРАЙ, ГОРОД НИЖЕГОРОД, КАЛИНИНСКАЯ УЛИЦА, д. 20/1",
	// 		"ActualAddress": "350080, НИЖЕГОРОДСКИЙ КРАЙ, ГОРОД НИЖЕГОРОД, КАЛИНИНСКАЯ УЛИЦА, д. 20/1",
	// 		"RegistrationAddress": null,
	// 		"TaxpayerNumber": null,
	// 		"AdditionalRegNumber": null,
	// 		"SubcontoId": 77279854,
	// 		"Fio": null,
	// 		"SignerFio": "ИВАНОВ ИВАН ИВАНОВИЧ",
	// 		"InFace": "Генерального директора Иванова Ивана Владимировича",
	// 		"Position": "",
	// 		"InReason": "Устава",
	// 		"PersonalData": ""
	// 	}
	// ]
	data.postAddress = company.custom_fields.find(cf => cf.name === 'Почтовый адрес')?.values?.[0]?.value
		|| data.org.ActualAddress
		|| data.org.LegalAddress
	// console.log('postAddress > ', postAddress)
	// postAddress >  454001, Челябинск, 40-летия Победы,  45, кв. 15
	if (!data.postAddress) return endJob(data, `В карточке компании нет почтового адреса`)
	data.contacts = company.contacts
		? (await (await amoConnect()).get(company.contacts._links.self.href)).data._embedded.items
		: null
	// console.log('contacts > ', JSON.stringify(data.contacts, null, 2))
	// contacts > [
	// 	{
	// 		"id": 45175681,
	// 		"name": "Иванов Иван Иванович",
	// 		"responsible_user_id": 3405940,
	// 		"created_by": 0,
	// 		"created_at": 1554293520,
	// 		"updated_at": 1621322710,
	// 		"account_id": 24238705,
	// 		"updated_by": 3405940,
	// 		"group_id": 232951,
	// 		"company": {
	// 			"id": 45221939,
	// 			"name": "Машиностроительный завод (МЗ)",
	// 			"_links": {
	// 				"self": {
	// 					"href": "/api/v2/companies?id=45221939",
	// 					"method": "get"
	// 				}
	// 			}
	// 		},
	// 		"leads": {
	// 			"id": [
	// 				16029925,
	// 				20290711,
	// 				20673091,
	// 				21200883,
	// 				21292247,
	// 				21501915,
	// 				21528561,
	// 				21916987,
	// 				22135819,
	// 				22521005,
	// 				22829737,
	// 				22829797,
	// 				22940911,
	// 				23073625,
	// 				23073741,
	// 				23123093,
	// 				23123099,
	// 				23324047,
	// 				23371341,
	// 				23379983,
	// 				23380209,
	// 				23390959,
	// 				23413675,
	// 				23442721,
	// 				23456817,
	// 				23462245,
	// 				23490655,
	// 				23849713,
	// 				23926267,
	// 				24030191,
	// 				24057033,
	// 				24097813,
	// 				24101183,
	// 				24114971,
	// 				24123793
	// 			],
	// 			"_links": {
	// 				"self": {
	// 					"href": "/api/v2/leads?id=16029925,20290711,20673091,21200883,21292247,21501915,21528561,21916987,22135819,22521005,22829737,22829797,22940911,23073625,23073741,23123093,23123099,23324047,23371341,23379983,23380209,23390959,23413675,23442721,23456817,23462245,23490655,23849713,23926267,24030191,24057033,24097813,24101183,24114971,24123793",
	// 					"method": "get"
	// 				}
	// 			}
	// 		},
	// 		"closest_task_at": 0,
	// 		"tags": {},
	// 		"custom_fields": [
	// 			{
	// 				"id": 317987,
	// 				"name": "Должность",
	// 				"type_id": 1,
	// 				"code": "POSITION",
	// 				"values": [
	// 					{
	// 						"value": "инженер технического отдела"
	// 					}
	// 				],
	// 				"is_system": true
	// 			},
	// 			{
	// 				"id": 317991,
	// 				"name": "Email",
	// 				"type_id": 8,
	// 				"code": "EMAIL",
	// 				"values": [
	// 					{
	// 						"value": "pd2@mz.ru",
	// 						"enum": 499371
	// 					}
	// 				],
	// 				"is_system": true
	// 			},
	// 			{
	// 				"id": 317989,
	// 				"name": "Телефон",
	// 				"type_id": 8,
	// 				"code": "PHONE",
	// 				"values": [
	// 					{
	// 						"value": "+79261234567",
	// 						"enum": 499359
	// 					},
	// 					{
	// 						"value": "+79261234567",
	// 						"enum": 499359
	// 					},
	// 					{
	// 						"value": "+79261234567",
	// 						"enum": 499363
	// 					}
	// 				],
	// 				"is_system": true
	// 			}
	// 		],
	// 		"customers": {},
	// 		"_links": {
	// 			"self": {
	// 				"href": "/api/v2/contacts?id=45175681",
	// 				"method": "get"
	// 			}
	// 		}
	// 	},
	// 	{
	// 		"id": 55424581,
	// 		"name": "Иванов Иван Иванович",
	// 		"responsible_user_id": 3405940,
	// 		"created_by": 3405940,
	// 		"created_at": 1561984186,
	// 		"updated_at": 1561984212,
	// 		"account_id": 24238705,
	// 		"updated_by": 3405940,
	// 		"group_id": 232951,
	// 		"company": {
	// 			"id": 45221939,
	// 			"name": "Машиностроительный завод (МЗ)",
	// 			"_links": {
	// 				"self": {
	// 					"href": "/api/v2/companies?id=45221939",
	// 					"method": "get"
	// 				}
	// 			}
	// 		},
	// 		"leads": {
	// 			"id": [
	// 				20290711,
	// 				16029925,
	// 				23849713
	// 			],
	// 			"_links": {
	// 				"self": {
	// 					"href": "/api/v2/leads?id=20290711,16029925,23849713",
	// 					"method": "get"
	// 				}
	// 			}
	// 		},
	// 		"closest_task_at": 0,
	// 		"tags": {},
	// 		"custom_fields": [
	// 			{
	// 				"id": 317989,
	// 				"name": "Телефон",
	// 				"type_id": 8,
	// 				"code": "PHONE",
	// 				"values": [
	// 					{
	// 						"value": "+79261234567",
	// 						"enum": 499363
	// 					}
	// 				],
	// 				"is_system": true
	// 			},
	// 			{
	// 				"id": 317987,
	// 				"name": "Должность",
	// 				"type_id": 1,
	// 				"code": "POSITION",
	// 				"values": [
	// 					{
	// 						"value": "Технический директор"
	// 					}
	// 				],
	// 				"is_system": true
	// 			},
	// 			{
	// 				"id": 317991,
	// 				"name": "Email",
	// 				"type_id": 8,
	// 				"code": "EMAIL",
	// 				"values": [
	// 					{
	// 						"value": "tehdir@mz.ru",
	// 						"enum": 499371
	// 					}
	// 				],
	// 				"is_system": true
	// 			}
	// 		],
	// 		"customers": {},
	// 		"_links": {
	// 			"self": {
	// 				"href": "/api/v2/contacts?id=55424581",
	// 				"method": "get"
	// 			}
	// 		}
	// 	},
	// 	{
	// 		"id": 56655033,
	// 		"name": "Водители МЗ",
	// 		"first_name": "Водители МЗ",
	// 		"last_name": "",
	// 		"responsible_user_id": 3405940,
	// 		"created_by": 3405940,
	// 		"created_at": 1563522258,
	// 		"updated_at": 1621329201,
	// 		"account_id": 24238705,
	// 		"updated_by": 3405940,
	// 		"group_id": 232951,
	// 		"company": {
	// 			"id": 45221939,
	// 			"name": "Машиностроительный завод (МЗ)",
	// 			"_links": {
	// 				"self": {
	// 					"href": "/api/v2/companies?id=45221939",
	// 					"method": "get"
	// 				}
	// 			}
	// 		},
	// 		"leads": {},
	// 		"closest_task_at": -62169993017,
	// 		"tags": [
	// 			{
	// 				"id": 346621,
	// 				"name": "водитель"
	// 			}
	// 		],
	// 		"custom_fields": [
	// 			{
	// 				"id": 317989,
	// 				"name": "Телефон",
	// 				"type_id": 8,
	// 				"code": "PHONE",
	// 				"values": [
	// 					{
	// 						"value": "+79261234567",
	// 						"enum": 499363
	// 					},
	// 					{
	// 						"value": "+79261234567",
	// 						"enum": 499363
	// 					},
	// 					{
	// 						"value": "+79261234567",
	// 						"enum": 499363
	// 					},
	// 					{
	// 						"value": "+79261234567",
	// 						"enum": 499363
	// 					},
	// 					{
	// 						"value": "+79261234567",
	// 						"enum": 499363
	// 					},
	// 					{
	// 						"value": "+79261234567",
	// 						"enum": 499363
	// 					},
	// 					{
	// 						"value": "+79261234567",
	// 						"enum": 499363
	// 					},
	// 					{
	// 						"value": "+79261234567",
	// 						"enum": 499363
	// 					},
	// 					{
	// 						"value": "+79261234567",
	// 						"enum": 499363
	// 					},
	// 					{
	// 						"value": "+79261234567",
	// 						"enum": 499363
	// 					},
	// 					{
	// 						"value": "+79261234567",
	// 						"enum": 499363
	// 					},
	// 					{
	// 						"value": "+79261234567",
	// 						"enum": 499363
	// 					},
	// 					{
	// 						"value": "+79261234567",
	// 						"enum": 499363
	// 					},
	// 					{
	// 						"value": "+79261234567",
	// 						"enum": 499363
	// 					}
	// 				],
	// 				"is_system": true
	// 			}
	// 		],
	// 		"customers": {},
	// 		"_links": {
	// 			"self": {
	// 				"href": "/api/v2/contacts?id=56655033",
	// 				"method": "get"
	// 			}
	// 		}
	// 	},
	// 	{
	// 		"id": 58861269,
	// 		"name": "Иванов Иван Иванович",
	// 		"responsible_user_id": 3405940,
	// 		"created_by": 3405940,
	// 		"created_at": 1566200613,
	// 		"updated_at": 1566200613,
	// 		"account_id": 24238705,
	// 		"updated_by": 3405940,
	// 		"group_id": 232951,
	// 		"company": {
	// 			"id": 45221939,
	// 			"name": "Машиностроительный завод (МЗ)",
	// 			"_links": {
	// 				"self": {
	// 					"href": "/api/v2/companies?id=45221939",
	// 					"method": "get"
	// 				}
	// 			}
	// 		},
	// 		"leads": {
	// 			"id": [
	// 				16029925,
	// 				23849713
	// 			],
	// 			"_links": {
	// 				"self": {
	// 					"href": "/api/v2/leads?id=16029925,23849713",
	// 					"method": "get"
	// 				}
	// 			}
	// 		},
	// 		"closest_task_at": 0,
	// 		"tags": {},
	// 		"custom_fields": [
	// 			{
	// 				"id": 317991,
	// 				"name": "Email",
	// 				"type_id": 8,
	// 				"code": "EMAIL",
	// 				"values": [
	// 					{
	// 						"value": "buh@kmzv.ru",
	// 						"enum": 499371
	// 					}
	// 				],
	// 				"is_system": true
	// 			}
	// 		],
	// 		"customers": {},
	// 		"_links": {
	// 			"self": {
	// 				"href": "/api/v2/contacts?id=58861269",
	// 				"method": "get"
	// 			}
	// 		}
	// 	},
	// 	{
	// 		"id": 85715327,
	// 		"name": "Иванов Иван Иванович",
	// 		"first_name": "",
	// 		"last_name": "",
	// 		"responsible_user_id": 3405940,
	// 		"created_by": 3405940,
	// 		"created_at": 1595401502,
	// 		"updated_at": 1595404720,
	// 		"account_id": 24238705,
	// 		"updated_by": 3405940,
	// 		"group_id": 232951,
	// 		"company": {
	// 			"id": 45221939,
	// 			"name": "Машиностроительный завод (МЗ)",
	// 			"_links": {
	// 				"self": {
	// 					"href": "/api/v2/companies?id=45221939",
	// 					"method": "get"
	// 				}
	// 			}
	// 		},
	// 		"leads": {
	// 			"id": [
	// 				23849713
	// 			],
	// 			"_links": {
	// 				"self": {
	// 					"href": "/api/v2/leads?id=23849713",
	// 					"method": "get"
	// 				}
	// 			}
	// 		},
	// 		"closest_task_at": 0,
	// 		"tags": {},
	// 		"custom_fields": [
	// 			{
	// 				"id": 317989,
	// 				"name": "Телефон",
	// 				"type_id": 8,
	// 				"code": "PHONE",
	// 				"values": [
	// 					{
	// 						"value": "+79261234567",
	// 						"enum": 499359
	// 					}
	// 				],
	// 				"is_system": true
	// 			},
	// 			{
	// 				"id": 317987,
	// 				"name": "Должность",
	// 				"type_id": 1,
	// 				"code": "POSITION",
	// 				"values": [
	// 					{
	// 						"value": "Логист"
	// 					}
	// 				],
	// 				"is_system": true
	// 			}
	// 		],
	// 		"customers": {},
	// 		"_links": {
	// 			"self": {
	// 				"href": "/api/v2/contacts?id=85715327",
	// 				"method": "get"
	// 			}
	// 		}
	// 	}
	// ]
	// return contacts.length ? contacts[0] : null
	if (!data.contacts) return createPostInlet10(data)
	data.msg = await bot.sendMessage(user.chat_id,
		`Выберите контакт для указания в качестве ответственного`,
		{
			reply_markup: {
				inline_keyboard: [
					...data.contacts.map(c => [{
						text: `${c.name}`,
						callback_data: `create-post-inlet-10:${c.id}`
					}]),
				[{
					text: 'Закончить 🔚',
					callback_data: `cancel`
				}]]
			}
		}
	)
	setStore(data)
}

export async function createPostInlet10(data) {
	const { user, actions, company, contacts, postAddress } = data
	data.contact = contacts.find(c => c.id == actions[0])
	const contactTels = data.contact.custom_fields.find(cf => cf.name === 'Телефон')?.values
	console.log('data.org > ', data.org)
	const docxData = {
		kontr_short: data.org.ShortName,
		kontr_zip: postAddress.match(/^[0-9]{6}/)[0],
		kontr_post_address: postAddress.match(/^[0-9]{6}, (.+)/)[1],
		kontr_tel: company.custom_fields.find(cf => cf.name === 'Телефон')?.values?.[0]?.value,
		kontr_manager: data.contact.name,
		kontr_manager_tel: contactTels?.find(ct => ct.enum === 499363)?.value || contactTels?.[0]
	}
	console.log('docxData > ', docxData)

	// Generate file from template
	const templateDownloadUrl = (await disk.get('/download?'+stringify({ path: '/Шаблоны документов/Корреспонденция/Конверт С4/template_ip.docx' }))).data.href
	const { data: template } = await axios.get( templateDownloadUrl, { responseType: 'arraybuffer'} )
	const zip = new PizZip(template)
	const doc = new Docxtemplater(zip)
	doc.setData(docxData)
	doc.render()
	var buf = doc.getZip().generate({ type: 'nodebuffer', compression: "DEFLATE" })

	data.folder = await getDiskResource(companiesDirPath, company.id)
	if (!data.folder) return endJob(data, `Сначала создайте папку Компании`)
	const uploadUrl = (await disk.get('/upload?'+stringify({
		path: `${data.folder.path}/${new Date(Date.now() + 3*3600*1000).toISOString().slice(0,10)} Почтовое вложение.docx`,
		overwrite: true
	})))?.data?.href
	const { statusText } = await axios.put( uploadUrl, buf, { responseType: 'arraybuffer'})

	console.log('createCompanyPostInletStatusText > ', statusText)
	endJob(data, `Почтовое вложение создано в расположении ${data.folder.path}`)

  // fs.writeFileSync('./output.docx', buf)
}
