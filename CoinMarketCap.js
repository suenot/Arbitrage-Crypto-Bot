const apiKey = "4ee5956e-ef0a-49bd-910f-3aa5b75e4241",
      { performance } = require('perf_hooks'),
      rp = require('request-promise'),
      rateLimit = 288000,
      lastCryptoQuotesCall = 0,
      cryptoQuotesDataCache = new Map(), // cache of all interesting data from the crypto quotes endpoint and the time it was recieved
      cryptoQuotesRequestBacklog = new Map(), // backlog of requests for the cryptocurrency quotes endpoint
      now = () => performance.now(),
      newBacklogEntry = () => { return { dollarValueRequests:[] } },
      pullCryptoQuotesEventually = (maxWaitMs) => { // pulls quotes if they haven't been pulled within maxWaitMs
      	  const curTime = now();
          setTimeout(() => {
      	    if (lastCryptoQuotesCall <= curTime)
      	    	getCryptoQuotes();
      	  }, maxWaitMs);
      };

// get a map from the supplied coins to their dollar price
// acceptableOutdatedness is how long ago this data can have been pulled
// maxWaitMs is how long we can put off sending this request for the sake of batching
function dollarValue(coin, acceptableOutdatednessMs, maxWaitMs) {

	const curTime = now(),
	      lookup = cryptoQuotesDataCache.get(coin),
	      mustRequest = acceptableOutdatednessMs === 0 || !lookup || !lookup.USD || (curTime - lookup.time) > acceptableOutdatednessMs;

	if (mustRequest) {
		return new Promise((resolve, reject) => {
			if (requestBacklog.has(coin))
				cryptoQuotesRequestBacklog.dollarValueRequests.push(resolve);

	            const curTime = now();

			    pullCryptoQuotesEventually(maxWaitMs);
			else {
				const backlog = newBacklogEntry();

				backlog.dollarValueRequests.push(resolve);
				cryptoQuotesRequestBacklog.set(coin, backlog);

				if (cryptoQuotesRequestBacklog.dollarValueRequests.length === 100)
					getCryptoQuotes();
				else
					pullCryptoQuotesEventually(maxWaitMs);
			}
		});
	} else return new Promise.resolve(lookup.USD);
}

// requires cryptoQuotesRequestBacklog has some coins, less than or equal to 100
function getCryptoQuotes() {

    const reqTime = now(),
    /*
     has the problem that if there are now 150 requests only the "first" (in insertion order) 100 
    will be sent, but these might not?? be the ones that were time constrained by some max ms wait 
    which caused this function to be called in the first place  
    */
          symbols = Array.from(cryptoQuotesRequestBacklog.keys()).slice(0, 100),
          requestOptions = {
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

    lastCryptoQuotesCall = reqTime;
    
    rp(requestOptions).then(response => {

    	symbols.forEach(symbol => {
    		const USD = response.data[symbol].quote.USD.price;

    		cryptoQuotesRequestBacklog.get(symbol).dollarValueRequests.forEach(resolver => resolver(USD));

    		cryptoQuotesRequestBacklog.delete(symbol); // no more requests for symbol

    		if (!cryptoQuotesDataCache.has(symbol))
    			cryptoQuotesDataCache.set(symbol, {});

    		const lookup = cryptoQuotesDataCache.get(symbol); // add to the cache
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