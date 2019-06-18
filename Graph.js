const as = require('./ArraySet'), // an array set with an additional set of vertices which these edges end on
      valOrEmpty = (G, key, makeArray) => { // returns G[key] if its array (optionally making it an array), or [] o.w.
      	const val = G[key];
      	return !Array.isArray(val) ? (makeArray ? G[key] = as.empty() : []) : val;
      };

function newGraph() {
	return {
		_v: {} // set of vertices
	};
}

function addEdge(G, start, end, metadata) {

	G._v[start] = true;
	G._v[end] = true;

	const outedges = valOrEmpty(G, start, true),
	      edge = {
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
	const vertices = Object.keys(G._v),
	      Gp = newGraph();

	for (var i = 0; i < vertices.length; i++) {
		const u = vertices[i],
		      Nu = G[u];

		for (var j = 0; j < Nu.length; j++)
			addEdge(Gp, u, Nu[j]._e, undefined);
	}

	return Gp;
}

module.exports = { newGraph, addEdge, getNeighbors, getEdges, simpleDigraph };
