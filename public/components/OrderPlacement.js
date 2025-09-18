import { $, formatCurrency } from '../js/utils.js';
import api from '../js/api.js';

export class OrderPlacement {
    constructor() {
        this.state = null; // To be initialized with shared state
        this.lastOrderAttempt = null;

        // DOM Elements
        this.orderConid = $('orderConid');
        this.orderSymbol = $('orderSymbol');
        this.orderSide = $('orderSide');
        this.orderQty = $('orderQty');
        this.orderType = $('orderType');
        this.limitPriceField = $('limitPriceField');
        this.orderPrice = $('orderPrice');
        this.btnPlaceOrder = $('btnPlaceOrder');
        this.positionInfo = $('positionInfo');
        
        // FX Modal Elements
        this.fxModal = $('fxModal');
        this.fxModalText = $('fxModalText');
        this.fxAmount = $('fxAmount');
        this.btnConfirmFx = $('btnConfirmFx');
        this.btnCancelFx = $('btnCancelFx');
    }

    initialize(sharedState) {
        this.state = sharedState;
        
        this.btnPlaceOrder.addEventListener('click', () => this.placeOrder());
        this.btnConfirmFx.addEventListener('click', () => this.placeFxOrder());
        this.btnCancelFx.addEventListener('click', () => this.fxModal.classList.add('hidden'));

        this.orderType.addEventListener('change', (e) => {
            this.limitPriceField.classList.toggle('hidden', e.target.value !== 'LMT');
        });
    }

    updateOrderForm(conid, symbol) {
        this.orderConid.value = conid;
        this.orderSymbol.value = symbol;

        const ownedPosition = this.state.currentPositions[conid];

        if (ownedPosition) {
            this.positionInfo.textContent = `You currently hold ${ownedPosition.position} shares.`;
            this.positionInfo.classList.remove('hidden');
            this.orderSide.disabled = false;
            this.orderSide.innerHTML = '<option value="BUY">Buy</option><option value="SELL">Sell</option>';
        } else {
            this.positionInfo.textContent = '';
            this.positionInfo.classList.add('hidden');
            this.orderSide.disabled = false;
            this.orderSide.innerHTML = '<option value="BUY">Buy</option>';
            this.orderSide.value = 'BUY';
        }
    }

    async placeOrder(orderToPlace) {
        this.btnPlaceOrder.classList.add('loading');
        try {
            const order = orderToPlace || {
                accountId: $('activeAccountDisplay').textContent,
                conid: parseInt(this.orderConid.value),
                orderType: this.orderType.value,
                side: this.orderSide.value,
                quantity: parseInt(this.orderQty.value),
                tif: "DAY",
                secType: "STK"
            };

            if (order.orderType === 'LMT') {
                order.price = parseFloat(this.orderPrice.value);
            }

            if (!order.accountId || !order.conid || !order.quantity) {
                throw new Error("Account, Contract ID and Quantity are required.");
            }

            this.lastOrderAttempt = order;
            const response = await api.POST('/api/order/place', order);
            const confirmation = this.parseOrderResponse(response);

            if (confirmation.isFx) {
                const neededMatch = confirmation.message.match(/CASH NEEDED.*?([\d,.]+)/);
                const neededAmount = neededMatch ? parseFloat(neededMatch[1].replace(/,/g, '')) : 500;
                this.fxModalText.textContent = `Your order for ${order.quantity} ${this.orderSymbol.value} was rejected. You need approx. ${formatCurrency(neededAmount, 'USD')}.`;
                this.fxAmount.value = Math.ceil(neededAmount * 1.05);
                this.fxModal.classList.remove('hidden');
            } else {
                alert(confirmation.message);
                if (confirmation.success) {
                    document.body.dispatchEvent(new CustomEvent('orderPlaced'));
                }
            }
        } catch (e) {
            alert(`Order failed: ${e.message}`);
        }
        this.btnPlaceOrder.classList.remove('loading');
    }
    
    async placeFxOrder() {
        this.btnConfirmFx.classList.add('loading');
        try {
            const amount = parseFloat(this.fxAmount.value);
            if (!amount || amount <= 0) throw new Error("Invalid conversion amount.");

            const { results } = await api.POST(`/api/search`, { symbol: `USD.${this.state.baseCurrency}`, secType: 'CASH' });
            const fxContract = results[0];
            if (!fxContract || !fxContract.conid) throw new Error(`Could not find a tradable contract for USD.${this.state.baseCurrency}.`);

            const fxOrder = {
                accountId: $('activeAccountDisplay').textContent,
                conid: fxContract.conid,
                orderType: 'MKT', side: 'BUY',
                quantity: amount,
                tif: "DAY",
                secType: "CASH"
            };

            const fxResponse = await api.POST('/api/order/place', fxOrder);
            const fxConfirmation = this.parseOrderResponse(fxResponse);
            if (!fxConfirmation.success) throw new Error(`Currency conversion failed: ${fxConfirmation.message}`);

            alert(`Successfully submitted currency conversion: ${fxConfirmation.message}`);
            this.fxModal.classList.add('hidden');

            alert('Waiting 5 seconds for funds to settle before retrying the stock order...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            await this.placeOrder(this.lastOrderAttempt);

        } catch (e) {
            alert(`An error occurred during conversion: ${e.message}`);
        }
        this.btnConfirmFx.classList.remove('loading');
    }

    parseOrderResponse(response) {
        if (!response) return { success: false, message: "No response from server." };
        const replies = Array.isArray(response) ? response : [response];
        for (const reply of replies) {
            if (!reply) continue;
            const orderId = reply.order_id || reply.id;
            if (orderId && reply.order_status && reply.order_status.toLowerCase() !== 'error') {
                return { success: true, message: `Order submitted! ID: ${orderId}. Status: ${reply.order_status}` };
            }
            if (reply.action === 'convert_from_base_currency' || (reply.error && reply.error.toUpperCase().includes("CONVERTING FUNDS"))) {
                return { success: false, message: reply.error, isFx: true };
            }
            const errorText = reply.error || reply.text;
            if (errorText) {
                return { success: false, message: `Order Failed: ${errorText}` };
            }
        }
        return { success: true, message: "Order submitted, but received an unknown confirmation ID." };
    }
}