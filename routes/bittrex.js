'use strict';
var express = require('express');
var router = express.Router();
var bittrex = require('node-bittrex-api');
bittrex.options({
  'apikey' : '',
  'apisecret' : '',
});

var currentPriceMap = new Map();
var websocket;
var listCoin = {};
var listStoplossCoin = new Map();
var order;
/* GET home page. */
router.get('/', async function(req, res, next) {

	let listCoinTmp = await getBalance();

	
	order = await getOpenOrders();

	if(order.length > 0) {
		order.forEach((item, index) => {
			item.Limit = Number.parseFloat(item.Limit).toFixed(8)
			subcribeCoin(item.Exchange);
		});

	}
	
	for (let i = listCoinTmp.length - 1; i >= 0; i--) {
	 	let buyPrice = 0;
	 	if(listCoinTmp[i].Currency !== 'BTC') {
	 		buyPrice = await getLatestBuyOrder("BTC-"+listCoinTmp[i].Currency);
	 	}
	 	
		let newData = Object.assign({buyPrice: Number.parseFloat(buyPrice).toFixed(8)}, listCoinTmp[i]);
		listCoin[listCoinTmp[i].Currency] = newData;
	 }
	
	res.render('bot-bittrex', { openOrders:  order, balance: listCoin});
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
	let orderId = req.body.orderId;
	let pair = req.body.pair;
	console.log('pair:' + pair + ', orderid: ' + orderId);
	bittrex.cancel({uuid:orderId}, (data, error) => {
					if(error) {
						res.send(error);
						return;
					} 
					
					listStoplossCoin.delete(pair);
					unSubcribeCoin(pair);
					res.send('OK');
				});

});

//TODO
router.post('/order/update', function(req, res, next) {
	let pair = req.body.pair;
	let orderId = req.body.orderId;
	bittrex.cancel({uuid:orderId}, (data, error) => {
					if(error) {
						res.send(error);
						return;
					} 
	  
	let quantity = req.body.amount;
	let price = req.body.stopPrice;
	bittrex.tradesell({
					  MarketName: pair,
					  OrderType: 'LIMIT',
					  Quantity: quantity,
					  Rate: price.toFixed(8),
					  TimeInEffect: 'GOOD_TIL_CANCELLED', // supported options are 'IMMEDIATE_OR_CANCEL', 'GOOD_TIL_CANCELLED', 'FILL_OR_KILL'
					  ConditionType: 'LESS_THAN', // supported options are 'NONE', 'GREATER_THAN', 'LESS_THAN'
					  Target: price.toFixed(8) // used in conjunction with ConditionType
					}, function( data, err ) {
					  if(error) {
							res.send(error);
							return;
						}
						
						listStoplossCoin.get(pair).percentStopLoss = stoplossCoin.buyPrice * newRatio;
						listStoplossCoin.get(pair).orderId = data.result.OrderId;
						console.log(pair+" Stoploss order response:", data);
					});
	});
});

router.post('/selllimit', function(req, res, next) {
	const pair = req.body.pair;
	const amount = req.body.amount;
	const sellPrice = req.body.sellPrice;
	console.log('pair:' + pair + 'amount:' + amount + 'sellprice:' + sellPrice);
	bittrex.tradesell({
					  MarketName: pair,
					  OrderType: 'LIMIT',
					  Quantity: amount,
					  Rate: sellPrice,
					  TimeInEffect: 'GOOD_TIL_CANCELLED', // supported options are 'IMMEDIATE_OR_CANCEL', 'GOOD_TIL_CANCELLED', 'FILL_OR_KILL'
					  ConditionType: 'NONE', // supported options are 'NONE', 'GREATER_THAN', 'LESS_THAN'
					  Target: 0 // used in conjunction with ConditionType
					}, function( data, err ) {
					  if(err) {
					  	console.error(err);
							res.send(err);

						} else {
							res.send('OK');
						}
					});

});


router.post('/autotrade', async function(req, res, next) {

	let key = req.body.coin;
	if(listCoin[key]) {
		let pair = req.body.pair;
		
		
		let quantity = req.body.amountStopLoss;
		let stoploss = (100 - req.body.percentStopLoss)/100;
		let stopPrice = req.body.buyPrice * stoploss;
		console.log('quantity' + quantity +',pair:' + pair + ',price:' + stopPrice);
		bittrex.tradesell({
					  MarketName: pair,
					  OrderType: 'LIMIT',
					  Quantity: quantity,
					  Rate: stopPrice.toFixed(8),
					  TimeInEffect: 'GOOD_TIL_CANCELLED', // supported options are 'IMMEDIATE_OR_CANCEL', 'GOOD_TIL_CANCELLED', 'FILL_OR_KILL'
					  ConditionType: 'LESS_THAN', // supported options are 'NONE', 'GREATER_THAN', 'LESS_THAN'
					  Target: stopPrice.toFixed(8) // used in conjunction with ConditionType
					}, function( data, err ) {
					  if(err) {
							res.send(err);
							console.error(err)
							return;
						}
						
						console.log("order id: " + data.result.OrderId);
						listStoplossCoin.set(pair,{percentStopLoss: req.body.percentStopLoss, buyPrice: req.body.buyPrice, orderId:  data.result.OrderId, amount: quantity});
						updateWebsocket();
						res.send("OK");
					});
	} else {
		res.send("NG");
	}
});

router.get('/test', async function(req, res, next) {
bittrex.websockets.subscribe(['BTC-ETH','BTC-SC','BTC-ZEN'], function(data, client) {
	  if (data.M === 'updateExchangeState') {
	    data.A.forEach(function(data_for) {
	      console.log('Market Update for '+ data_for.MarketName, data_for.Fills);
	  });
}
});
res.end('OK');
});


router.get('/buy/:coin_name', async function(req, res, next) {
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

router.get('/sell/:coin_name/amount/:amount', async function(req, res, next) {
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



function getBalance() {
	return new Promise(resolve => {
		bittrex.getbalances( function( data, err ) {
		  if(err) {
		  	resolve('');
		  } else {
		  	let result = [];
		  	data.result.forEach((item, index) => {
		  		if(item.Currency === 'BTC' || item.Currency === 'ETH' || (item.Currency !== 'BTC' && item.Currency !== 'ETH' && item.Balance >= 1 )) {
		  			if(item.Currency === 'BTC' || item.Currency === 'ETH') {
		  				item.Balance = Number.parseFloat(item.Balance).toFixed(8)
		  				item.Available = Number.parseFloat(item.Available).toFixed(8)
		  			}
		  			result.push(item);
		  		}
		  	});
		  	resolve(result);
		  }
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
		bittrex.getopenorders(function (data, err) {
			if(err) {
		  	resolve('');
		  } else {
		  	resolve(data.result);
		  }
		});
	});
}

function getLatestBuyOrder(pair) {
	return new Promise(resolve => {
		bittrex.getorderhistory({ market : pair }, function( data, err ) {
			if (err) {
				resolve(0);
			} else {
			  for(let i = data.result.length - 1; i >= 0; i--) {
					if(data.result[i].OrderType === 'LIMIT_BUY') {
						resolve(Number(data.result[i].Limit));
					}
				}
			resolve(0);
		}
	});
});
}


function subcribeCoin(pair) {

	bittrex.websockets.subscribe([pair], function(data, client) {
	  if (data.M === 'updateExchangeState') {
	    data.A.forEach(function(data_for) {
	      console.log('Market Update for '+ data_for.MarketName, data_for.Fills);
	      const last = getCurrentPrice(data_for.Fills);
	      if(last != 0) {
	      	if(typeof listStoplossCoin.get(pair) != 'undefined') {
			let stoplossCoin = listStoplossCoin.get(pair);
			
			let currentPercent = (last - stoplossCoin.buyPrice)/stoplossCoin.buyPrice*100;
			let percentStopLossRatio = Number(stoplossCoin.percentStopLoss) + 5;
			console.log('Current percent' + pair + ': ' + currentPercent);
			console.log('Stoploss percent' + pair + ': ' + percentStopLossRatio);
			if(currentPercent >= percentStopLossRatio) {
				bittrex.cancel({uuid:stoplossCoin.orderId}, (data, error) => {
					if(error) {
						console.log(error.body);
					}
				  console.log(pair+" cancel response:", data);
					let quantity = stoplossCoin.amount;
					let price = last * (100 - stoplossCoin.percentStopLoss)/100;
					console.log('New price: ' + price);
					bittrex.tradesell({
					  MarketName: pair,
					  OrderType: 'LIMIT',
					  Quantity: quantity,
					  Rate: price.toFixed(8),
					  TimeInEffect: 'GOOD_TIL_CANCELLED', // supported options are 'IMMEDIATE_OR_CANCEL', 'GOOD_TIL_CANCELLED', 'FILL_OR_KILL'
					  ConditionType: 'LESS_THAN', // supported options are 'NONE', 'GREATER_THAN', 'LESS_THAN'
					  Target: price.toFixed(8) // used in conjunction with ConditionType
					}, function( data, err ) {
					  if(error) {
							console.log(error.body);
						}
						let newRatio = (100 + Number(stoplossCoin.percentStopLoss))/100;
						listStoplossCoin.get(pair).buyPrice = stoplossCoin.buyPrice * newRatio;
						listStoplossCoin.get(pair).orderId = data.result.OrderId;
						console.log(pair+" Stoploss order response:", data);
					});
				});
			}
		}
		
			let json = JSON.stringify({ type:'message', pair: pair, price:last });
			if(websocket) {
				websocket.send(json);
			}
	      }
	      
	    });
	  }
	});
}

function getCurrentPrice(data) {
	let max = 0;
	data.forEach((item, index) => {
		if(item.OrderType === 'BUY' && item.Rate > max) {
			max = item.Rate;
		} 
	});
	return max;
}


function updateWebsocket() {
	
	if(order.length > 0) {
		order.forEach((item, index) => {
			console.log("Subcribe coin:" + item.Exchange)
			subcribeCoin(item.Exchange);
		});
	}
	
	listStoplossCoin.forEach((item, index) =>{
		console.log("Subcribe coin in listStoplossCoin:" + index)
			subcribeCoin(index);
	});

}
module.exports = router;
