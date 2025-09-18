const app = {
    chart: null,
    selectedConid: null,
    selectedSymbol: null,
    lastOrderAttempt: null,
    baseCurrency: 'USD',
    currentPositions: {},

    async connect() {
        const btn = ui.$('btnConnect');
        btn.classList.add('loading');
        ui.setConnectionStatus('Connecting', 'Connecting...');
        try {
            let status = await api.GET('/api/status');
            if (!status.authenticated) {
                await api.POST('/api/session/connect');

                // Poll until authenticated
                let attempts = 0;
                while (!status.authenticated && attempts < 10) {
                    await new Promise(r => setTimeout(r, 1000));
                    status = await api.GET('/api/status');
                    attempts++;
                }
            }

            if (status.authenticated) {
                ui.setConnectionStatus('Connected');
                await this.loadDashboard();
            } else {
                throw new Error('Authentication failed. Please log in to the main IBKR Client Portal in another browser tab, then try again.');
            }
        } catch (e) {
            alert(`Connection failed: ${e.message}`);
            ui.setConnectionStatus('Disconnected');
        } finally {
            btn.classList.remove('loading');
        }
    },

    async disconnect() {
        const btn = ui.$('btnDisconnect');
        btn.classList.add('loading');
        try {
            await api.POST('/api/session/disconnect');
            ui.setConnectionStatus('Disconnected');
        } catch (e) { alert(`Disconnect failed: ${e.message}`); }
        btn.classList.remove('loading');
    },

    async loadDashboard() {
        const loader = document.getElementById('dashboardLoader');
        if (loader) loader.classList.add('active');  // show loader
        try {
            const data = await api.GET('/api/dashboard');
            this.baseCurrency = data.currency;
            this.currentPositions = {};
            (data.positions || []).forEach(p => {
                this.currentPositions[p.conid] = { position: p.position, contractDesc: p.contractDesc };
            });
            ui.renderDashboard(data);
        } catch (e) {
            console.error("Failed to load dashboard:", e);
            alert("Failed to load dashboard. Please try reconnecting.");
        } finally {
            if (loader) loader.classList.remove('active');  // hide loader
        }
    },

    async search() {
        const symbol = ui.$('searchInput').value.trim();
        if (!symbol) return;
        ui.$('btnSearch').classList.add('loading');
        const resBody = ui.$('searchResults').querySelector('tbody');
        resBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Searching...</td></tr>`;
        try {
            const { results } = await api.GET(`/api/search?symbol=${encodeURIComponent(symbol)}`);
            if (!results?.length) {
                resBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No results for "${symbol}".</td></tr>`;
                return;
            }
            const conids = results.map(r => r.conid).join(',');
            const { data: marketData } = await api.GET(`/api/market/snapshot?conids=${conids}`);
            const dataMap = marketData.reduce((map, item) => ({ ...map, [item.conid]: item }), {});
            results.forEach(r => r.marketData = dataMap[r.conid]);
            ui.renderSearchResults(results, symbol);
        } catch (e) {
            resBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--red);">Error: ${e.message}</td></tr>`;
        } finally {
            ui.$('btnSearch').classList.remove('loading');
        }
    },

    async loadChartWithInterval(period, bar, intervalLabel) {
        if (!this.selectedConid) { return; };
        ui.$('chartContainer').innerHTML = `<div class="loader" style="display:block;"></div>`;
        try {
            const history = await api.GET(`/api/market/history?conid=${this.selectedConid}&period=${period}&bar=${bar}`);
            ui.renderChart(history.data, this.selectedSymbol, intervalLabel);
        } catch (e) {
            ui.$('chartContainer').innerHTML = `<p style="color:var(--red)">Failed to load chart data.</p>`;
        }
    },

    selectStock(event, conid, symbol) {
        if (!conid || conid === 'undefined') return;
        const row = event.target.closest('tr');
        document.querySelectorAll('#searchResults tbody tr').forEach(r => r.classList.remove('selected-row'));
        row.classList.add('selected-row');

        ui.$('orderConid').value = conid;
        ui.$('orderSymbol').value = symbol;
        this.selectedConid = conid;
        this.selectedSymbol = symbol;

        const price = row.cells[3].textContent;
        const changeText = row.querySelector('.price-positive, .price-negative')?.textContent || (parseFloat(price.replace(/[^0-9.-]+/g, "")) > 0 ? '+0.00' : '0.00');
        const changeClassName = row.querySelector('.price-positive, .price-negative')?.className || '';
        if (price !== '-') {
            const { data } = JSON.parse(row.dataset.marketData);
            const change = ui.formatChange(data['83']);
            ui.updateChartPriceInfo(price, change);
        }

        const positionInfo = ui.$('positionInfo');
        const orderSideSelect = ui.$('orderSide');
        const ownedPosition = this.currentPositions[conid];

        if (ownedPosition) {
            positionInfo.textContent = `You currently hold ${ownedPosition.position} shares.`;
            positionInfo.classList.remove('hidden');
            orderSideSelect.disabled = false;
            orderSideSelect.innerHTML = '<option value="BUY">Buy</option><option value="SELL">Sell</option>';
        } else {
            positionInfo.textContent = '';
            positionInfo.classList.add('hidden');
            orderSideSelect.disabled = false;
            orderSideSelect.innerHTML = '<option value="BUY">Buy</option>';
            orderSideSelect.value = 'BUY';
        }

        const defaultIntervalBtn = document.querySelector('#chartIntervals .btn-interval.active');
        if (defaultIntervalBtn) {
            defaultIntervalBtn.click();
        }
    },

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
    },

    async placeOrder(orderToPlace) {
        const btn = ui.$('btnPlaceOrder');
        btn.classList.add('loading');
        try {
            const order = orderToPlace || {
                accountId: ui.$('activeAccountDisplay').textContent, conid: parseInt(ui.$('orderConid').value),
                orderType: ui.$('orderType').value, side: ui.$('orderSide').value,
                quantity: parseInt(ui.$('orderQty').value), tif: "DAY", secType: "STK"
            };
            if (order.orderType === 'LMT') order.price = parseFloat(ui.$('orderPrice').value);
            if (!order.accountId || !order.conid || !order.quantity) throw new Error("Account, Contract ID and Quantity are required.");

            this.lastOrderAttempt = order;
            const response = await api.POST('/api/order/place', order);
            const confirmation = this.parseOrderResponse(response);

            if (confirmation.isFx) {
                const neededMatch = confirmation.message.match(/CASH NEEDED.*?([\d,.]+)/);
                const neededAmount = neededMatch ? parseFloat(neededMatch[1].replace(/,/g, '')) : 500;
                ui.$('fxModalText').textContent = `Your order for ${order.quantity} ${ui.$('orderSymbol').value} was rejected. You need approx. ${ui.formatCurrency(neededAmount, 'USD')}.`;
                ui.$('fxAmount').value = Math.ceil(neededAmount * 1.05);
                ui.$('fxModal').classList.remove('hidden');
            } else {
                alert(confirmation.message);
                if (confirmation.success) setTimeout(() => this.loadDashboard(), 2000);
            }
        } catch (e) {
            alert(`Order failed: ${e.message}`);
        }
        btn.classList.remove('loading');
    },

    async placeFxOrder() {
        const btn = ui.$('btnConfirmFx');
        btn.classList.add('loading');
        try {
            const amount = parseFloat(ui.$('fxAmount').value);
            if (!amount || amount <= 0) throw new Error("Invalid conversion amount.");

            const { results } = await api.GET(`/api/search?symbol=USD.${this.baseCurrency}&secType=CASH`);
            const fxContract = results[0];
            if (!fxContract || !fxContract.conid) throw new Error(`Could not find a tradable contract for currency pair USD.${this.baseCurrency}. Your account may lack Forex permissions.`);

            const fxOrder = {
                accountId: ui.$('activeAccountDisplay').textContent, conid: fxContract.conid,
                orderType: 'MKT', side: 'BUY', quantity: amount, tif: "DAY", secType: "CASH"
            };

            const fxResponse = await api.POST('/api/order/place', fxOrder);
            const fxConfirmation = this.parseOrderResponse(fxResponse);
            if (!fxConfirmation.success) throw new Error(`Currency conversion failed: ${fxConfirmation.message}`);

            alert(`Successfully submitted currency conversion: ${fxConfirmation.message}`);
            ui.$('fxModal').classList.add('hidden');

            alert('Waiting 5 seconds for funds to settle before retrying the stock order...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            await this.placeOrder(this.lastOrderAttempt);

        } catch (e) { alert(`An error occurred during conversion: ${e.message}`); }
        btn.classList.remove('loading');
    },

    initialize() {
        window.updateApiLog = ui.updateApiLog.bind(ui);

        ui.$('btnConnect').addEventListener('click', () => this.connect());
        ui.$('btnDisconnect').addEventListener('click', () => this.disconnect());
        ui.$('btnSearch').addEventListener('click', () => this.search());
        ui.$('searchInput').addEventListener('keypress', (e) => e.key === 'Enter' && this.search());
        ui.$('btnPlaceOrder').addEventListener('click', () => this.placeOrder());
        ui.$('orderType').addEventListener('change', (e) => ui.$('limitPriceField').classList.toggle('hidden', e.target.value !== 'LMT'));

        const btnConfirmFx = ui.$('btnConfirmFx');
        if (btnConfirmFx) btnConfirmFx.addEventListener('click', () => this.placeFxOrder());

        const btnCancelFx = ui.$('btnCancelFx');
        if (btnCancelFx) btnCancelFx.addEventListener('click', () => ui.$('fxModal').classList.add('hidden'));

        ui.$('chartIntervals').addEventListener('click', (e) => {
            if (e.target.matches('.btn-interval')) {
                document.querySelectorAll('.btn-interval').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                const { period, bar } = e.target.dataset;
                const intervalLabel = e.target.textContent;
                this.loadChartWithInterval(period, bar, intervalLabel);
            }
        });

        ui.$('dashboardTabs').addEventListener('click', (e) => {
            const targetButton = e.target.closest('.tab-btn');
            if (targetButton) {
                const tabId = targetButton.dataset.tab;
                document.querySelectorAll('#dashboardTabs .tab-btn').forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                targetButton.classList.add('active');
                const activeContent = ui.$(`tab-${tabId}`);
                if (activeContent) activeContent.classList.add('active');
            }
        });
        ui.setConnectionStatus('Disconnected');
    }
};

document.addEventListener('DOMContentLoaded', () => app.initialize());
