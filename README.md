# IBKR Web App — Local Starter (Client Portal Gateway)

This is a minimal full‑stack starter you can run in VS Code to talk to the **Interactive Brokers Client Portal Gateway** running on your machine.

## Prereqs

- IBKR **Client Portal Gateway** running and logged in (Paper account is fine).
- Node.js 18+ installed (`node -v`).
- Market data subscriptions or snapshot access for the instruments you test.

## Setup

```bash
cd ibkr-webapp
cp .env.example .env    # edit if your gateway URL/port differs
npm install
npm run start
```
Open: http://127.0.0.1:3000

### Flow

1. Click **Start Brokerage Session** then **Check Auth Status** (should show `authenticated: true`).
2. Click **Load Accounts** and pick your account id in the order form.
3. Search a symbol (e.g., `AAPL`, `TSLA`, `INFY`), pick a row, then **Get Snapshot** to view price/high/low etc.
4. Place a **MKT** or **LMT** order using the selected `conid` and your `accountId`.
5. Use **Recent Orders** to see status.

### Notes

- The backend holds the IBKR cookies using a cookie jar and ignores the gateway's self‑signed cert for local use.
- The snapshot request defaults to fields: `31,84,85,86,88,70,71,82,83,7295,6509`. You can override in the UI.
- For contracts beyond stocks (options, futures, FX), adjust `secType` and payload in `server.js` `/api/order/place`.

**Never expose this server publicly.** Keep it on localhost during development.
