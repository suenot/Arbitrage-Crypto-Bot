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

var exchanges;

function initializeExchanges() {
	const exchangeIds = Object.keys(keys),
	      promises = [];

	exchanges = exchangeIds.map(id => {
		const exchangeClass = ccxt[id],
		      exchange = new exchangeClass(opts(keys[id]));

		promises.push(exchange.loadMarkets());
		return {
		    xt: exchange, // the ccxt exchange object
		    reqQueue: ll.empty() // rate-limited queue of requests
		};
	});

	return Promise.all(promises);
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

	for (var i = 0; i < exchanges.length; i++) {
		const exchange = exchanges[i];

		// only keep markets from that exchange where all coins are in the arb coins set
		exchange.arbMarkets = exchange.xt.symbols.filter(s => mktToCoins(s).every(c => as.has(arbCoins, c)));
	}
}

initializeExchanges().then(() => {
	initializeArbMarkets();
	for (var i = 0; i < 1; i++) {
		const exc = exchanges[i];
		console.log(exc.xt.name, exc.arbMarkets.length);

	    const exchange = exchanges[i],
	          t = Date.now();
    
	    console.log('Should be ' + exchange.xt.rateLimit + ' ms apart');
	    newRequest(() => console.log('1: ' + (Date.now() - t)), exchange);
	    newRequest(() => console.log('2: ' + (Date.now() - t)), exchange);
	    newRequest(() => console.log('3: ' + (Date.now() - t)), exchange);

	    setTimeout(() => newRequest(() => console.log('4: ' + (Date.now() - t)), exchange), 1000);
	    setTimeout(() => newRequest(() => console.log('5: ' + (Date.now() - t)), exchange), 2000);

	    setTimeout(() => newRequest(() => console.log('6: ' + (Date.now() - t)), exchange), 7000);
	}
});


