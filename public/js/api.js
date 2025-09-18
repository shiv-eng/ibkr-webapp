const api = {
    async call(method, url, body) {
        const log = { method, url, req: body, res: null, status: null, ok: false, timestamp: new Date().toLocaleTimeString() };
        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : undefined
            });
            log.status = res.status; 
            log.ok = res.ok;
            const resData = await res.json().catch(() => ({ message: `Non-JSON response from server.` }));
            log.res = resData;
            if (!res.ok) throw new Error(resData.message || `HTTP ${res.status}`);
            return resData;
        } catch (err) {
            log.res = { error: err.message };
            throw err;
        } finally {
            if (window.updateApiLog) window.updateApiLog(log);
        }
    },
    GET(url) { return this.call('GET', url); },
    POST(url, body) { return this.call('POST', url, body); }
};