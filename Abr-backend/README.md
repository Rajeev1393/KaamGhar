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

## Razorpay test payments

Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in
the ignored `.env` file. Customers pay in the booking form before a booking is
sent to a professional. The backend calculates the amount and creates a private
checkout record; it creates the visible booking only after verifying the
Razorpay signature and captured amount. Razorpay orders remain open until paid;
retry an unfinished checkout with the same booking details.
The legacy pay-after-confirmation endpoints remain only for older unpaid
bookings. Paid bookings require support to arrange refunds; the API does not
issue refunds. Booking creation after payment uses a MongoDB transaction, so
the database must support transactions (MongoDB Atlas does).

For asynchronous payment updates, configure a Razorpay webhook for
`POST /api/payments/webhook` and subscribe to the `payment.captured` event. A
deployed or publicly reachable HTTPS backend is required for Razorpay to deliver
webhooks; checkout verification itself works without a webhook during local
development. Keep all secrets out of source control and use test credentials
until the integration has been verified.
