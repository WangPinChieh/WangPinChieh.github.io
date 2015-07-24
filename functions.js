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
	if(!isStrNullorEmpty(sellPrice))
	{
		var sellAmount = sellPrice * 1000 * unit;
		var temp_SellFee = sellAmount * feeRate;
		var sellFee = temp_SellFee <= MIN_FEE ? MIN_FEE : temp_SellFee;
		var sellTax = sellAmount * taxRate;
		var netProfit = sellAmount - sellFee - sellTax - purchaseAmount - purchaseFee;
		result.push({SellPrice:  sellPrice.toFixed(2), NetProfit: netProfit < 0 ? '<div class="GreenText">' + netProfit.toFixed(3) + '</div>' : '<div class="RedText">' + netProfit.toFixed(3) + '</div>' });
		
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
				result.push({SellPrice:  sellPrice.toFixed(2), NetProfit: netProfit < 0 ? '<div class="GreenText">' + netProfit.toFixed(3) + '</div>' : '<div class="RedText">' + netProfit.toFixed(3) + '</div>' });
			}
	}
	
	return result;
	
}

