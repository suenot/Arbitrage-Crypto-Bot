const gr = require('./Graph'),
      util = require('./Util'),
      wt = require('./Wallet'),
      uuid = require('uuid/v4'),
      clone = require('clone'),
      big = require('bignumber.js');


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



const wallet = wt.empty(),
      peb = {
      	coin: 'BTC',
      	amount: new big(2),
      	exchangeId: 'bittrex',
      	pebbleId: uuid()
      };

wt.addPebble(wallet, peb);

console.log('BTC holdings (2 bittrex): ' + JSON.stringify(wt.getHoldingsInCoin(wallet, 'BTC'), null, 4));
console.log('bittrex holdings (2 BTC): ' + JSON.stringify(wt.getHoldingsInExchange(wallet, 'bittrex'), null, 4));

const peb1 = {
      	coin: 'ETH',
      	amount: new big(3),
      	exchangeId: 'bittrex',
      	pebbleId: uuid()
      };

wt.addPebble(wallet, peb1);

console.log('BTC holdings (2 bittrex): ' + JSON.stringify(wt.getHoldingsInCoin(wallet, 'BTC'), null, 4));
console.log('bittrex holdings (2 BTC, 3 ETH): ' + JSON.stringify(wt.getHoldingsInExchange(wallet, 'bittrex'), null, 4));

const peb2 = {
      	coin: 'BTC',
      	amount: new big(0.5),
      	exchangeId: 'bittrex',
      	pebbleId: uuid()
      };

wt.addPebble(wallet, peb2);

console.log('BTC holdings (2.5 bittrex): ' + JSON.stringify(wt.getHoldingsInCoin(wallet, 'BTC'), null, 4));
console.log('bittrex holdings (2.5 BTC, 3 ETH): ' + JSON.stringify(wt.getHoldingsInExchange(wallet, 'bittrex'), null, 4));

const peb3 = {
      	coin: 'BTC',
      	amount: new big(1),
      	exchangeId: 'binance',
      	pebbleId: uuid()
      };

wt.addPebble(wallet, peb3);

console.log('BTC holdings (2.5 bittrex, 1 binance): ' + JSON.stringify(wt.getHoldingsInCoin(wallet, 'BTC'), null, 4));
console.log('bittrex holdings (2.5 BTC, 3 ETH): ' + JSON.stringify(wt.getHoldingsInExchange(wallet, 'bittrex'), null, 4));
console.log('binace holdings (1 BTC): ' + JSON.stringify(wt.getHoldingsInExchange(wallet, 'binance'), null, 4));


wt.tradePebble(wallet, peb2, 'ETH', new big(2)); // trade 0.5 BTC on BTX to 1 ETH

console.log('BTC holdings (2 bittrex, 1 binance): ' + JSON.stringify(wt.getHoldingsInCoin(wallet, 'BTC'), null, 4));
console.log('ETH holdings (4 bittrex): ' + JSON.stringify(wt.getHoldingsInCoin(wallet, 'ETH'), null, 4));
console.log('bittrex holdings (2 BTC, 4 ETH): ' + JSON.stringify(wt.getHoldingsInExchange(wallet, 'bittrex'), null, 4));
console.log('binace holdings (1 BTC): ' + JSON.stringify(wt.getHoldingsInExchange(wallet, 'binance'), null, 4));

wt.tradePebble(wallet, peb3, 'LTC', new big(3)); // trade 1 BTC on binance to 3 LTC

console.log('BTC holdings (2 bittrex): ' + JSON.stringify(wt.getHoldingsInCoin(wallet, 'BTC'), null, 4));
console.log('binace holdings (3 LTC): ' + JSON.stringify(wt.getHoldingsInExchange(wallet, 'binance'), null, 4));
console.log('LTC holdings (3 binance): ' + JSON.stringify(wt.getHoldingsInCoin(wallet, 'LTC'), null, 4));

wt.transferPebble(wallet, peb, 'binance', new big(0.1)); // transfer 2 BTC on btx to 1.9 on binance

console.log('BTC holdings (1.9 binance): ' + JSON.stringify(wt.getHoldingsInCoin(wallet, 'BTC'), null, 4));
console.log('bittrex holdings (4 eth): ' + JSON.stringify(wt.getHoldingsInExchange(wallet, 'bittrex'), null, 4));
console.log('binace holdings (3 LTC, 1.9 BTC): ' + JSON.stringify(wt.getHoldingsInExchange(wallet, 'binance'), null, 4));

wt.transferPebble(wallet, peb2, 'binance', new big(0.2)); // transfer 1 ETH on btx to 0.8 on binance

console.log('ETH holdings (3 bittrex, 0.8 binance): ' + JSON.stringify(wt.getHoldingsInCoin(wallet, 'ETH'), null, 4));
console.log('bittrex holdings (3 eth): ' + JSON.stringify(wt.getHoldingsInExchange(wallet, 'bittrex'), null, 4));
console.log('binace holdings (3 LTC, 1.9 BTC, 0.8 ETH): ' + JSON.stringify(wt.getHoldingsInExchange(wallet, 'binance'), null, 4));

require('./Snapshots').takeSnapshots();


var curTime = util.timestamp(),
    otherTime = "July 10th 19, 1:00:18 am";

console.log('Delta T: ' + util.deltaTString(curTime, otherTime));


