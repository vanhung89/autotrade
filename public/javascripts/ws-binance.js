var connection = new WebSocket("ws://localhost:3000/bot/binance/socket");

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