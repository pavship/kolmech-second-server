import bot from '../bot.js'
import { despace } from '../src/utils.js'

const sendTaskMsg = async (data, _task) => {
	const task = _task || data.task
	return bot.sendMessage( data.user.chat_id,
		`${task.was_created ? 'Создана задача' : 'Выбрана существовавшая задача'} <a href='https://${process.env.MEGAPLAN_HOST}/task/${task.id}/card/'>${task.name}</a>`, {
		parse_mode: 'HTML',
		disable_web_page_preview: true
	})
}

export {
	sendTaskMsg,
}