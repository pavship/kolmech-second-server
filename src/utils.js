import fs from 'fs'

emptyDebugLog()
outputJson({})

function emptyDebugLog() {
	try {
		fs.writeFileSync('./outputlog.json', '{}')
	} catch (err) {}
}

function debugLog(func_name, data) {
	console.log(func_name, '>')
	let log_obj = {}
	try {
		log_obj = JSON.parse(fs.readFileSync('./outputlog.json', 'utf8'))
	} catch (err) {}
	let appearance_counter = 0
	for (const key in log_obj) {
		if (key.startsWith(func_name)) appearance_counter++
	}
	log_obj[`${func_name}_${appearance_counter}`] = data
	fs.writeFileSync('./outputlog.json', JSON.stringify(log_obj, null, 2))
}

function outputJson(obj) {
	fs.writeFileSync('./output.json', JSON.stringify(obj, null, 2))
}

function functionName (func = null) {
	if (func) {
		if (func.name) {
			return func.name;
		}
		const result = /^function\s+([\w\$]+)\s*\(/.exec(func.toString());
		return result ? result[1] : '';
	}
	const obj = {};
	Error.captureStackTrace(obj, functionName);
	const {stack} = obj;
	const firstCharacter = stack.indexOf('at ') + 3;
	const lastCharacter = findFirstOccurrence(stack, [' ', ':', '\n'], firstCharacter);
	return stack.slice(firstCharacter, lastCharacter);
}

const findFirstOccurrence = (string, searchElements, fromIndex = 0) => {
	let min = string.length;
	for (let i = 0; i < searchElements.length; i += 1) {
		const occ = string.indexOf(searchElements[i], fromIndex);
		if (occ !== -1 && occ < min) {
			min = occ;
		}
	}
	return (min === string.length) ? -1 : min;
}

// clears blank lines from template strings
function despace(strings, ...placeholders) {
  let withSpace = strings.reduce((result, string, i) => (result + placeholders[i - 1] + string))
  let withoutSpace = withSpace.replace(/(^\s*$\n)|(^[\t]*)/gm, '')
  return withoutSpace
}

export {
	emptyDebugLog,
	debugLog,
	outputJson,
	functionName,
	despace
}