const as = require('./ArraySet');

function empty() {
	return {
		coinMap: new Map(),
		exchangeMap: new Map()
	};
}

function addHolding(wallet, pebble) {

	const { exchangeId, coin, amount, pebbleId } = pebble;

	if (!wallet.coinMap.has(coin))
		wallet.coinMap.set(coin, as.empty(holding => holding.exchangeId)); // each coin has an ArraySet indexed by exchange where its holdings are stored

	if (!wallet.exchangeMap.has(exchangeId))
		wallet.exchangeMap.set(exchangeId, as.empty(holding => holding.coin)); // each exchange has an ArraySet indexed by coin where its holdings are stored

	const coinArray = wallet.coinMap.get(coin),
	      exchangeArray = wallet.exchangeMap.get(exchangeId),
	      lookup = as.get(coinArray, exchangeId); // lookup in ArraySet for given coin by exchange (equivalent to as.get(exchangeArray, coin) because these have same elements)

	if (lookup) {
		lookup.totalAmount += amount;
	    as.add(lookup.pebbles, pebble);
	} else {
		const pebbles = as.empty(pebble => pebble.pebbleId),
		      holding = { coin, exchangeId, amount, pebbles };

		as.add(pebbles, pebble);

		as.add(exchangeArray, holding);
		as.add(coinArray, holding);
	}
}

// requires pebble is real
function tradePebble(wallet, pebble, endCoin) {

}


function getHoldingsInCoin(wallet, coin) {
	return wallet.coinMap.get(coin) || as.empty(holding => holding.exchangeId);
}

function getHoldingsInExchange(wallet, exchangeId) {
	return wallet.exchangeMap.get(exchangeId) || as.empty(holding => holding.coin);
}

module.exports = { empty, addHolding, getHoldingsInExchange, getHoldingsInCoin };
