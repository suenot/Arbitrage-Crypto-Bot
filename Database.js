
const ex = require('./Exchanges');
const assert = require('assert');

const url = 'mongodb://localhost:27017';
const mongo = require('mongodb').MongoClient;
const client = new mongo(url, { useNewUrlParser: true});
const dbName = 'arbyTimes';


client.connect((err) => {
    assert.equal(null, err);
    console.log('Test Connect to DB works');
    const db = client.db(dbName);
    client.close();
});




function getBlockchainTime(coinId){
    return client.connect((err) => {
        const db = client.db(dbName);
        const coinCollection = db.collection('coin');
        coinCollection.find({id: coinId}).toArray(function(err,docs){
            if (docs.length == 0){ // add the coin
                const defaultInitialTime = 1800000; // 30 mins
                coinCollection.insertOne({id: coinId, total_time: defaultInitialTime, calls: 1});
                return defaultInitialTime; 
            }
            return docs[0].total_time / docs[0].calls;
        });
    });
}

function getExchangeTradeTime(exId){
    return client.connect((err) => {
        const db = client.db(dbName);
        const exchangeCollection = db.collection('exchange');
        exchangeCollection.find({id: exId}).toArray(function(err,docs){
            if (docs.length == 0){ // add the coin
                const defaultInitialTime = 1000; // 1 min
                exchangeCollection.insertOne({id: coinId, total_time: defaultInitialTime, calls: 1});
                return defaultInitialTime; 
            }
            return docs[0].total_time / docs[0].calls;
        });
    });
}

function clockBlockchainTime(coinId, time){
    return client.connect((err) => {
        const db = client.db(dbName);
        const coinCollection = db.collection('coin');
        coinCollection.find({id: coinId}).toArray(function(err,docs){
            if (docs.length == 0){ // add the coin
                const defaultInitialTime = 1800000; // 30 min
                coinCollection.insertOne({id: coinId, total_time: time, calls: 1});
                return defaultInitialTime; 
            }
            var currentTotalTime = docs[0].total_time;
            var currentNumCalls = docs[0].calls;
            coinCollection.updateOne({id: coinId}, { $set: {total_time: currentTotalTime + time, calls: currentNumCalls+1}});
            return (currentTotalTime + time) / (currentNumCalls+1);
        });
    });
}


function clockExchangeTradeTime(exId, time){
    return client.connect((err) => {
        const db = client.db(dbName);
        const exchangeCollection = db.collection('exchange');
        exchangeCollection.find({id: exId}).toArray(function(err,docs){
            if (docs.length == 0){ // add the coin
                const defaultInitialTime = 1000; // 1 min
                exchangeCollection.insertOne({id: exId, total_time: time, calls: 1});
                return defaultInitialTime; 
            }
            var currentTotalTime = docs[0].total_time;
            var currentNumCalls = docs[0].calls;
            exchangeCollection.updateOne({id: exId}, { $set: {total_time: currentTotalTime + time, calls: currentNumCalls+1}});
            return (currentTotalTime + time) / (currentNumCalls+1);
        });
    });
}