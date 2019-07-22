const apiKey = "4ee5956e-ef0a-49bd-910f-3aa5b75e4241",
      { performance } = require('perf_hooks'),
      rp = require('request-promise'),
      rateLimit = 288000,
      cryptoQuotesDataCache = new Map(), // cache of all interesting data from the crypto quotes endpoint and the time it was recieved
      cryptoQuotesRequestBacklog = new Map(), // backlog of requests for the cryptocurrency quotes endpoint
      getCryptoQuotesRequestOptions = symbols => {
      	return {
            method: 'GET',
            uri: 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest',
            qs: {
                'symbol': symbols.join(','),
                'convert': 'USD'
            },
            headers: {
                'X-CMC_PRO_API_KEY': apiKey
            },
            json: true,
            gzip: true
      	};
      },
      now = () => performance.now(),
      newBacklogEntry = maxWaitMs => { return { dollarValueRequests:[], timeNeededBy: now() + maxWaitMs } },
      pullCryptoQuotesEventually = timeNeededBy => { // pulls quotes after timeNeededBy, but as close to timeNeededBy as possible
        const checkTime = () => setTimeout(() => { // (ensures after so that getCryptoQuotes necessarily pulls quotes which call pullCryptoQuotesEventually with their backlog's timeNeededBy)
        	const curTime = now();
        	if (curTime >= timeNeededBy)
        	    getCryptoQuotes();
        	else
        		checkTime();
        }, Math.max(1, Math.ceil(timeNeededBy - now()))); // set timeout for difference between when its needed and now, resetting the timer if it fires a little early
        checkTime();
      };

// get the usd price in a promise
// acceptableOutdatedness is how long ago this data can have been pulled
// maxWaitMs is how long we can put off sending this request for the sake of batching
function dollarValue(coin, acceptableOutdatednessMs, maxWaitMs) {

	const lookup = cryptoQuotesDataCache.get(coin),
	      curTime = now(),
	      mustRequest = acceptableOutdatednessMs === 0 || !lookup || !lookup.USD || (curTime - lookup.time) > acceptableOutdatednessMs;

	if (mustRequest) {
		return new Promise((resolve, reject) => {
			if (requestBacklog.has(coin)) {
				cryptoQuotesRequestBacklog.dollarValueRequests.push(resolve);
			    cryptoQuotesRequestBacklog.timeNeededBy = Math.min(curTime + maxWaitMs, cryptoQuotesRequestBacklog.timeNeededBy);

			    pullCryptoQuotesEventually(cryptoQuotesRequestBacklog.timeNeededBy);
			} else {
				const backlog = newBacklogEntry(maxWaitMs);

				backlog.dollarValueRequests.push(resolve);
				cryptoQuotesRequestBacklog.set(coin, backlog);

				if (cryptoQuotesRequestBacklog.size === 100)
					getCryptoQuotes();
				else
					pullCryptoQuotesEventually(maxWaitMs);
			}
		});
	} else return new Promise.resolve(lookup.USD);
}

// will send as many requests as are immediately needed 
function getCryptoQuotes() {

	const reqTime = now(),
	      symbolsSet = new Set();

	cryptoQuotesRequestBacklog.forEach((entry, coin) => {
		if (reqTime >= entry.timeNeededBy)
			symbolsSet.add(coin);
	});

	const numCoinsNeeded = symbols.size;

	if (numCoinsNeeded === 0) // none are immediately needed, we'll get them later
		return;

	// tack on any additional requests which are needed eventually to bring us up to the nearest 100
	const symbols = numCoinsNeeded % 100 === 0 ? Array.from(symbolsSet) : symbols = symbols.concat(Array.from(cryptoQuotesRequestBacklog.keys()).filter(coin => !symbolsSet.has(coin)).slice(0, 100 - (numCoinsNeeded % 100)));

	// copy the backlogged requests to fulfill them later, and delete them so they don't get sent twice
    const backlogCopy = new Map(cryptoQuotesRequestBacklog);
    symbols.forEach(coin => cryptoQuotesRequestBacklog.delete(coin));
    
    rp(getCryptoQuotesRequestOptions(symbols)).then(response => {

    	symbols.forEach(coin => {
    		const USD = response.data[symbol].quote.USD.price;

    		backlogCopy.get(coin).dollarValueRequests.forEach(resolver => resolver(USD)); // fulfill the requests from before we called the api

    		if (cryptoQuotesRequestBacklog.has(coin)) { // fulfill any requests which came in after we called the api
    		    cryptoQuotesRequestBacklog.get(coin).dollarValueRequests.forEach(resolver => resolver(USD));
    		    cryptoQuotesRequestBacklog.delete(coin); // no more requests for symbol
    		}

    		if (!cryptoQuotesDataCache.has(coin))
    			cryptoQuotesDataCache.set(coin, {});

    		const lookup = cryptoQuotesDataCache.get(coin); // add to the cache
    		lookup.time = reqTime;
    		lookup.USD = USD;
    	});

    }).catch((err) => {
        console.log('API call error:', err.message);
    });
}

function percentReturn(startCoin, endCoin, endPerStart) {

}

module.exports = { dollarValue, percentReturn };