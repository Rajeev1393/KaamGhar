# KaamGhar Backend API

Express API for the KaamGhar marketplace, customer dashboard, admin console, and provider portal.

## Run locally

Use Node.js 18 or newer. Copy `.env.example` to `.env`, then set `MONGODB_URI` and a random `JWT_SECRET` of at least 32 characters. Keep `.env` private.

The API listens on `PORT` (this workspace uses port `4000`) after it connects to MongoDB and loads service categories:

```powershell
npm install
npm run dev
```

If startup reports that it cannot connect to the Atlas cluster, check that the cluster is available, the connection string is valid, and your current development IP address is allowed under **MongoDB Atlas → Network Access**. Do not use an unrestricted IP rule for production.

The frontend apps proxy API requests to this service. If the backend is not listening, their API requests return `503` and authenticated dashboards cannot load.
