

	$( "#CNDmanualBuyPrice" ).toggle(function() {
		let pair = $(this).attr("data-pair");
		$("#" + pair + "buyPrice").removeAttr("disabled");
	}, function() {
		let pair = $(this).attr("data-pair");
		$("#" + pair + "buyPrice").prop("disabled");
	   

	});
	
	function autoTrade(coin, exchange) {
		let percentStopLoss = $('input[id="'+coin+'SlPercent"][type="text"]').val();
		let amountStopLoss = $('input[id="'+coin+'SlAmount"][type="text"]').val();
		let pairCoin = $('input[name="'+coin+'tradecb"][type="radio"]:checked').val();
		let buyPrice = $('input[id="'+coin+'buyPrice"][type="text"]').val();
		
		/* if (!confirm('Hãy chắc chắn rằng bạn đã chọn đúng pair là ETH hoặc BTC')) {
			return;
		} */

		if(percentStopLoss == '' || isNaN(percentStopLoss) || Number(percentStopLoss) == 0){
			alert("Giá trị của stoploss phải là kiểu số");
			return;
		}
		if(amountStopLoss == '' || isNaN(amountStopLoss) || Number(amountStopLoss) == 0){
			alert("Số lượng muốn trade phải là kiểu số");
			return;
		}
		let urlExchange = exchange === 'bittrex' ? '/bot/bittrex/autotrade' : '/bot/binance/autotrade';
		$.ajax({
		  method: "POST",
		  url: urlExchange,
		  data: { coin: coin, percentStopLoss: percentStopLoss, pair: pairCoin, amountStopLoss: amountStopLoss, buyPrice: buyPrice}
		}).done(function( msg ) {
			if(msg === 'OK') {
				alert('Thao tác thành công');
			} else {
				alert('Thac tác thất bại \n' + msg);
			}
		  });
	}
	
	function sellLimit(coin, exchange) {
		let amount = $('input[id="'+coin+'SlAmount"][type="text"]').val();
		let pairCoin = $('input[name="'+coin+'tradecb"][type="radio"]:checked').val();
		let sellPrice = $('input[id="'+coin+'buyPrice"][type="text"]').val();
		

		if(amount == '' || isNaN(amount) || Number(amount) == 0){
			alert("Số lượng muốn trade phải là kiểu số");
			return;
		}
		let urlExchange = exchange === 'bittrex' ? '/bot/bittrex/selllimit' : '/bot/binance/selllimit';
		$.ajax({
		  method: "POST",
		  url: urlExchange,
		  data: { pair: pairCoin, amount: amount, sellPrice: sellPrice}
		}).done(function( msg ) {
			if(msg === 'OK') {
				alert('Thao tác thành công');
			} else {
				alert('Thac tác thất bại \n' + msg);
			}
		  });
	}
	
	function cancelOrder(pair, orderId, exchange) {

		let urlExchange = exchange === 'bittrex' ? '/bot/bittrex/order/cancel' : '/bot/binance/order/cancel';
		$.ajax({
		  method: "POST",
		  url: urlExchange,
		  data: { pair: pair, orderId: orderId}
		}).done(function( msg ) {
			if(msg === 'OK') {
				alert('Thao tác thành công');
			} else {
				alert('Thao tác thất bại\n' + msg);
			}
		  });
	}
	
	function updateOrder(pair, orderId, exchange) {

		var stopPrice = $('input[name="updateSl'+coin+'"][type="text"]').val();
		var amount = $('input[name="amountUpdateSl'+coin+'"][type="hidden"]').val();
		if(orderId == '' || isNaN(orderId)){
			alert("Orderid must be a number");
			return;
		}
		var totalOrder = stopPrice*amount;
		if(totalOrder < 0.001) {
			alert('Giá trị quy ra BTC/ETH quá thấp. Tổng giá trị quy ra BTC/ETH phải 0.001 BTC/ETH. Hiện tại đang là ' + totalOrder + ' BTC/ETH');
		}
		let urlExchange = exchange === 'bittrex' ? '/bot/bittrex/order/update' : '/bot/binance/order/update';
		$.ajax({
		  method: "POST",
		  url: "/bot/order/update",
		  data: { pair: pair, orderId: orderId, stopPrice: stopPrice, amount: amount}
		}).done(function( msg ) {
			if(msg === 'OK') {
				alert('Thao tác thành công');
			} else {
				alert('Thao tác thất bại');
			}
		  });
	}
	
	function enableStoploss(pair) {
		$('input[name="'+pair+'SlPercent"][type="text"]').removeAttr("disabled");
		$('input[name="'+pair+'SlAmount"][type="text"]').removeAttr("disabled");
		$('input[name="'+pair+'manualPrice"][type="checkbox"]').removeAttr("disabled");
		$('input[name="'+pair+'sl"][type="text"]').focus();
	}

	var connectionBinance = new WebSocket("ws://localhost:3000/bot/binance/socket");

	connectionBinance.onopen = function () {
	console.log("Ws Binance connected");
	connectionBinance.send("Ws Binance connected");
	};

	connectionBinance.onclose = function () {
	console.log("Ws Binance Closed");

	};

	connectionBinance.onerror = function (error) {
	  console.log("Ws Binance Error", error);
	};

	connectionBinance.onmessage = function (message) {

	var dataObjectBinance = JSON.parse(message.data);
	console.log(dataObjectBinance);
	$("." + dataObjectBinance.pair).each(function (index, element) {
		$(this).text(dataObjectBinance.price)
	});
	};
	//Ws Bittrex
	var connectionBittrex = new WebSocket("ws://localhost:3000/bot/bittrex/socket");

	connectionBittrex.onopen = function () {
	console.log("Ws Bittrex connected");
	connectionBittrex.send("Ws Bittrex connected");
	};

	connectionBittrex.onclose = function () {
	console.log("Ws Bittrex Closed");

	};

	connectionBittrex.onerror = function (error) {
	  console.log("Ws Bittrex Error", error);
	};

	connectionBittrex.onmessage = function (message) {

	var dataObjectBittrex = JSON.parse(message.data);
	console.log(dataObjectBittrex);
	$("." + dataObjectBittrex.pair).each(function (index, element) {
		$(this).text(dataObjectBittrex.price)
	});
	};

	
	
	