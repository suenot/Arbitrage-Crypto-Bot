const sha = require('object-hash');

// an array which behaves as a set by using a hidden set of element hashes
// a custom hash functions allows for sets where elements are the same but what we consider an element is different
  // only makes sense to have "get" (lookups) if the hash of an element isn't the sha of the object like in this case
  // (otherwise to get an element you pass it in)
  // so if a custom hash is
function empty(hash)  {
	const arr = [];
	arr._elem = hash ? new Map() : new Set(); // set (of elements)
	arr._hash = hash || undefined; // custom hash function
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

// for single elem
function _add(as, elem) {
	const hash = (as._hash || sha)(elem);

	if (as._elem.has(hash)) // redundant element
		return;

	if (as._hash) // custom hash function, _elem is a map
		as._elem.set(hash, elem);
	else // no custom hash function, _elem is a set
		as._elem.add(hash);

	as.push(elem);
}

function get(as, elem) {
	if (as._hash)
		return as._elem.get(elem) || as._elem.get(as._hash(elem)) || undefined; // first assume hash was passed, then element if that doesn't work
	else
		return has(as, elem) ? elem : undefined;
}

module.exports = { empty, add, has, get };