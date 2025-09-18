process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import express from "express";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { ax, jar, pass } from "./utils.js";

// Import component routes
import dashboardRoutes from "./components/dashboard.js";
import marketRoutes from "./components/market.js";
import orderRoutes from "./components/order.js";
import searchRoutes from "./components/search.js";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Session and Auth Routes ---
app.get("/api/status", async (req, res) => {
    try {
        const { data } = await ax.get("/iserver/auth/status");
        res.json(data);
    } catch (err) { pass(res, err); }
});

app.post("/api/session/connect", async (req, res) => {
    try {
        jar.removeAllCookiesSync();
        const { data } = await ax.post("/iserver/reauthenticate");
        res.json(data);
    } catch (err) { pass(res, err); }
});

app.post("/api/session/disconnect", async (req, res) => {
    try {
        await ax.post("/logout");
    } catch (err) {
        // Ignore errors on logout
    } finally {
        jar.removeAllCookiesSync();
        res.json({ success: true, message: "Successfully disconnected." });
    }
});


// --- Use component routes ---
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/search", searchRoutes);

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1";

app.listen(PORT, HOST, () => {
    console.log(`🚀 Server running at http://${HOST}:${PORT}`);
});