import bot from "../bot.js"
import { findAmoCompany } from './amo.js'
import { disk, getDiskResource } from "./disk.js"
import { endJob, setStore } from "./user.js"
import { stringify } from 'qs'

const companiesDirPath = '/Компании'

export async function handleCompany(data) {
	const { user, msg } = data
	const {1: id} = msg.text.match(/detail\/(\d+)/)
	data.company = await findAmoCompany(id)
	// console.log('company > ', company)
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
	// 	custom_fields: {},
	// 	contacts: { id: [ 88252185 ], _links: { self: [Object] } },
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
	if (company.folder) return endJob(data, `папка компании уже существует в расположении ${company.folder.path}`)
	const { statusText } = await disk.put('?'+ stringify({ path: `${companiesDirPath}/${company.name}_${company.id}`}))
	console.log('createCompanyFolderStatusText > ', statusText)
	endJob(data, `Папка компании создана`)
}