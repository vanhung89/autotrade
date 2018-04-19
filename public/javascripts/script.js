

	$( "#CNDmanualBuyPrice" ).toggle(function() {
		let pair = $(this).attr("data-pair");
		$("#" + pair + "buyPrice").removeAttr("disabled");
	}, function() {
		let pair = $(this).attr("data-pair");
		$("#" + pair + "buyPrice").prop("disabled");
	   

	});

	function unsubcribe(pair) {
		$.ajax({
		  method: "POST",
		  url: "/bot/unsubcribe",
		  data: { pair: pair}
		}).done(function( msg ) {
			alert( "Result: " + msg );
		  });
	}
	
	function autoTrade(coin) {
		let percentStopLoss = $('input[id="'+coin+'SlPercent"][type="text"]').val();
		let amountStopLoss = $('input[id="'+coin+'SlAmount"][type="text"]').val();
		let pairCoin = $('input[name="'+coin+'tradecb"][type="radio"]:checked').val();

		if (!confirm('Hãy chắc chắn rằng bạn đã chọn đúng pair là ETH hoặc BTC')) {
			return;
		}

		if(percentStopLoss == '' || isNaN(percentStopLoss) || Number(percentStopLoss) == 0){
			alert("Giá trị của stoploss phải là kiểu số");
			return;
		}
		if(amountStopLoss == '' || isNaN(amountStopLoss) || Number(amountStopLoss) == 0){
			alert("Số lượng muốn trade phải là kiểu số");
			return;
		}
		$.ajax({
		  method: "POST",
		  url: "/bot/autotrade",
		  data: { coin: coin, percentStopLoss: percentStopLoss, pair: pairCoin, amountStopLoss: amountStopLoss, flagManualPrice: flagManualPrice}
		}).done(function( msg ) {
			if(msg === 'OK') {
				alert('Thao tác thành công');
			} else {
				alert('Thao tác thất bại');
			}
		  });
	}
	
	function cancelOrder(pair, orderId) {

		if(orderId == '' || isNaN(orderId)){
			alert("Orderid phải là kiểu số");
			return;
		}
		$.ajax({
		  method: "POST",
		  url: "/bot/order/cancel",
		  data: { pair: pair, orderId: orderId}
		}).done(function( msg ) {
			if(msg === 'OK') {
				alert('Thao tác thành công');
			} else {
				alert('Thao tác thất bại');
			}
		  });
	}
	
	function updateOrder(pair, orderId) {

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
	var connection = new WebSocket("ws://localhost:3000/bot/socket");

	connection.onopen = function () {
	console.log("connected");
	connection.send("connected");
	};

	connection.onclose = function () {
	console.log("Closed");

	};

	connection.onerror = function (error) {
	  console.log("Error", error);
	};

	connection.onmessage = function (message) {

	var dataObject = JSON.parse(message.data);
	console.log(dataObject);
	$("." + dataObject.pair).each(function (index, element) {
		$(this).text(dataObject.price)
	});
	//document.getElementByClassName(dataObject.pair).innerHTML = dataObject.price;
	};
	
	