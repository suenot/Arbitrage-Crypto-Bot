const ccxt = require('ccxt'),
      gr = require('./Graph'),
      as = require('./ArraySet'),
      ll = require('./LinkedList'),
      fs = require('fs'),
      keys = JSON.parse(fs.readFileSync('./keys.json', 'utf8')),
      mktToCoins = mkt => mkt.includes('/') ? mkt.split('/') : [ mkt ], // market symbol (a slash pair) to coins array
      opts = (args) => {
      	// we have our own rate limiting but theirs can't hurt
      	args.rateLimit = args.rateLimit || 2000;
      	args.enableRateLimit = args.enableRateLimit !== false, // true unless explicitly false
      	args.nonce = function () { return this.milliseconds() };
      	return args;
      };

var exchanges, arbGraph;

function initializeExchanges() {
	const exchangeIds = Object.keys(keys),
	      promises = [];

	exchanges = exchangeIds.map(id => {
		const exchangeClass = ccxt[id],
		      exchange = new exchangeClass(opts(keys[id])),
		      obj = {
		        xt: exchange, // the ccxt exchange object
		        name: exchange.name, // pulled out for convenience
		        reqQueue: ll.empty(), // rate-limited queue of requests
		        arbMarkets: undefined, // set once initialize arb markets is called
		        loaded: false, // set to true once promise resolves successfully
		      };

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
	    	res(susp());

	    	setTimeout(() => {
			    ll.deq(queue);
    
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

	console.log('Arb coins: ' + arbCoins.length);

	for (var i = 0; i < exchanges.length; i++) {
		const exchange = exchanges[i];

		// only keep markets from that exchange where all coins are in the arb coins set
		exchange.arbMarkets = exchange.xt.symbols.filter(m => mktToCoins(m).every(c => as.has(arbCoins, c))).map(m => { return { symbol: m }; });
	}
}

// requires exchanges are initialized
function getPrices(doMonitor) {
	const promises = [];

	for (var i = 0; i < exchanges.length; i++) {
		const exchange = exchanges[i],
		      markets = exchange.arbMarkets;

		for (var j = 0; j < markets.length; j++) {
			const market = markets[j];

			promises.push(newRequest(() => exchange.xt.fetchOrderBook(market.symbol), exchange).then(book => {
                const bid = book.bids.length ? book.bids[0][0] : undefined,
                      ask = book.asks.length ? book.asks[0][0] : undefined,
                      spread = (bid && ask) ? ask - bid : undefined;

                market.bid = bid;
                market.ask = ask;
                market.spread = spread;
			}, error => console.log(error)));
		}
	}
	if (doMonitor)
	    monitorRequests();

	return Promise.all(promises);
}

// requires exchanges are initialized
function getArbGraph() {
	const g = gr.empty();


}

initializeExchanges().then(() => getPrices(true).then(() => {
	const exchangeCopies = [];
	for (var i = 0; i < exchanges.length; i++) {
		const exchange = exchanges[i],
		      copy = {
		      	name: exchange.name,
		      	arbMarkets: exchange.arbMarkets
		      };
		exchangeCopies.push(copy);
	}
	fs.writeFileSync('./marketPrices.json', JSON.stringify(exchangeCopies));
}));

function monitorRequests() {
    var handle = setInterval(() => {
    	if (exchanges.every(e => e.reqQueue.s === 0)) {
    		console.log('Done with requests');
    		return clearInterval(handle);
    	}

    	console.log('\n\n');
    
    	for (var i = 0; i < exchanges.length; i++)
    		console.log(exchanges[i].name + ' request queue size: ' + exchanges[i].reqQueue.s);
    
    }, 1000);
}


