import axios from 'axios'
import { createHmac } from 'crypto'
import FormData from 'form-data'
import { outputJson } from './utils.js'

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
			const res = await axios.request({
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
		const res = await axios.request({
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
		// console.log('megaplan v3 err.response > ', {
		// 	url: err.response.config.url,
		// 	status: err.response.status,
		// 	statusText: err.response.statusText,
		// })
		console.log('megaplan v3 err.response > ', err)
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
		const res = await axios.request({
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

const getTask = async id => (await megaplan_v3( 'GET', `/api/v3/task/${id}` )).data
//#region schema
// {
// 	"contentType": "Task",
// 	"id": "1000960",
// 	"humanNumber": 960,
// 	"name": "Перевозка сотрудников",
// 	"isOverdue": false,
// 	"status": "assigned",
// 	"statusChangeTime": {
// 	  "contentType": "DateTime",
// 	  "value": "2021-06-01T00:31:00+00:00"
// 	},
// 	"owner": {
// 	  "contentType": "Employee",
// 	  "id": "1000005",
// 	  "name": "Иванов Иван",
// 	  "firstName": "Иван",
// 	  "middleName": "Сергеевич",
// 	  "lastName": "Иванов",
// 	  "position": "Начальник отдела",
// 	  "department": {
// 		"contentType": "Department",
// 		"id": "1000010",
// 		"name": "Отдел догворов"
// 	  },
// 	  "uid": 1000129,
// 	  "gender": "male",
// 	  "birthday": null,
// 	  "inn": "",
// 	  "age": null,
// 	  "contactInfo": [
// 		{
// 		  "contentType": "ContactInfo",
// 		  "type": "email",
// 		  "value": "dev@yandex.ru",
// 		  "comment": "",
// 		  "isMain": true,
// 		  "subject": {
// 			"contentType": "Employee",
// 			"id": "1000005"
// 		  }
// 		},
// 		{
// 		  "contentType": "ContactInfo",
// 		  "type": "icq",
// 		  "value": "647411234",
// 		  "comment": "",
// 		  "isMain": null,
// 		  "subject": {
// 			"contentType": "Employee",
// 			"id": "1000005"
// 		  }
// 		},
// 		{
// 		  "contentType": "ContactInfo",
// 		  "type": "skype",
// 		  "value": "647411234",
// 		  "comment": "",
// 		  "isMain": null,
// 		  "subject": {
// 			"contentType": "Employee",
// 			"id": "1000005"
// 		  }
// 		}
// 	  ],
// 	  "contactInfoCount": 3,
// 	  "isWorking": true,
// 	  "nearestVacation": null,
// 	  "isReadable": true,
// 	  "isOnline": true,
// 	  "lastOnline": {
// 		"contentType": "DateTime",
// 		"value": "2021-06-02T09:38:46+00:00"
// 	  },
// 	  "canLogin": true,
// 	  "avatar": null
// 	},
// 	"isTemplateOwnerCurrentUser": true,
// 	"deadline": null,
// 	"subTasks": [],
// 	"subTasksCount": 0,
// 	"actualSubTasksCount": 0,
// 	"responsible": {
// 	  "contentType": "Employee",
// 	  "id": "1000005"
// 	},
// 	"completed": 0,
// 	"subject": "<p>Задача для учета и списания затрат на проездные билеты, компенсации использования личного авто и т.п.</p>",
// 	"isUrgent": false,
// 	"isNegotiation": false,
// 	"auditors": [],
// 	"auditorsCount": 0,
// 	"executors": [],
// 	"executorsCount": 0,
// 	"isTemplate": false,
// 	"originalTemplate": null,
// 	"schedule": null,
// 	"attaches": [],
// 	"attachesCount": 0,
// 	"actualStart": {
// 	  "contentType": "DateTime",
// 	  "value": "2021-06-01T00:31:00+00:00"
// 	},
// 	"plannedWork": {
// 	  "contentType": "DateInterval",
// 	  "value": 0
// 	},
// 	"actualWork": {
// 	  "contentType": "DateInterval",
// 	  "value": 0
// 	},
// 	"previousTasks": [],
// 	"nextTasksCount": 0,
// 	"actualFinish": null,
// 	"plannedFinish": null,
// 	"duration": {
// 	  "contentType": "DateInterval",
// 	  "value": 0
// 	},
// 	"parents": [
// 	  {
// 		"contentType": "Project",
// 		"id": "1000003",
// 		"humanNumber": 3,
// 		"owner": {
// 		  "contentType": "Employee",
// 		  "id": "1000005"
// 		},
// 		"responsible": {
// 		  "contentType": "Employee",
// 		  "id": "1000005"
// 		},
// 		"name": "JGG.ORG",
// 		"isTemplate": false,
// 		"status": "accepted",
// 		"deadline": null,
// 		"isOverdue": false,
// 		"rights": {
// 		  "contentType": "ProjectRights",
// 		  "id": "Project/1000003",
// 		  "read": true
// 		},
// 		"unreadCommentsCount": 0,
// 		"isFavorite": false,
// 		"tags": [],
// 		"tagsCount": 0
// 	  },
// 	  {
// 		"contentType": "Project",
// 		"id": "1000001",
// 		"humanNumber": 1,
// 		"owner": {
// 		  "contentType": "Employee",
// 		  "id": "1000005"
// 		},
// 		"responsible": {
// 		  "contentType": "Employee",
// 		  "id": "1000005"
// 		},
// 		"name": "Общепроизводственные",
// 		"isTemplate": false,
// 		"status": "accepted",
// 		"deadline": null,
// 		"isOverdue": false,
// 		"rights": {
// 		  "contentType": "ProjectRights",
// 		  "id": "Project/1000001",
// 		  "read": true
// 		},
// 		"unreadCommentsCount": 0,
// 		"isFavorite": false,
// 		"tags": [],
// 		"tagsCount": 0
// 	  },
// 	  {
// 		"contentType": "Project",
// 		"id": "1000573",
// 		"humanNumber": 573,
// 		"owner": {
// 		  "contentType": "Employee",
// 		  "id": "1000005"
// 		},
// 		"responsible": {
// 		  "contentType": "Employee",
// 		  "id": "1000005"
// 		},
// 		"name": "Оборудование",
// 		"isTemplate": false,
// 		"status": "accepted",
// 		"deadline": null,
// 		"isOverdue": false,
// 		"rights": {
// 		  "contentType": "ProjectRights",
// 		  "id": "Project/1000573",
// 		  "read": true
// 		},
// 		"unreadCommentsCount": 0,
// 		"isFavorite": false,
// 		"tags": [],
// 		"tagsCount": 0
// 	  },
// 	  {
// 		"contentType": "Project",
// 		"id": "1001126",
// 		"humanNumber": 1126,
// 		"owner": {
// 		  "contentType": "Employee",
// 		  "id": "1000005"
// 		},
// 		"responsible": {
// 		  "contentType": "Employee",
// 		  "id": "1000005"
// 		},
// 		"name": "Шлифовальный станок",
// 		"isTemplate": false,
// 		"status": "accepted",
// 		"deadline": null,
// 		"isOverdue": false,
// 		"rights": {
// 		  "contentType": "ProjectRights",
// 		  "id": "Project/1001126",
// 		  "read": true
// 		},
// 		"unreadCommentsCount": 0,
// 		"isFavorite": false,
// 		"tags": [],
// 		"tagsCount": 0
// 	  }
// 	],
// 	"parentsCount": 4,
// 	"project": {
// 	  "contentType": "Project",
// 	  "id": "1001126"
// 	},
// 	"participants": [
// 	  {
// 		"contentType": "Employee",
// 		"id": "1000005"
// 	  }
// 	],
// 	"participantsCount": 1,
// 	"statement": "<p>Задача для учета и списания затрат на проездные билеты, компенсации использования личного авто и т.п.</p>",
// 	"textStatement": "Задача для учета и списания затрат на проездные билеты, компенсации использования личного авто и т.п.",
// 	"milestones": [],
// 	"milestonesCount": 0,
// 	"rights": {
// 	  "contentType": "TaskRights",
// 	  "id": "Task/1000960",
// 	  "read": true,
// 	  "edit": true,
// 	  "remove": true,
// 	  "updateDeepLastActivity": true,
// 	  "acceptWork": true,
// 	  "rejectWork": false,
// 	  "acceptTask": true,
// 	  "rejectTask": true,
// 	  "acceptDeadline": false,
// 	  "rejectDeadline": false,
// 	  "changeDeadline": true,
// 	  "requestDeadline": false,
// 	  "createSubtask": true,
// 	  "createNegotiationSubtask": true,
// 	  "editExecutors": true,
// 	  "editExtFields": true,
// 	  "readMilestone": true,
// 	  "createMilestone": true,
// 	  "createFinOperation": false,
// 	  "convert": true,
// 	  "delegate": true,
// 	  "readBonuses": true,
// 	  "linkDeal": true,
// 	  "takeup": false,
// 	  "useTemplate": false,
// 	  "toTemplate": true,
// 	  "changeOwner": true,
// 	  "pause": false,
// 	  "resume": false,
// 	  "cancel": true,
// 	  "expire": false,
// 	  "done": false,
// 	  "renew": false,
// 	  "rateVoteAvailable": false,
// 	  "rateVoteWillBeAvailable": false,
// 	  "rateResultsAvailable": false,
// 	  "rateCustomVoteAvailable": false,
// 	  "rateChangeVoteAvailable": false,
// 	  "rateSeeVote": false,
// 	  "rateWidgetAvailable": false,
// 	  "reminderRecipient": true,
// 	  "editMainInfo": true
// 	},
// 	"relationLinks": [],
// 	"relationLinksCount": 0,
// 	"deals": [],
// 	"dealsCount": 0,
// 	"actualDealsCount": 0,
// 	"links": [],
// 	"linksCount": 0,
// 	"parent": {
// 	  "contentType": "Project",
// 	  "id": "1001126"
// 	},
// 	"workedOffTime": [],
// 	"workedOffTimeCount": 0,
// 	"workedOffTimeTotal": {
// 	  "contentType": "DateInterval",
// 	  "value": 0
// 	},
// 	"todos": [],
// 	"todosCount": 0,
// 	"timeCreated": {
// 	  "contentType": "DateTime",
// 	  "value": "2021-06-01T00:31:00+00:00"
// 	},
// 	"deadlineChangeRequest": null,
// 	"deadlineReminders": [],
// 	"deadlineRemindersCount": 0,
// 	"responsibleCanEditExtFields": true,
// 	"executorsCanEditExtFields": true,
// 	"auditorsCanEditExtFields": false,
// 	"bonuses": [],
// 	"bonusesCount": 0,
// 	"activity": {
// 	  "contentType": "DateTime",
// 	  "value": "2021-06-01T00:31:00+00:00"
// 	},
// 	"isGroup": false,
// 	"entitiesByTemplate": [],
// 	"userCreated": {
// 	  "contentType": "Employee",
// 	  "id": "1000005"
// 	},
// 	"messagesCount": 0,
// 	"lastComment": null,
// 	"lastCommentTimeCreated": null,
// 	"firstUnreadComment": null,
// 	"reminderTime": null,
// 	"fine": [],
// 	"fineCount": 0,
// 	"interactionsCounters": [
// 	  {
// 		"contentType": "InteractionCounter",
// 		"action": "read",
// 		"count": 1
// 	  }
// 	],
// 	"editableFields": [],
// 	"comments": [],
// 	"commentsCount": 0,
// 	"unreadCommentsCount": 0,
// 	"attachesCountInComments": 0,
// 	"unreadAnswer": false,
// 	"subscribed": true,
// 	"commentsWithoutTransportCount": 0,
// 	"emailsCount": 0,
// 	"whatsappCount": 0,
// 	"telegramCount": 0,
// 	"instagramCount": 0,
// 	"actualTodosCount": 0,
// 	"finishedTodosCount": 0,
// 	"Category130CustomFieldPrioritet": "П3 Низкий",
// 	"Category130CustomFieldPlanovieZatrati": 0,
// 	"isFavorite": false,
// 	"lastView": {
// 	  "contentType": "DateTime",
// 	  "value": "2021-06-01T15:47:25+00:00"
// 	},
// 	"tags": [],
// 	"tagsCount": 0,
// 	"financeOperations": [],
// 	"financeOperationsCount": 0,
// 	"allFiles": [],
// 	"allFilesCount": 0,
// 	"attachesInfo": {
// 	  "contentType": "AttachesInfo",
// 	  "imageFiles": [],
// 	  "imageFilesCount": 0,
// 	  "audioFiles": [],
// 	  "audioFilesCount": 0,
// 	  "otherFiles": [],
// 	  "otherFilesCount": 0
// 	},
// 	"hiddenCommentsCount": 0
// }
//#endregion

const getCurrentTasks = async employee_id => (await megaplan_v3(
	'GET',
	`/api/v3/task?{"fields":["name","Category130CustomFieldPlanovieZatrati","parent","project"],"sortBy":[{"contentType":"SortField","fieldName":"Category130CustomFieldPlanovieZatrati","desc":true}],"filter":{"contentType":"TaskFilter","id":null,"config":{"contentType":"FilterConfig","termGroup":{"contentType":"FilterTermGroup","join":"and","terms":[{"contentType":"FilterTermRef","field":"responsible","comparison":"equals","value":[{"id":"${employee_id}","contentType":"Employee"}]},{"contentType":"FilterTermEnum","field":"status","comparison":"equals","value":["filter_any"]},{"contentType":"FilterTermEnum","field":"type","comparison":"equals","value":["task"]},{"contentType":"FilterTermEnum","field":"status","comparison":"not_equals","value":["filter_completed"]}]}}},"limit":25}`
)).data || []

const getCompletedUnpaidTasks = async employee_id => (await megaplan_v3(
	'GET',
	`/api/v3/task?{"fields":["name", "Category130CustomFieldPlanovieZatrati", "parent", "project"],"sortBy":[{"contentType":"SortField","fieldName":"Category130CustomFieldPlanovieZatrati","desc":true}],"filter":{"contentType":"TaskFilter","id":null,"config":{"contentType":"FilterConfig","termGroup":{"contentType":"FilterTermGroup","join":"and","terms":[{"contentType":"FilterTermRef","field":"responsible","comparison":"equals","value":[{"id":"${employee_id}","contentType":"Employee"}]},{"contentType":"FilterTermEnum","field":"type","comparison":"equals","value":["task"]},{"contentType":"FilterTermEnum","field":"status","comparison":"equals","value":["filter_completed"]},{"contentType":"FilterTermNumber","field":"Category130CustomFieldPlanovieZatrati","comparison":"more","value":0}]},"filterId":231}},"limit":25}`
)).data || []

const getTasksToPay = async employee_id => [
	...await getCurrentTasks(employee_id),
	...await getCompletedUnpaidTasks(employee_id)
]

const setTaskBudget = async (id, value) => (await megaplan_v3(
	'POST',
	`/api/v3/task/${id}`,
	{ id, contentType: "Task", Category130CustomFieldPlanovieZatrati: value}
)).data

const getProj = async id => (await megaplan_v3( 'GET', `/api/v3/project/${id}` )).data

export { 
	megaplan,
	megaplan_v3,
	getTask,
	getProj,
	setTaskBudget,
	getTasksToPay,
}
