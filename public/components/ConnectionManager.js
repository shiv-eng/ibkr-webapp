import { $, formatCurrency } from '../js/utils.js';
import api from '../js/api.js';

export class ConnectionManager {
    constructor() {
        this.btnConnect = $('btnConnect');
        this.btnDisconnect = $('btnDisconnect');
        this.connectionStatus = $('connectionStatus');
        this.portfolioDashboard = $('portfolioDashboard');
    }

    initialize() {
        this.btnConnect.addEventListener('click', () => this.connect());
        this.btnDisconnect.addEventListener('click', () => this.disconnect());
        this.setConnectionStatus('Disconnected');
    }

    async connect() {
        this.btnConnect.classList.add('loading');
        this.setConnectionStatus('Connecting', 'Connecting...');
        try {
            let status = await api.GET('/api/status');
            if (!status.authenticated) {
                await api.POST('/api/session/connect');

                let attempts = 0;
                while (!status.authenticated && attempts < 10) {
                    await new Promise(r => setTimeout(r, 1000));
                    status = await api.GET('/api/status');
                    attempts++;
                }
            }

            if (status.authenticated) {
                this.setConnectionStatus('Connected');
                document.body.dispatchEvent(new CustomEvent('connected'));
            } else {
                throw new Error('Authentication failed.');
            }
        } catch (e) {
            alert(`Connection failed: ${e.message}`);
            this.setConnectionStatus('Disconnected');
        } finally {
            this.btnConnect.classList.remove('loading');
        }
    }

    async disconnect() {
        this.btnDisconnect.classList.add('loading');
        try {
            await api.POST('/api/session/disconnect');
            this.setConnectionStatus('Disconnected');
            document.body.dispatchEvent(new CustomEvent('disconnected'));
        } catch (e) {
            alert(`Disconnect failed: ${e.message}`);
        }
        this.btnDisconnect.classList.remove('loading');
    }

    setConnectionStatus(status, message = '') {
        this.connectionStatus.textContent = message || status;
        this.connectionStatus.className = `status-badge ${status.toLowerCase()}`;
        const isConnected = status === 'Connected';
        this.btnConnect.classList.toggle('hidden', isConnected);
        this.btnDisconnect.classList.toggle('hidden', !isConnected);
        ['btnSearch', 'btnPlaceOrder'].forEach(id => $(id).disabled = !isConnected);
        this.portfolioDashboard.classList.toggle('hidden', !isConnected);

        if (!isConnected) {
            if (window.chart) {
                window.chart.destroy();
                window.chart = null;
            }
            $('chartContainer').innerHTML = `<p style="color:var(--text-muted)">Connect to view charts.</p>`;
            $('chartPriceInfo').innerHTML = '';
        }
    }
}