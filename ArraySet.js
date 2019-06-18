const sha = require('object-hash');

function empty()  { // an array which behaves as a set by using a hidden set of element hashes
	const arr = [];
	arr._elem = new Set(); // set (of elements)
	return arr;
}

function has(as, elem) {
	return as._elem.has(sha(elem));
}

function add() {
	if (arguments.length < 2)
		return;

	const as = arguments[0];

	for (var i = 1; i < arguments.length; i++)
		_add(as, arguments[i]);
}

function _add(as, elem) {
	const hash = sha(elem);

	if (as._elem.has(hash)) // redundant element
		return;

	as._elem.add(hash);
	as.push(elem);
}

module.exports = { empty, add, has };