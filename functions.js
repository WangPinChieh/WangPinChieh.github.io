isDefined = function(v) {
    return typeof v !== 'undefined' && v != null;
};

isStrNullorEmpty = function(s) {
    if (!isDefined(s)) {
        return true;
    }

    if (typeof s == 'string') {
        if (s.length == 0) {
            return true;
        }
    }

    return false;
};

Process = function(buyPrice, sellPrice, unit, feeRate, taxRate){
	const MIN_FEE = 20;
	var purchaseAmount = buyPrice * 1000 * unit;
	var temp_PurchaseFee = purchaseAmount * feeRate;
	var purchaseFee = temp_PurchaseFee <= MIN_FEE ? MIN_FEE : temp_PurchaseFee;
	var result = [];
	if(!isNaN(sellPrice))
	{
		var sellAmount = sellPrice * 1000 * unit;
		var temp_SellFee = sellAmount * feeRate;
		var sellFee = temp_SellFee <= MIN_FEE ? MIN_FEE : temp_SellFee;
		var sellTax = sellAmount * taxRate;
		var netProfit = sellAmount - sellFee - sellTax - purchaseAmount - purchaseFee;
		result.push({SellPrice:  formatNumber(sellPrice), NetProfit: netProfit < 0 ? '<div class="GreenText">' + formatNumber(netProfit) + '</div>' : '<div class="RedText">' + formatNumber(netProfit) + '</div>' });
		
	}
	else
	{
			for(var i=-1; i<=1; i+=0.05)
			{
				var sellPrice = parseFloat(buyPrice) + i;	
				var sellAmount = sellPrice * 1000 * unit;
				var temp_SellFee = sellAmount * feeRate;
				var sellFee = temp_SellFee <= MIN_FEE ? MIN_FEE : temp_SellFee;
				var sellTax = sellAmount * taxRate;
				var netProfit = sellAmount - sellFee - sellTax - purchaseAmount - purchaseFee;
				result.push({SellPrice:  formatNumber(sellPrice), NetProfit: netProfit < 0 ? '<div class="GreenText">' + formatNumber(netProfit) + '</div>' : '<div class="RedText">' + formatNumber(netProfit) + '</div>' });
			}
	}
	
	return result;
	
}

function formatNumber(number)
{
    var number = number.toFixed(2) + '';
    var x = number.split('.');
    var x1 = x[0];
    var x2 = x.length > 1 ? '.' + x[1] : '';
    var rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
        x1 = x1.replace(rgx, '$1' + ',' + '$2');
    }
    return x1 + x2;
}

function checkCookie(name) {
    var cookie=getCookie(name);
    if (cookie!="") {
        return true;
    }else{
        return false;
    }
} 

function createCookie(name,value) {
	var d = new Date();
    d.setTime(d.getTime() + (365*24*60*60*1000));
    var expires = "expires="+d.toUTCString();
	 document.cookie = name + "=" + value + "; " + expires;
}

function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for(var i=0; i<ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1);
        if (c.indexOf(name) == 0) return c.substring(name.length,c.length);
    }
    return "";
}

function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+d.toUTCString();
    document.cookie = cname + "=" + cvalue + "; " + expires;
} 

function eraseCookie(name) {
	createCookie(name,"");
}
