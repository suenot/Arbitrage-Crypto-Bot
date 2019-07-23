const apiKey = '4ee5956e-ef0a-49bd-910f-3aa5b75e4241',
      { performance } = require('perf_hooks'),
      big = require('bignumber.js'),
      { log } = require('./Util'),
      rp = require('request-promise'),
      rateLimit = 288000,
      batchSize = 100,
      cryptoQuotesDataCache = new Map(), // cache of all interesting data from the crypto quotes endpoint and the time it was recieved
      cryptoQuotesRequestBacklog = new Map(), // backlog of requests for the cryptocurrency quotes endpoint
      getCryptoQuotesRequestOptions = symbols => {
      	return {
            method: 'GET',
            uri: 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest',
            qs: {
                symbol: symbols.join(','),
                convert: 'USD'
            },
            headers: {
                'X-CMC_PRO_API_KEY': apiKey
            },
            json: true,
            gzip: true
        };
      },
      validateNumber = number => {
      	return !isNaN(number) && isFinite(number) && number >= 0;
      },
      validateBig = big => {
      	return !big.isNaN() && big.isFinite() && big.gte(0);
      },
      now = () => performance.now(),
      newBacklogEntry = maxWaitMs => { return { dollarValueRequests:[], timeNeededBy: now() + maxWaitMs }; },
      pullCryptoQuotesEventually = timeNeededBy => { // pulls quotes after timeNeededBy, but as close to timeNeededBy as possible
        const checkTime = () => setTimeout(() => { // (ensures after so that getCryptoQuotes necessarily pulls quotes which call pullCryptoQuotesEventually with their backlog's timeNeededBy)
        	if (now() >= timeNeededBy)
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

	if (!validateNumber(acceptableOutdatednessMs) || !validateNumber(maxWaitMs)) {
		log.error('CoinMarketCap dollar value function called without valid delta time args');
		return new Error('CoinMarketCap dollar value function called without valid delta time args');
	}

	const lookup = cryptoQuotesDataCache.get(coin),
	      curTime = now(),
	      mustRequest = acceptableOutdatednessMs === 0 || !lookup || !lookup.USD || (curTime - lookup.time) > acceptableOutdatednessMs;

	if (mustRequest) {
		return new Promise((resolve, reject) => {
			if (cryptoQuotesRequestBacklog.has(coin)) {
				cryptoQuotesRequestBacklog.get(coin).dollarValueRequests.push(resolve);
			    cryptoQuotesRequestBacklog.timeNeededBy = Math.min(curTime + maxWaitMs, cryptoQuotesRequestBacklog.timeNeededBy);

			    pullCryptoQuotesEventually(cryptoQuotesRequestBacklog.timeNeededBy);
			} else {
				const backlog = newBacklogEntry(maxWaitMs);

				backlog.dollarValueRequests.push(resolve);
				cryptoQuotesRequestBacklog.set(coin, backlog);

				if (cryptoQuotesRequestBacklog.size % batchSize === 0)
					getCryptoQuotes();
				else
					pullCryptoQuotesEventually(backlog.timeNeededBy);
			}
		});
	} else return Promise.resolve(lookup.USD);
}

// will send as many requests as are immediately needed, or any multiple of batch size
function getCryptoQuotes() {

	const reqTime = now(),
	      symbolsSet = new Set();

	cryptoQuotesRequestBacklog.forEach((entry, coin) => {
		if (reqTime >= entry.timeNeededBy)
			symbolsSet.add(coin);
	});

	const numCoinsNeeded = symbolsSet.size;

	// none are needed at all, or none are immediately needed and the ones we could send don't fit nicely into a batch, so don't send
	// (no need to send the largest multiple of batchsize requests queued in the second case because whenever we hit any multiple of batchsize we'd already have sent them)
	if (cryptoQuotesRequestBacklog.size === 0 || (numCoinsNeeded === 0 && cryptoQuotesRequestBacklog.size % batchSize !== 0))
		return;

	log.info(`CoinMarketCap: ${numCoinsNeeded} coins hit their time cutoff`);

	// tack on any additional requests which are needed eventually to bring us up to the nearest batchSize (no extra multiples of batchSize for same reason as above)
	const symbols = numCoinsNeeded % batchSize === 0 && numCoinsNeeded !== 0 ? Array.from(symbolsSet) : Array.from(symbolsSet).concat(Array.from(cryptoQuotesRequestBacklog.keys()).filter(coin => !symbolsSet.has(coin)).slice(0, batchSize - (numCoinsNeeded % batchSize)));

	log.info(`CoinMarketCap: ${symbols.length} coins were requested`);

	// copy the backlogged requests to fulfill them upon response, and delete them so they don't get sent twice
    const backlogCopy = new Map(cryptoQuotesRequestBacklog);
    symbols.forEach(coin => cryptoQuotesRequestBacklog.delete(coin));
    
    rp(getCryptoQuotesRequestOptions(symbols)).then(response => {

    	symbols.forEach(coin => {
    		const USD = response.data[coin].quote.USD.price;

    		backlogCopy.get(coin).dollarValueRequests.forEach(resolver => resolver(USD)); // fulfill the requests from before we called the api

    		if (cryptoQuotesRequestBacklog.has(coin)) { // fulfill any requests which came in after we called the api
    			log.info(`CoinMarketCap: Coin ${coin} fulfilled which came in after request was sent`);
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
        log.error(`CoinMarketCap API call error: ${err.message}`);
    });
}

// get percent return of a trade relative to dollars
function percentReturn(edge, endPerStart, acceptableOutdatednessMs, maxWaitMs) {
	if (!validateBig(endPerStart)) {
		log.error('CoinMarketCap percent return of edge function called without valid end per start ratio');
		return new Error('CoinMarketCap percent return of edge function called without valid end per start ratio');
	}
	return Promise.all([ dollarValue(edge._s, acceptableOutdatednessMs, maxWaitMs), dollarValue(edge._e, acceptableOutdatednessMs, maxWaitMs) ]).then(responses => {
		const [ usdPerStart, usdPerEnd ] = responses;
		return (new big(1)).dividedBy(usdPerStart).times(endPerStart).times(usdPerEnd).minus(1);
	});
}

module.exports = { dollarValue, percentReturn };