const gr = require('./Graph');


var G = gr.newGraph();

gr.addEdge(G, 'BTC', 'LTC', { market: 'BTX' });
gr.addEdge(G, 'BTC', 'ETH', { market: 'BTX' });
gr.addEdge(G, 'USD', 'BTC', { market: 'BTX' });
gr.addEdge(G, 'LTC', 'BTC', { market: 'BTX' });
gr.addEdge(G, 'ETH', 'BTC', { market: 'BTX' });

gr.addEdge(G, 'BTC', 'USD', { market: 'CEX' });
gr.addEdge(G, 'BTC', 'LTC', { market: 'CEX' });
gr.addEdge(G, 'BTC', 'ETH', { market: 'CEX' });
gr.addEdge(G, 'USD', 'BTC', { market: 'CEX' });
gr.addEdge(G, 'LTC', 'BTC', { market: 'CEX' });
gr.addEdge(G, 'ETH', 'BTC', { market: 'CEX' });

console.log('Graph: ' + JSON.stringify(G, null, 4));
console.log('BTC Neighbors: ' + JSON.stringify(gr.getNeighbors(G, 'BTC'), null, 4));
console.log('BTC to LTC Markets: ' + JSON.stringify(gr.getEdges(G, 'BTC', 'LTC'), null, 4));
console.log('Simple Digraph: ' + JSON.stringify(gr.simpleDigraph(G), null, 4));


G = gr.newGraph();

gr.addEdge(G, 'BTC', 'LTC', { market: 'BTX' });
gr.addEdge(G, 'BTC', 'LTC', { market: 'CEX' });

gr.addEdge(G, 'LTC', 'BTC', { market: 'BTX' });
gr.addEdge(G, 'LTC', 'BTC', { market: 'CEX' });

gr.addEdge(G, 'LTC', 'ETH', { market: 'BTX' });

gr.addEdge(G, 'ETH', 'BTC', { market: 'BTX' });
gr.addEdge(G, 'ETH', 'BTC', { market: 'CEX' });

console.log('3-cycles from BTC: ' + JSON.stringify(gr.getAllNCyclesFromS(G, 3, [ 'BTC' ]), null, 4));
