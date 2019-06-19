const as = require('./ArraySet'), // an array set with an additional set of vertices which these edges end on
      valOrEmpty = (G, key, makeArray) => { // returns G[key] if its array (optionally making it an array), or [] o.w.
      	const val = G[key];
      	return !Array.isArray(val) ? (makeArray ? G[key] = as.empty() : []) : val;
      };

function newGraph() {
	return {
		_v: new Set() // set of vertices
	};
}

function addEdge(G, start, end, metadata) {

	G._v.add(start);
	G._v.add(end);

	const outedges = valOrEmpty(G, start, true),
	      edge = {
	      	_s: start,
	      	_e: end,
	      	_m: metadata
	      };

	as.add(outedges, edge); // add to set (no duplicates)
}

function getNeighbors(G, v) {
	return valOrEmpty(G, v, false);
}

function getEdges(G, start, end) {
	return valOrEmpty(G, start, false).filter(x => x._e === end);
}

function simpleDigraph(G) {
	const vertices = Array.from(G._v),
	      Gp = newGraph();

	for (var i = 0; i < vertices.length; i++) {
		const u = vertices[i],
		      Nu = G[u];

		for (var j = 0; j < Nu.length; j++)
			addEdge(Gp, u, Nu[j]._e, undefined);
	}

	return Gp;
}

// given a set of vertices S, find all cycles of length N or less with a vertex in S
// (can later be modified to only find cycles which satisfy some predicate (ie. % return > threshold))
function getAllNCyclesFromS(G, n, S) {
	const cycles = [];

	for (var i = 0; i < S.length; i++)
		dfs(G, S[i], n, [], cycles);

	return cycles;
}

// dfs from v, taking up to depth edges, accumulating the path taken in acc, and adding cycles to cycles
// because traversal is in visit order, no equivalent cycles can be returned
function dfs(G, v, depth, acc, cycles) {
	if (depth === 0) return;

	const N = getNeighbors(G, v);

	for (var i = 0; i < N.length; i++) {
		const nextAcc = acc.slice(),
		      edge = N[i],
		      endpoint = edge._e;

		nextAcc.push(edge);

		if (acc.length > 0 && acc[0]._s === endpoint)
			cycles.push(nextAcc);

		dfs(G, endpoint, depth - 1, nextAcc, cycles);
	}
}

module.exports = { newGraph, addEdge, getNeighbors, getEdges, simpleDigraph, getAllNCyclesFromS };
