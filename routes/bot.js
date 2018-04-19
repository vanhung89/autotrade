'use strict';
var express = require('express');
var router = express.Router();
const binance = require('node-binance-api');
binance.options({
  APIKEY: '',
  APISECRET: '',
  useServerTime: true, // If you get timestamp errors, synchronize to server time at startup
  test: false // If you want to use sandbox mode where orders are simulated
});
var currentPriceMap = new Map();
var websocket;
var listCoin;
var listStoplossCoin = [];

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
	});
	
	for(let itm in listCoin) {
		let buyPrice = await getLatestBuyOrder(itm + "BTC");
		listCoin[itm].buyPrice = buyPrice;
	}
	
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
	binance.cancel(pair, orderid, (error, response, symbol) => {
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

router.post('/order/update', function(req, res, next) {
	let pair = req.body.pair;
	let orderId = req.body.orderId;
	binance.cancel(pair, orderid, (error, response, symbol) => {
		console.log(symbol+" cancel response:", response);
		if(error) {
		  res.end('NG');
		}
	  
	let type = "STOP_LOSS_LIMIT";
	let quantity = req.body.amount;
	let price = req.body.stopPrice;
	let stopPrice = req.body.stopPrice;
	binance.sell(pair, quantity, price, {stopPrice: stopPrice, type: type});
	res.end('OK');

	});
});

router.post('/autotrade', async function(req, res, next) {

	let key = req.body.coin;
	if(listCoin[key]) {
		let pair = req.body.pair;
		let orderHist
		listCoin[key].isTrade = true;
		listCoin[key].stopLoss = req.body.percentStopLoss;
		listCoin[key].pair = pair;
		if(currentPriceMap.has(key + 'BTC') || currentPriceMap.has(key + 'ETH')) {
			console.log('Delete current pair to update new pair');
			if(!currentPriceMap.delete(key + 'BTC')) {
				console.log('Pair is ETH');
				currentPriceMap.delete(key + 'ETH');
			}
		}
		let type = "STOP_LOSS_LIMIT";
		let quantity = req.body.amount;
		let price = req.body.stopPrice;
		let stopPrice = req.body.stopPrice;
		binance.sell(pair, quantity, price, {stopPrice: stopPrice, type: type});
		listStoplossCoin[pair] = {orderId: }
		updateWebsocket();
		res.send("OK");
	} else {
		res.send("NG");
	}
});

router.get('/test', async function(req, res, next) {

	binance.allOrders("AIONETH, XLMBTC", (error, orders, symbol) => {
  console.log(symbol+" orders:", orders);
});
	res.end('OK');
});

function getOpenOrders() {
	return new Promise(resolve => {
		binance.openOrders(false, (error, openOrders) => {
			resolve(openOrders);
		});
	});
}

function getLatestBuyOrder(pair) {
	return new Promise(resolve => {
		binance.allOrders(pair, (error, orders, symbol) => {
			console.log(symbol+" orders:", orders);
			let latestPrice;
			for(let item in orders) {
				if(orders[item].side === 'BUY' && orders[item].status === 'FILLED') {
					latestPrice = orders[item].price;
				}
			}
			resolve(latestPrice);
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
		let coin = listCoin[pair.substring(0, item.symbol.length-3)];
		let currentPrice = currentPriceMap.get(pair);
		let currentPercent = (currentPrice - coin.buyPrice)*100;
		if(currentPercent >= 10) {
			
		}
		if(coin.buyPrice)
		console.log("Current price map", currentPriceMap);
		let json = JSON.stringify({ type:'message', pair: pair, price:last });
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
	for(let key in listCoin) {
		if(listCoin[key].isTrade) {
			subcribeCoin(listCoin[key].pair);
		}
	}
}
module.exports = router;
