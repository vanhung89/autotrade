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
		var percentStopLost = $('input[name="'+coin+'sl"][type="text"]').val();
		var pairCoin = $('input[name="'+coin+'tradecb"][type="radio"]:checked').val();
		if(pairCoin == '' || isNaN(percentStopLost)){
			alert("Percent stoploss must be a number");
			return;
		}
		$.ajax({
		  method: "POST",
		  url: "/bot/autotrade",
		  data: { coin: coin, percentStopLost: percentStopLost, pair: pairCoin}
		}).done(function( msg ) {
			if(msg === 'OK') {
			$('button[name="'+coin+'updateSl"]').show();
			$('button[name="'+coin+'startAuto"]').hide();
			} else {
				alert('Action not success');
			}
		  });
	}
	
	function cancelOrder(pair, orderId) {

		if(orderId == '' || isNaN(orderId)){
			alert("Orderid must be a number");
			return;
		}
		$.ajax({
		  method: "POST",
		  url: "/bot/order/cancel",
		  data: { pair: pair, orderId: orderId}
		}).done(function( msg ) {
			if(msg === 'OK') {
				alert('Action is success');
			} else {
				alert('Action not success');
			}
		  });
	}
	
	function enableStoploss(pair) {
		$('input[name="'+pair+'sl"][type="text"]').removeAttr("disabled");
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
	
	