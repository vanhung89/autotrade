'use strict';
var express = require('express');
var router = express.Router();
const binance = require('node-binance-api');
binance.options({
  APIKEY: 'y3gnatDSNlvECLxVt6IPRMXvAdEQsTe1r4Scjqdpd29X4ByahpTDBg83dtyUrZBj',
  APISECRET: 'xfV0kU0QAX6xZV0IqqmEH8f6bemPhaistTmy11xhSlAqRypSWeKw1KxchFZ3NXdk',
  useServerTime: true, // If you get timestamp errors, synchronize to server time at startup
  test: false // If you want to use sandbox mode where orders are simulated
});
var currentPriceMap = new Map();
var websocket;
var listCoin;

/* GET home page. */
router.get('/', async function(req, res, next) {
	if(typeof listCoin === 'undefined') {
		listCoin = await getBalance();
	}
	
	let order = await getOpenOrders();

	order.forEach((item) => {
		subcribeCoin(item.symbol);
		if(listCoin[item.symbol.substring(0, item.symbol.length-3)]) {
			listCoin[item.symbol.substring(0, item.symbol.length-3)].isTrade = true;
			listCoin[item.symbol.substring(0, item.symbol.length-3)].pair = item.symbol;
		}
	})
	
	//console.log("Current price map", listStoplossOrder);
	res.render('bot', { openOrders:  order, balance: listCoin});
});

router.ws('/socket', function(ws, req) {
  ws.on('message', function(msg) {
    websocket = ws;
  });
});

router.post('/unsubcribe', function(req, res, next) {
	unSubcribeCoin(req.params.pair);
	res.send('OK');
});

router.post('/order/cancel', function(req, res, next) {
	let pair = req.body.pair;
	let orderId = req.body.orderId;
	binance.cancel("ETHBTC", orderid, (error, response, symbol) => {
	  console.log(symbol+" cancel response:", response);
	  if(error) {
		  res.end('NG');
	  }
	  if(currentPriceMap.delete(pair)) {
		  unSubcribeCoin(pair);
		  res.end('OK');
	  } else {
		  res.end('NG');
	  }
	});
});

router.post('/autotrade', function(req, res, next) {

	let key = req.body.coin;
	if(listCoin[key]) {
		listCoin[key].isTrade = true;
		listCoin[key].stopLoss = req.body.percentStopLost;
		listCoin[key].pair = req.body.pair;
		if(currentPriceMap.has(key + 'BTC') || currentPriceMap.has(key + 'ETH')) {
			console.log('Delete current pair to update new pair');
			if(!currentPriceMap.delete(key + 'BTC')) {
				console.log('Pair is ETH');
				currentPriceMap.delete(key + 'ETH');
			}
		}

		updateWebsocket();
		res.send("OK");
	} else {
		res.send("NG");
	}
});

function getOpenOrders() {
	return new Promise(resolve => {
		binance.openOrders(false, (error, openOrders) => {
		resolve(openOrders);
	});
	});
}

function getBalance() {
	return new Promise(resolve => {
		binance.balance((error, balances) => {
		  resolve(balances);
		});
	});
}

function subcribeCoin(pair) {
	binance.websockets.chart(pair, "1m", (symbol, interval, chart) => {
		
		let tick = binance.last(chart);
		const last = chart[tick].close;;
		currentPriceMap.set(symbol, last);
		console.log("Current price map", currentPriceMap);
		var json = JSON.stringify({ type:'message', pair: pair, price:last });
		if(websocket) {
			websocket.send(json);
		}
	});
}

function unSubcribeCoin(pair) {
	binance.websockets.terminate(pair.toLowerCase()+'@kline_1m'); 
}

function updateWebsocket() {
	let endpoints = binance.websockets.subscriptions();
	for ( let endpoint in endpoints ) {
		binance.websockets.terminate(endpoint);
	}
	for(var key in listCoin) {
		if(listCoin[key].isTrade) {
			subcribeCoin(listCoin[key].pair);
		}
	}
}
module.exports = router;
