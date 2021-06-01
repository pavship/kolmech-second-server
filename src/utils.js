import fs from 'fs'

export function outputJson(obj) {
	fs.writeFileSync('./output.json', JSON.stringify(obj, null, 2))
}

export function functionName (func = null) {
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