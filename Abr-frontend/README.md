# KaamGhar Next.js frontend

Responsive Next.js/TypeScript web frontend for the Node.js + MongoDB marketplace. The Express API lives in the sibling `Abr-backend/` folder. The frontend connects to it using a same-origin API proxy, so the backend's HttpOnly session cookie works without exposing the JWT to browser JavaScript.

## Run with the backend

Use two PowerShell terminals.

**Terminal 1 — backend**

```powershell
Set-Location E:\RajeevTestProject\Abr1\Abr-backend
npm run dev
```

The backend needs a working MongoDB connection and a valid `JWT_SECRET` in `E:\RajeevTestProject\Abr1\Abr-backend\.env`.

**Terminal 2 — Next.js**

```powershell
Set-Location E:\RajeevTestProject\Abr1\Abr-frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open the public marketplace at [http://localhost:3001](http://localhost:3001), the [customer dashboard](http://localhost:3001/customer), the [provider portal](http://localhost:3001/provider), or [admin sign-in](http://localhost:3001/admin/login). Set `BACKEND_URL` in `.env.local` to the Express API address, which is `http://localhost:4000` in this workspace.

## Web pages

- `/` — service discovery, browser-geolocation city detection, category/search filters, hourly professional cards, rating/review counts, and booking entry point
- `/login` — sign in, customer registration, and professional onboarding with city detection and an hourly rate
- `/customer` — customer booking history, cancellation, and professional discovery
- `/provider` — provider sign-in, booking dashboard, status filters and booking actions
- `/provider?mode=register` — provider registration with optional verification documents
- `/provider/profile` — profile editor, listing availability, earnings, and verification documents. Legacy `/worker` links redirect here.
- `/admin/login` — separate admin sign-in URL
- `/admin` — private admin console for verification, users, and bookings

In the admin console, use **Categories** to add service types and register an employee with their name, location, service, hourly rate, and login details. New listings appear under **Professionals → Awaiting review** and stay out of **Users** until approved. Rejected profiles appear in the separate **Rejected** tab.

## Module boundaries

| Module | Source | Routes |
| --- | --- | --- |
| Customer | `src/modules/customer` | `/`, `/login`, `/customer` |
| Provider | `src/modules/provider` | `/provider`, `/provider/profile` |
| Admin | `src/modules/admin` | `/admin`, `/admin/login` |

The route files in `src/app` compose module entry points. Modules use shared components and backend contracts from `src/components` and `src/lib`. The provider portal keeps its stylesheet and provider-specific translations with its module. To deploy a module separately later, take its routes and the shared dependencies it imports, configure its same-origin API proxy, and update cross-module navigation URLs for the new hosts.

## API integration

All browser requests use `/api/*`; `src/app/api/[...path]/route.ts` forwards them to the Express API. It forwards the session cookie server-side and returns login/logout `Set-Cookie` headers to the browser. The frontend consumes these backend endpoints:

- `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- `/api/workers`, `/api/workers/me`
- `/api/workers/me/documents`
- `/api/bookings`, `/api/bookings/:id/status`
- `/api/admin/categories` (GET, POST), `/api/admin/overview`, `/api/admin/professionals` (GET, POST), `/api/admin/professionals/:id/status`
- `/api/admin/professionals/:id/documents/:documentId`, `/api/admin/users`, `/api/admin/users/:id/status`

Providers can upload verification documents during registration or from their portal and profile. Files are stored outside the public directory. Only administrators can view and review uploaded files. Documents are limited to PDF/JPG/PNG, 5 MB each, and 10 per profile. Documents are optional; if any are uploaded, every document must be verified before the professional can be approved. The admin can also view customer/professional accounts and deactivate or reactivate them.

Location lookup requires a user click and browser geolocation permission. Coordinates are sent to the frontend's reverse-lookup route and OpenStreetMap Nominatim to resolve a city; only the resulting city is used to search the marketplace. The location button explains this to the user. Booking requests select 1–12 hours and the backend calculates the total from the professional's saved hourly rate.

Service categories are defined by the backend and loaded through `/api/workers/categories`. Professional registration is restricted to those categories, and category cards only show approved professionals returned by `/api/workers`. Configure MongoDB and the required admin settings in `Abr-backend/.env`, then run `npm run seed` from `Abr-backend/` to add the sample professionals as real database listings.

## Checks

```powershell
npm run lint
npx tsc --noEmit
npm run build
npm audit
```
