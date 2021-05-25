import fs from 'fs'

export function outputJson(obj) {
	fs.writeFileSync('../output.json', JSON.stringify(obj, null, 2))
}