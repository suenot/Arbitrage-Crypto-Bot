const ccxt = require('ccxt'),
      clone = require('clone'),
      gr = require('./Graph'),
      ll = require('./LinkedList'),
      fs = require('fs'),
      as = require('./ArraySet'),
      wt = require('./Wallet'),
      big = require('bignumber.js'),
      sha = require('object-hash'),
      { timestamp, runId, getPriceId, log, deltaTString } = require('./Util'),
      keys = JSON.parse(fs.readFileSync('./keys.json', 'utf8')),
      mktToCoins = mkt => mkt.includes('/') ? mkt.split('/') : [ mkt ], // market symbol (a slash pair) to coins array
      opts = (args) => {
      	// we have our own rate limiting but theirs can't hurt
      	args.rateLimit = args.rateLimit || 2000;
      	args.enableRateLimit = args.enableRateLimit !== false, // true unless explicitly false
      	args.nonce = function () { return this.milliseconds() };
      	return args;
      };

big.set({ DECIMAL_PLACES: 20 });

var exchanges, // array of exchange objects
    exchangeMap = {}, // map from exchange ids to objects in the above exchanges array
    arbGraph;

function initializeExchanges() {
	const exchangeIds = Object.keys(keys),
	      promises = [];

	exchanges = exchangeIds.map(id => {
		const exchangeClass = ccxt[id],
		      exchange = new exchangeClass(opts(keys[id])),
		      obj = {
		        xt: exchange, // the ccxt exchange object
		        id: id, // pulled out for convenience
		        reqQueue: ll.empty(), // rate-limited queue of requests
		        arbMarkets: undefined, /* set once initialize arb markets is called
		            {
		            	symbol
		            	bid
		            	ask
		            	spread
		            } */
		        symbolMap: {}, // maps market symbols to their market objects in arbMarkets (to get price data by symbol)
		        loaded: false, // set to true once promise resolves successfully
		      };

		exchangeMap[id] = obj;

		promises.push(exchange.loadMarkets().then(() => obj.loaded = true, () => obj.loaded = false));

		return obj;
	});

	return Promise.all(promises).then(initializeArbMarkets);
}

// add a request suspension on the exchange
// queue elements are only removed once they're done, and only then trigger the next request
function newRequest(susp, exchange) {
	const queue = exchange.reqQueue;

	return new Promise((res, err) => {
		// add the suspension which resolves the returned promise with the request promise and then checks for more requests
	    ll.enq(queue, () => {
	    	res(susp()); //resolve with the value of the request

	    	setTimeout(() => {
			    ll.deq(queue); // pop the request just sent in rate limit milliseconds
    
			    if (!queue.e)
			    	queue.h.d(); // send request now at queue head
    
		    }, exchange.xt.rateLimit);
	    });
    
	    if (queue.s === 1)
	    	queue.h.d();
	});
}

// get coins which appear on at least two exchanges or appear in more than two markets on one exchange
function getArbCoins() {
	const allCoins = new Set(),
	      arbCoins = as.empty();

	// add each exchanges coins to allCoins AFTER looping through the whole exchange
	// if something is already in allCoins, it therefore couldn't have come from the current exchange
	// and thus appears in at least 2 exchanges
	for (var i = 0; i < exchanges.length; i++) {
		const markets = exchanges[i].xt.symbols,
		      exchangeCoinFrequencies = {},
		      exchangeCoins = []; // array set so it can be spread

		// for each coin on a given exchange
		for (var j = 0; j < markets.length; j++) {
			const market = markets[j],
			      coins = mktToCoins(market); // brackets needed here?

			for (var k = 0; k < coins.length; k++) {
				const coin = coins[k];

				if (coin in exchangeCoinFrequencies) { // seen before, update frequency, add it to arbitrage set when it hits 3
				    if ((++exchangeCoinFrequencies[coin]) === 3) as.add(arbCoins, coin);
				} else { // new coin
					exchangeCoins.push(coin);
					exchangeCoinFrequencies[coin] = 1;
				}

				if (allCoins.has(coin)) // coins which already appeared in a different exchange now have appeared twice
					as.add(arbCoins, coin);
			}
		}

		for (var j = 0; j < exchangeCoins.length; j++) allCoins.add(exchangeCoins[j]);
	}

	return arbCoins;
}

// requires exchanges are initialized
// adds to exchanges array the arbitragable markets for each exchange (the markets to be tracked)
function initializeArbMarkets() {
	const arbCoins = getArbCoins();

	log.info('Arb coins: ' + arbCoins.length);

	for (var i = 0; i < exchanges.length; i++) {
		const exchange = exchanges[i];

		// only keep markets from that exchange where all coins are in the arb coins set
		exchange.arbMarkets = exchange.xt.symbols.filter(symbol => mktToCoins(symbol).every(c => as.has(arbCoins, c))).map(symbol => {
			const market = { symbol };
			exchange.symbolMap[symbol] = market; // add to map so you can reference by symbol

			return market;
		});
	}
}

// requires exchanges are initialized
// gets all market prices by default, can be supplied a predicate on symbols and exchangeIds
// to only pull those passing the predicate
function loadPrices(doMonitor, marketPredicate) {
	const promises = [];

	for (var i = 0; i < exchanges.length; i++) {
		const exchange = exchanges[i],
		      markets = exchange.arbMarkets;

		for (var j = 0; j < markets.length; j++) {
			const market = markets[j];

			if (!marketPredicate || marketPredicate(market.symbol, exchange.id))
			    promises.push(newRequest(() => exchange.xt.fetchOrderBook(market.symbol), exchange).then(book => {
                    const bid = book.bids.length ? book.bids[0][0] : undefined,
                          ask = book.asks.length ? book.asks[0][0] : undefined,
                          spread = (bid && ask) ? ask - bid : undefined;

                    market.bids = book.bids || undefined;
                    market.asks = book.asks || undefined;
                    market.bid = bid;
                    market.ask = ask;
                    market.spread = spread;
			    }, err => log.error('Error fetching orderbook for ' + market.symbol + ': ' + err.stack)));
		}
	}
	if (doMonitor)
	    monitorRequests();

	log.info('Getting ' + promises.length + ' prices');

	return Promise.all(promises);
}

function getPrice(exchangeId, symbol, getBid) {
	return exchangeMap[exchangeId].symbolMap[symbol][getBid ? 'bid' : 'ask'];
}

function monitorRequests() {
    var handle = setInterval(() => {
    	if (exchanges.every(e => e.reqQueue.s === 0)) {
    		log.info('Done with requests');
    		return clearInterval(handle);
    	}

    	console.log('\n\n');
    
    	for (var i = 0; i < exchanges.length; i++)
    		console.log(exchanges[i].id + ' request queue size: ' + exchanges[i].reqQueue.s);
    
    }, 1000);
}

// given trade edge from start to end on some exchange (and optional price overrides)
// get the constant you multiply some amount of start by to get the amount of end the trade would give
// returns a big, not a number, unless there's no market price, then undefined is returned
function endPerStart(edge, priceOverrides) {
    const metadata = edge._m,
    	  start = edge._s,
    	  end = edge._e,
    	  { exchangeId, startIsBase } = metadata, // if start is base you're a seller, so you accept bid price
    	  base = startIsBase ? start : end,
    	  quote = startIsBase ? end : start,
    	  symbol = base + '/' + quote,
    	  exchange = exchangeMap[exchangeId],
    	  market = exchange.xt.markets[symbol],
    	  percentTradeFee = Math.max(market.taker, market.maker),
    	  priceOverride = priceOverrides && priceOverrides[getPriceId(symbol, exchangeId, startIsBase)],
    	  marketPrice = new big(priceOverride || exchange.symbolMap[symbol][startIsBase ? 'bid' : 'ask']),
    	  endPerStartNoFees = startIsBase ? marketPrice : (new big(1)).dividedBy(marketPrice),
    	  endPerStart = endPerStartNoFees.times(1 - percentTradeFee);

    return marketPrice.isNaN() ? undefined : endPerStart;
}

// requires exchanges are initialized
// given an arbitrage cycle A originating at coin b1, compute how much profit would be made if c units of q1 were arbitraged
// price overrides allows an override of the current prices via a map from prices ids (symbol, exchange, bid/ask) to prices
function percentReturn(A, c, priceOverrides) {
	const startQuote = new big(c);
	var currentStartHolding = startQuote;

	for (var i = 0; i < A.length; i++) {

		const edge = A[i],
		      endWithFees = endPerStart(edge, priceOverrides).times(currentStartHolding);

		if (endWithFees === undefined)
			return 'Missing market price';
		     
		// console.log(exchange.id, exchange.symbolMap[symbol]);
		// console.log('\ncurrent start holding: ' + currentStartHolding);
		// console.log('percent trade fee: ' + percentTradeFee);
		// console.log('market price: ' + marketPrice);
		// console.log('endPerStart: ' + endPerStart);
		// console.log('endNoFees: ' + endNoFees);
		// console.log('endWithFees: ' + endWithFees);

		currentStartHolding = endWithFees; // next start is previous end

		// if there's another edge to follow on a different exchange, factor in the cost of doing so
		if (i !== A.length - 1 && A[i + 1]._m.exchangeId !== exchangeId) {
			const withdrawalFee = exchange.xt.currencies[end].fee;
			
			/*

			THIS AINT IT CHIEF


            if (withdrawalFee === undefined)
				console.log('Exchange ' + edge._m + ' withdrawal fee undefined on ' + base);



			*/
			currentStartHolding = currentStartHolding.minus(+(withdrawalFee || 0));
		}
	}

	return currentStartHolding.dividedBy(startQuote).minus(1).toNumber();
}

// requires exchanges initialized
// returns graph where nodes are just coins
function getArbGraph() {
	const G = gr.newGraph();

	for (var i = 0; i < exchanges.length; i++) {
		const exchange = exchanges[i],
		      exchangeId = exchange.id,
		      arbMarkets = exchange.arbMarkets;

		for (var j = 0; j < arbMarkets.length; j++) {
			const market = arbMarkets[j],
			      coins = mktToCoins(market.symbol);

			gr.addEdge(G, coins[0], coins[1], { exchangeId, startIsBase: true });
			gr.addEdge(G, coins[1], coins[0], { exchangeId, startIsBase: false });
		}
	}

	return G;
}

// given an arb cycle and a wallet state, return all reasonable paths of execution
// requires all trades in arb cycle can be taken
function getAllExecutions(cycle, wallet) {
	const executions = [],
	      cycle = cycle.map(edge => {
	      	const newEdge = clone(edge);
	      	newEdge._m.isTrade = true;
	      	return newEdge;
	      });

	getAllExecutionsHelper(cycle, wallet, executions, [[]], 1); // currently allow for up to 1 transfer, later a time will be supplied
	return executions;
}


function getAllExecutionsHelper(cycle, tradeEdgeIndex, wallet, executions, curExecution, remainingTransfers) {

	const edge = cycle[tradeEdgeIndex],
	      startCoin = edge._s,
	      endCoin = edge._e,
	      { exchangeId } = edge._m,
	      coinHoldings = wt.getHoldingsInCoin(startCoin),
	      exchangeHoldings = wt.getHoldingsInExchange(exchangeId),
	      holdingInStartOnExchange = exchangeHoldings.find(holding => holding.coin === startCoin), // can only be one holding in start on exchange (but multiple pebbles!)
	      curPath = curExecution[curExecution.length - 1];

	// check if the coin is immediately available on given exchange
	// in this case, the only option is to take the trade
	if (holdingsInStart.length > 0) {

		const endPerStart = endPerStart(edge),
		      newWallet = clone(wallet),
			  newPath = curPath.slice(); // copy path (no need to clone, we can share the pointers to the trade edges, these won't be mutated later)

		newPath.push(edge);

		// currently just chooses any pebble, fair only if every pebble is juicy, will need logic to merge dead pebbles
		wt.tradePebble(newWallet, holdingInStartOnExchange.pebbles[0], endCoin, endPerStart);

		getAllExecutionsHelper(cycle, tradeEdgeIndex + 1, newWallet, paths, newPath, remainingTransfers);

	} else { // consider taking fastest transfer from coin holdings, or best trade on exchange

		if (remainingTransfers > 0 && coinHoldings.length > 0) { // if you choose to transfer
			const newWallet = clone(wallet),
			      newPath = curPath.slice(),
			      transerPebble = coinHoldings[0].pebbles[0]; // currently takes any holding in coin first pebble, should take transfer on fastest exchange in coin holdings, and need invariant that every pebble is juicy

			newPath.push({ _s: tradePebble.exchangeId, _e: exchangeId, _m: { isTrade: false }});
			// currently just takes any transfer, eventually will take fastest

		}

		if (exchangeHoldings.length > 0) {

		}
	}

}

// requires exchanges are initialized
function loadExchangesFromFile() {
	const exchangeData = JSON.parse(fs.readFileSync('./priceData/marketPrices1560917049302.json'));

	for (var i = 0; i < exchangeData.length; i++) {
		const arbMarketData = exchangeData[i].arbMarkets,
		      symbolMap = exchanges[i].symbolMap;

		for (var j = 0; j < arbMarketData.length; j++) {
			const marketData = arbMarketData[j],
			      market = symbolMap[marketData.symbol];

			if (market) {
				market.bid = marketData.bid;
                market.ask = marketData.ask;
                market.spread = marketData.spread;
			}
		}
	}
}

function exchangeDataToFile() {
	const exchangeCopies = [];
	for (var i = 0; i < exchanges.length; i++) {
		const exchange = exchanges[i],
		      copy = {
		      	id: exchange.id,
		      	arbMarkets: exchange.arbMarkets
		      };
		exchangeCopies.push(copy);
	}
	fs.writeFileSync('./priceData/marketPrices' + timestamp() + '.json', JSON.stringify(exchangeCopies));
}

module.exports = { initializeExchanges, loadPrices, getPrice, percentReturn, getArbGraph, loadExchangesFromFile, exchangeDataToFile };

// initializeExchanges().then(() => loadPrices(true).then(()  => {
// 	exchangeDataToFile();

// 	const G = getArbGraph(),
// 	      cycles = gr.getAllNCyclesFromS(G, 3, [ 'BTC' ]),
// 	      money = cycles.map(c => { return { cycle: c, pr: percentReturn(c, 1) }; });

// 	console.log('Possible arbitrages: ' + cycles.length);
// 	const winners = money.filter(x => typeof x.pr === 'number' && x.pr > 0).sort((x, y) => y.pr - x.pr).slice(0, 50);

// 	console.log(JSON.stringify(winners, null, 4));
// }));
