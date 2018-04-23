'use strict';
var express = require('express');
var router = express.Router();
const binance = require('node-binance-api');
var bittrex = require('node-bittrex-api');
bittrex.options({
  'apikey' : '',
  'apisecret' : '',
});
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
var order;
/* GET home page. */
router.get('/', async function(req, res, next) {

	listCoin = await getBalance();

	
	order = await getOpenOrders();

	order.forEach((item) => {
		subcribeCoin(item.symbol);
		if(listCoin[item.symbol.substring(0, item.symbol.length-3)]) {
			listCoin[item.symbol.substring(0, item.symbol.length-3)].pair = item.symbol;
		}
	});
	
	for(let itm in listCoin) {
		if(listCoin[itm].isTrade == true) {
			continue;
		}
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
	console.log('pair:' + pair + ', orderid: ' + orderId);
	binance.cancel(pair, orderId, (error, response, symbol) => {
	  console.log(symbol+" cancel response:", response);
	  if(error) {
		  res.send(error.body);
		  return;
	  }
	  if(currentPriceMap.delete(pair)) {
		  unSubcribeCoin(pair);
		  res.send('OK');
	  } else {
		  res.send('Failed');
	  }
	});
});

router.post('/order/update', function(req, res, next) {
	let pair = req.body.pair;
	let orderId = req.body.orderId;
	binance.cancel(pair, orderId, (error, response, symbol) => {
		console.log(symbol+" cancel response:", response);
		if(error) {
		  res.end('NG');
		}
	  
	let type = "STOP_LOSS_LIMIT";
	let quantity = req.body.amount;
	let price = req.body.stopPrice;
	let stopPrice = req.body.stopPrice;
	binance.sell(pair, quantity, price, {stopPrice: stopPrice, type: type}, (error, response) => {
		if(error) {
			res.end('NG');
		}
		res.end('OK');
	});
	});
});

router.post('/selllimit', function(req, res, next) {
	let pair = req.body.pair;
	let amount = req.body.amount;
	let sellPrice = req.body.sellPrice;
	binance.sell(pair, amount, sellPrice, (error, response) => {
		if(error) {
			res.send(error.body);
		} else {
			res.send('OK');
		}
	});
});

router.post('/autotrade', async function(req, res, next) {

	let key = req.body.coin;
	if(listCoin[key]) {
		let pair = req.body.pair;
		
		let type = "STOP_LOSS_LIMIT";
		let quantity = req.body.amountStopLoss;
		let stoploss = (100 - req.body.percentStopLoss)/100;
		let stopPrice = req.body.buyPrice * stoploss;
		console.log('quantity' + quantity +',pair:' + pair + ',price:' + stopPrice);
		binance.sell(pair, quantity, stopPrice.toFixed(8), {stopPrice: stopPrice.toFixed(8), type: type}, (error, response) => {
			if(error) {
				console.log(error);
				res.send(error.body);
				return;
			}

			/*if(currentPriceMap.has(key + 'BTC') || currentPriceMap.has(key + 'ETH')) {
				console.log('Delete current pair to update new pair');
				if(!currentPriceMap.delete(key + 'BTC')) {
					console.log('Pair is ETH');
					currentPriceMap.delete(key + 'ETH');
				}
			}*/
			console.log("order id: " + response.orderId);
			listStoplossCoin[pair] = {percentStopLoss: req.body.percentStopLoss, buyPrice: req.body.buyPrice, orderId: response.orderId, amount: quantity};
			listCoin[key].isTrade = true;
			listCoin[key].pair = pair;
			updateWebsocket();
			res.send("OK");
		});
	} else {
		res.send("NG");
	}
});

router.get('/test', async function(req, res, next) {

	bittrex.getbalance({ currency : 'BTC' }, function( data, err ) {
		  if (err) {
			return console.error(err);
		  }
		  res.send(data);
		});
	
});

router.get('/buy/:coin_name', async function(req, res, next) {
	 let coinName = req.params.coin_name;

	 if(coinName == undefined || "" == coinName){
	  res.statusCode = 400;
	  res.end('BAD REQUEST');
	 }

	 let symbol = coinName.toUpperCase() + 'BTC';
	let myBtcAmount = await getBtcBalance();
	let price = await getPriceOfPair(symbol);
	console.log('price', price);
	  price = price*110/100;
	  console.log('new price', price.toFixed(8));
	  let amount = ((myBtcAmount - (myBtcAmount * 0.002)) / price);
		amount = Math.floor(amount);
		console.log('Amount', amount);
	   binance.buy(symbol,amount,price.toFixed(8),{},(error,response) =>  {
		if(error) {
			res.send(error);
			return;
		}
	   if(response.status === 'FILLED') {
		res.end('Order is completed');
	   } else if (response.status !== 'FILLED' && response.status === 'NEW') {
		  binance.cancel(symbol, response.orderId, (error, response, symbol) => {
		  console.log(symbol+" cancel response:", response);
		  if(error) {
			  res.send(error);
			  return;
		  }
		  res.end('Price is low so can not fill order. Order is cancelled');
		});
	   } else {
		   res.end('Order is not success, data order: ', response);
	   }
	   });

});

router.get('/sell/:coin_name/amount/:quantity', async function(req, res, next) {
	 let coinName = req.params.coin_name;
	let quantity = req.params.quantity;
	 if(coinName == undefined || "" == coinName || quantity == undefined || "" == quantity){
	  res.statusCode = 400;
	  res.end('BAD REQUEST');
	 }
	
	 let symbol = coinName.toUpperCase() + 'BTC';
	binance.marketSell(symbol, quantity, (error, response) => {
		if(error) {
			res.send(error);
			return;
		} 
		res.send(response);
	});

});

router.get('/bittrex/buy/:coin_name', async function(req, res, next) {
	 let coinName = req.params.coin_name;

	 if(coinName == undefined || "" == coinName){
	  res.statusCode = 400;
	  res.end('BAD REQUEST');
	 }

	 let symbol = 'BTC-' + coinName.toUpperCase();
	let myBtcAmount = await getBittrexBtcBalance();
	console.log('BTC amount', myBtcAmount);
	let price = await getPriceOfTicker(symbol);
	console.log('price', price);
	  price = price*110/100;
	  console.log('new price', price.toFixed(8));
	  let amount = ((myBtcAmount - (myBtcAmount * 0.002)) / price);
		amount = Math.floor(amount);
		console.log('Amount', amount);
	   bittrex.tradebuy({
		  MarketName: symbol,
		  OrderType: 'LIMIT',
		  Quantity: amount,
		  Rate: price.toFixed(8),
		  TimeInEffect: 'IMMEDIATE_OR_CANCEL', // supported options are 'IMMEDIATE_OR_CANCEL', 'GOOD_TIL_CANCELLED', 'FILL_OR_KILL'
		  ConditionType: 'NONE', // supported options are 'NONE', 'GREATER_THAN', 'LESS_THAN'
		  Target: 0, // used in conjunction with ConditionType
		}, function( data, err ) {
			if(err) {
				res.send(err);
				return;
			}
		  console.log( data );
		  res.send(data);
		});

});

router.get('/bittrex/sell/:coin_name/amount/:amount', async function(req, res, next) {
	 let coinName = req.params.coin_name;

	 if(coinName == undefined || "" == coinName){
	  res.statusCode = 400;
	  res.end('BAD REQUEST');
	 }

	 let symbol = 'BTC-' + coinName.toUpperCase();

	let price = await getPriceOfTicker(symbol);
	console.log('price', price);
	  let amount = req.params.amount;
		console.log('Amount', amount);
	   bittrex.tradesell({
		  MarketName: symbol,
		  OrderType: 'LIMIT',
		  Quantity: amount,
		  Rate: price.toFixed(8),
		  TimeInEffect: 'IMMEDIATE_OR_CANCEL', // supported options are 'IMMEDIATE_OR_CANCEL', 'GOOD_TIL_CANCELLED', 'FILL_OR_KILL'
		  ConditionType: 'NONE', // supported options are 'NONE', 'GREATER_THAN', 'LESS_THAN'
		  Target: 0, // used in conjunction with ConditionType
		}, function( data, err ) {
			if(err)
			{
				res.send(err);
				return;
			}
		  console.log( data );
		  res.send(data);
		});

});

function getBtcBalance() {
	return new Promise(resolve => {
		binance.balance((error, balances) => {
		  console.log("BTC balance", balances.BTC);
		  resolve(balances.BTC.available);
		});
	});
}

function getBittrexBtcBalance() {
	return new Promise(resolve => {
		bittrex.getbalance({ currency : 'BTC' }, function( data, err ) {
		  if (err) {
			return console.error(err);
		  }
		  resolve(data.result.Available);
		});
	});
}

function getPriceOfPair(pair) {
	return new Promise((resolve, reject) => {
		binance.prices(pair,function(error,ticker){
			if(error) reject(0);
			else resolve(ticker[pair])
		});
	});
}

function getPriceOfTicker(pair) {
	return new Promise((resolve, reject) => {
		bittrex.getticker( { market : pair }, function( data, err ) {
		  if(err) reject(0);
			else resolve(data.result.Last)
		});
	});
}

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
		if(listStoplossCoin.length != 0) {
			let stoplossCoin = listStoplossCoin[symbol];
			let currentPercent = (last - stoplossCoin.buyPrice)*100;
			if(currentPercent >= (stoplossCoin.percentStopLoss + 5)) {
				binance.cancel(symbol, stoplossCoin.orderId, (error, response, symbol) => {
					if(error) {
						console.log(error);
					}
				  console.log(symbol+" cancel response:", response);
				  let type = "STOP_LOSS_LIMIT";
					let quantity = stoplossCoin.amount;
					let price = stoplossCoin.buyPrice * (100 + stoplossCoin.percentStopLoss)/100;
					binance.sell(symbol, quantity, price, {stopPrice: price, type: type}, (error, response) => {
						if(error) {
							console.log(error);
						}
						listStoplossCoin[symbol].buyPrice = last;
						console.log(symbol+" Stoploss order response:", response);
					});
				});
			}
		}
		
		console.log("Current price map", currentPriceMap);
		let json = JSON.stringify({ type:'message', pair: pair, price:last });
		if(websocket) {
			websocket.send(json);
		}
	});
}

function cancelOrder(pair, orderId) {
	return new Promise(resolve => {
		binance.cancel(pair, orderId, (error, response, symbol) => {
			if(error) {
				resolve('Error');
			} else {
				resolve('OK');
			}
		});
	});
}

function makeStoplossOrder(pair, quantity, price) {
	return new Promise(resolve => {
		let type = "STOP_LOSS_LIMIT";
		binance.sell(pair, quantity, price, {stopPrice: price, type: type}, (error, response) => {
			if(error) {
				resolve('Error');
			} else {
				resolve('OK');
			}
		});
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
	

	order.forEach((item) => {
		console.log("Subcribe coin:" + item.symbol)
			subcribeCoin(item.symbol);
	});
}
module.exports = router;
