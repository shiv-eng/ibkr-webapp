import https from "https";
import axios from "axios";
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

const IB_BASE = process.env.IB_GATEWAY_BASE || "https://localhost:5000/v1/api";

// Persistent cookie jar for stable session
export const jar = new CookieJar();
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

export const ax = wrapper(axios.create({
    jar,
    baseURL: IB_BASE,
    timeout: 30000,
    validateStatus: (status) => status >= 200 && status < 500
}), { httpsAgent });

export const pass = (res, err) => {
    const status = err.response?.status || 500;
    const message = err.response?.data?.error || err.response?.data?.message || err.message;
    res.status(status).json({ error: true, message });
};

// Small retry helper for endpoints that often return empty
export async function safeGet(url, opts = {}, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const { data } = await ax.get(url, opts);
            if (Array.isArray(data) && data.length) return data;
            if (data && data.orders && data.orders.length) return data;
            if (i < retries - 1) await new Promise(r => setTimeout(r, delay));
        } catch (e) {
            if (i === retries - 1) throw e;
            await new Promise(r => setTimeout(r, delay));
        }
    }
    return [];
}