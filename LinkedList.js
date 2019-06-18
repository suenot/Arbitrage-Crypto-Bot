// a simple linked list implementation (needed to get optimal bounds on product/rabin-scott)

function empty() {
	return { h: null, t: null, e: true, s: 0 };
}

// add to tail
function enq(linkedlist, elem) {
	if (linkedlist.e) {
		linkedlist.h = linkedlist.t = { d: elem, p: null, n: null };
		linkedlist.e = false;
	} else
	    linkedlist.t = linkedlist.t.n = { d: elem, p: linkedlist.t, n: null };

	linkedlist.s++;
}

// remove from head
function deq(linkedlist) {
	if (linkedlist.e)
		return null;

	var data = linkedlist.h.d;
	linkedlist.h = linkedlist.h.n;

	if (linkedlist.h === null) {
		linkedlist.t = null;
		linkedlist.e = true;
	} else
		linkedlist.h.p = null;

	linkedlist.s--;
	return data;
}

// remove from tail
function pop(linkedlist) {
	if (linkedlist.e)
		return null;

	var data = linkedlist.t.d;
	linkedlist.t = linkedlist.t.p;

	if (linkedlist.t === null) {
		linkedlist.h = null;
		linkedlist.e = true;
	} else
		linkedlist.t.n = null;

	linkedlist.s--;
	return data;
}

function singleton(elem) {
	var ll = empty();
	enq(ll, elem);
	return ll;
}

module.exports = { empty, enq, deq, singleton, pop };