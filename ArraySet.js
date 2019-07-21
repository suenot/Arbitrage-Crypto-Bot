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

function has(as, elemOrHash) {
  return as._elem.has(as._hash ? elemOrHash : sha(elemOrHash));
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

function remove() {
  if (arguments.length < 2)
    return;

  const as = arguments[0];

  for (var i = 1; i < arguments.length; i++)
    _remove(as, arguments[i]);
}

// only O(n) operation
function _remove(as, elemOrHash) {
  // if custom hash provided, assume hash was passed
  var hash = as._hash ? elemOrHash : sha(elemOrHash),
      hashFunction = as._hash || sha;

    // if element was actually contained, remove it from the array
  if (as._elem.delete(hash))
    as.splice(as.findIndex(elem => hashFunction(elem) === hash), 1);
}

function get(as, elemOrHash) {
  if (as._hash) // if custom hash provided, assume hash was passed
    return as._elem.get(elemOrHash) || undefined;
  else
    return has(as, elemOrHash) ? elemOrHash : undefined;
}

module.exports = { empty, add, remove, has, get };