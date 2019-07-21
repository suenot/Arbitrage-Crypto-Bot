const as = require('./ArraySet');

// wallet is a map from coins and exchanges to holdings by exchange and coin respectively, where each
// holding (coin/exchange) pair can have multiple pebbles
// the invariant is maintained that:
//   as.get(getHoldingsInCoin(wallet, coin), exchangeId) === as.get(getHoldingsInExchange(wallet, exchangeId), coin)
//   so the holding (metadata + pebbles list) is shared by both lists of holdings in the maps indexed by coin/exchange

function empty() {
	return {
		coinMap: new Map(),
		exchangeMap: new Map(),
		pebbleIdMap: new Map()
	};
}

// requires wallet has pebble, private method
function removePebble(wallet, pebble) {
	const { exchangeId, coin, amount, pebbleId } = pebble,
	      holdingsInCoin = getHoldingsInCoin(wallet, coin), // could have lookup up by exchange too
	      holding = as.get(holdingsInCoin, exchangeId);

	holding.amount = holding.amount.minus(amount);

	as.remove(holding.pebbles, pebbleId);
	wallet.pebbleIdMap.delete(pebbleId);


	if (holding.pebbles.length === 0) { // last pebble for this coin/exchangeId pair
		as.remove(holdingsInCoin, exchangeId);
		as.remove(getHoldingsInExchange(wallet, exchangeId), coin);
	} else if (holding.amount <= 0)
	    throw new Error(`Negative holding in ${exchangeId}:${coin} after trade or transfer`);
}

function addPebble(wallet, pebble) {

	const { exchangeId, coin, amount, pebbleId } = pebble;

	wallet.pebbleIdMap.set(pebbleId, pebble);

	if (!wallet.coinMap.has(coin))
		wallet.coinMap.set(coin, as.empty(holding => holding.exchangeId)); // each coin has an ArraySet indexed by exchange where its holdings (pebbles + metadata) are stored

	if (!wallet.exchangeMap.has(exchangeId))
		wallet.exchangeMap.set(exchangeId, as.empty(holding => holding.coin)); // each exchange has an ArraySet indexed by coin where its holdings (pebbles + metadata) are stored

	const coinArray = wallet.coinMap.get(coin),
	      exchangeArray = wallet.exchangeMap.get(exchangeId),
	      lookup = as.get(coinArray, exchangeId); // lookup in ArraySet for given coin by exchange (equivalent to as.get(exchangeArray, coin) because these have same elements)

	if (lookup) {
		lookup.amount = lookup.amount.plus(amount);

	    as.add(lookup.pebbles, pebble);
	} else {
		const pebbles = as.empty(pebble => pebble.pebbleId),
		      holding = { coin, exchangeId, amount, pebbles };

		as.add(pebbles, pebble);

		as.add(exchangeArray, holding);
		as.add(coinArray, holding);
	}
}

// requires pebble is in wallet
// requires endCoinPerStart > 0
// has side effect of actually changing passed in pebble
function tradePebble(wallet, pebble, endCoin, endCoinPerStartCoin) {
	removePebble(wallet, pebble);

	pebble.coin = endCoin;
	pebble.amount = pebble.amount.times(endCoinPerStartCoin);

	addPebble(wallet, pebble);
}

// requires pebble is in wallet
// has side effect of actually changing passed in pebble
function transferPebble(wallet, pebble, endExchangeId, transferFee) {
	removePebble(wallet, pebble);

	pebble.exchangeId = endExchangeId;
	pebble.amount -= transferFee;

	if (pebble.amount <= 0)
		throw new Error(`Transfer fee on ${exchangeId}:${coin} greater than holding itself`);

	addPebble(wallet, pebble);
}


function getHoldingsInCoin(wallet, coin) {
	return wallet.coinMap.get(coin) || as.empty(holding => holding.exchangeId);
}

function getHoldingsInExchange(wallet, exchangeId) {
	return wallet.exchangeMap.get(exchangeId) || as.empty(holding => holding.coin);
}

function getPebble(wallet, pebbleId) {
	return wallet.pebbleIdMap.get(pebbleId);
}

module.exports = { empty, addPebble, tradePebble, transferPebble, getPebble, getHoldingsInExchange, getHoldingsInCoin };
