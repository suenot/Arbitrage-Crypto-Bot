const as = require('./ArraySet'),
      gr = require('./Graph'),
      ex = require('./Exchanges'),
      fs = require('fs'),
      sha = require('object-hash'),
      { timestamp, runId, getPriceId, log, deltaTString } = require('./Util'),
      arbCycleSnapshots = as.empty(snap => sha(snap.cycle)),
      updateTimeStep = 1000 * 60 * 3, // 3 minutes between updates of just interesting markets
      updatesPerRediscover = 3, // 9 minutes between updating all markets
      edgeToMarketId = edge => (edge._m.startIsBase ? (edge._s + '/' + edge._e) : (edge._e + '/' + edge._s)) + ':' + edge._m.exchangeId,
      newVisit = curTime => {
      	return { startTime: curTime, maxPr: 0, worstCasePrices: {}, prs: [], totalPr: 0, timeSteps: 0 };
      };

var prevArbCycles = as.empty(x => x.hash), // hashes of all arb cycles which are currently profitable
    marketIds, // set of the symbol/exchangeId pairs of those needing to be pulled (profitable above 0.0)
    lastUpdate, // last time apis were queried
    updateStep = 0;

      // Profitable above 0.05
      /*{
      	visits: [{
      		maxPr:
      	    startTime:
      	    endTime:
      	    timeProfitable: how long was it profitable for

      	    worstCasePrices: { // all the worst prices we could've gotten if trades occured at worst times (highest least asks and lowest max bids)
      	    	'ETH/BTC:bittrex|bid': 
      	    },
      	    worstCasePr: // pr if we traded at the worst possible times
      	    prs: // array of prs for each update where it was profitable
    
      	    avgPr:
      	    // will delete those, used to compute avg
      	    totalPr:
      	    timeSteps:

      	}]
      	cycle
      }

      */

function loopSnapshots() {
	const dontLoadAll = updateStep % updatesPerRediscover !== 0;
	log.info('\nLoading ' + (dontLoadAll ? 'interesting' : 'all') + ' market prices...');
	// loadExchangesFromFile();
	lastUpdate = Date.now();
	ex.loadPrices(true, dontLoadAll && ((symbol, exchangeId) => marketIds.has(symbol + ':' + exchangeId))).then(() => {
	    updateSnapshots();
	    const timeTilNext = Math.max(updateTimeStep + lastUpdate - Date.now(), 1000 * 60);
	    updateStep++;
	    log.info('Waiting ' + deltaTString(timeTilNext) + ' before pulling for timestep ' + updateStep + '...');
	    setTimeout(loopSnapshots, timeTilNext);
	}).catch(err => log.error('Error getting prices: ' + err.stack));
}

function updateSnapshots() {

	const curTime = timestamp(),
	      G = ex.getArbGraph(),
	      cyclesOnRadar = gr.getAllNCyclesFromS(G, 3, [ 'BTC' ]).map(c => {
	      	return { cycle: c, pr: ex.percentReturn(c, 1) };
	      }).filter(x => typeof x.pr === 'number' && x.pr > 0.01 && x.pr < 0.5).sort((x, y) => y.pr - x.pr), // cycles which could become profitable
	      arbCycles = as.empty(x => x.hash); // cycles which are currently profitable/which we should snapshot

	marketIds = new Set(); // market ids of those to pull

	log.info('\nUpdating snapshots');

	// add all markets which should be on the radar to the set of those to pull, and to arbCycles the profitable cycles to snapshot
	for (var i = 0; i < cyclesOnRadar.length; i++) {
		const { cycle, pr } = cyclesOnRadar[i];

		if (pr > 0.05)
			as.add(arbCycles, { cycle, hash: sha(cycle), pr });

		for (var j = 0; j < cycle.length; j++) // pull data on anything in cycles on radar (above 0.01)
			marketIds.add(edgeToMarketId(cycle[j]));
	}

	// update the snapshots with the current price data
	for (var i = 0; i < arbCycles.length; i++) {
		const { hash, cycle, pr } = arbCycles[i],
		      snapshot = arbCycleSnapshots._elem[hash] || {
		      	cycle,
		      	visits:[ newVisit(curTime) ]
		      },
		      visits = snapshot.visits;

		if (visits[visits.length - 1].endTime) // if last visit already ended, create a new one
			visits.push(newVisit(curTime));

		const visit = visits[visits.length - 1], // the visit this update is a part of
		      { worstCasePrices } = visit; 

		as.add(arbCycleSnapshots, snapshot); // redundant add if the above || short circuited

		visit.prs.push(pr);
		visit.totalPr += pr;
		visit.timeSteps++;

		if (pr > visit.maxPr)
			visit.maxPr = pr;

		// update the worst case prices
		for (var j = 0; j < cycle.length; j++) {
			const edge = cycle[j],
			      { exchangeId, startIsBase } = edge._m,
			      symbol = startIsBase ? (edge._s + '/' + edge._e) : (edge._e + '/' + edge._s),
			      priceId = getPriceId(symbol, exchangeId, startIsBase),
			      curPrice = ex.getPrice(exchangeId, symbol, startIsBase); // startIsBase ? 'bid' : 'ask'

		    worstCasePrices[priceId] = worstCasePrices[priceId] ? (startIsBase ? Math.min : Math.max)(curPrice, worstCasePrices[priceId]) : curPrice;
		}
	}


	// finalize the visits which just finished
	for (var i = 0; i < prevArbCycles.length; i++) {
		const hash = prevArbCycles[i].hash;
		if (!arbCycles._elem[hash]) { // was profitable and no longer is
			const snapshot = arbCycleSnapshots._elem[hash],
			      newestVisit = snapshot.visits[snapshot.visits.length - 1]; // the visit which just ended

			newestVisit.endTime = curTime;
			newestVisit.timeProfitable = deltaTString(newestVisit.endTime - newestVisit.startTime);
			newestVisit.avgPr = newestVisit.totalPr / newestVisit.timeSteps;
			newestVisit.worstCasePr = ex.percentReturn(snapshot.cycle, 1, newestVisit.worstCasePrices);
			delete newestVisit.totalPr;
			delete newestVisit.timeSteps;
			delete newestVisit.worstCasePrices;
		}
	}

	prevArbCycles = arbCycles;

	log.info(arbCycles.length + ' profitable arbitrages, ' + cyclesOnRadar.length + ' arbitrages on the radar\nTop 20 prs: ' + arbCycles.slice(0, 20).map(x => x.pr));

	fs.writeFileSync('./snapshots/' + runId + '.snap', JSON.stringify(arbCycleSnapshots, null, 4));
}

function takeSnapshots() {
	log.info('Bot run: "' + runId + '"');
	ex.initializeExchanges().then(loopSnapshots).catch(err => log.error('Error initializing: ' + err.stack));
}

module.exports = { takeSnapshots };
