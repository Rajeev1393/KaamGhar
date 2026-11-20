# KaamGhar

KaamGhar is a full-stack local home-services marketplace built with Node.js, Express, MongoDB, and a separate Next.js frontend. It includes a customer marketplace, secure customer and professional accounts, booking management, professional onboarding and moderation, and a role-protected admin control panel.

## Requirements

- Node.js 18 or newer
- MongoDB running locally or a MongoDB Atlas database

## Local setup

1. Install packages:

   ```powershell
   Set-Location .\Abr-backend
   npm install
   ```

2. Copy `.env.example` to `.env`. Set `MONGODB_URI`, a random `JWT_SECRET` of at least 32 characters, and a private `ADMIN_EMAIL` / `ADMIN_PASSWORD` (at least 12 characters).

3. Add marketplace sample professionals and create or promote the configured admin account:

   ```powershell
   Set-Location .\Abr-backend
   npm run seed
   ```

4. Start the server and open the marketplace:

   ```powershell
   Set-Location .\Abr-backend
   npm run dev
   ```

   - Marketplace: [http://localhost:3000](http://localhost:3000)
   - Sign in / create account: [http://localhost:3000/login](http://localhost:3000/login)
   - Customer bookings: [http://localhost:3000/customer](http://localhost:3000/customer)
   - Professional desk: [http://localhost:3000/worker](http://localhost:3000/worker)
   - Admin operations: [http://localhost:3000/admin](http://localhost:3000/admin)

The admin signs in with the credentials configured before running the seed command. Do not use the example credentials in a public deployment.

## Next.js web frontend

The polished Next.js frontend lives in [`Abr-frontend/`](./Abr-frontend/README.md), while the Express API, its dependencies, and its environment files live in `Abr-backend/`. They run separately. The public website uses `/`; the dedicated admin sign-in and console use `/admin/login` and `/admin`. Start the backend from `Abr-backend/` using the configured `PORT` (this workspace is configured for `4000`), then open a second terminal:

```powershell
Set-Location .\Abr-frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001). The frontend's same-origin `/api/*` proxy forwards session cookies and API requests to the backend URL configured in `Abr-frontend/.env`. See [`Abr-frontend/README.md`](./Abr-frontend/README.md) for pages, API integration, and frontend checks.

## Provider portal

Open [http://localhost:3001/provider](http://localhost:3001/provider) from the same Next.js instance as customer and admin. Providers can sign in, register, and manage bookings assigned to their own profile. Profile settings and earnings are under `/provider/profile`. See the [frontend module layout](./Abr-frontend/README.md#module-boundaries) for the source and route boundaries.

## Included workflows

- **Customers:** register/sign in, discover verified professionals by category/city/search, submit bookings, view their booking history, and cancel eligible requests.
- **Professionals:** apply with a service profile, wait for admin approval, edit profile and availability, review requests, accept/decline jobs, and mark confirmed jobs complete.
- **Administrators:** use the dedicated `/admin` console to add professional accounts, review uploaded documents, approve/reject listings, manage approved customer/professional accounts, and inspect all bookings. New professionals stay in pending applications until approved; rejected profiles remain in the separate Rejected tab.
- **Service categories:** admins can add categories from the `/admin` Categories tab. Each category starts at ₹500 and its price can be edited. Categories assigned to professionals cannot be deleted; reassign those professionals first. New categories are saved in MongoDB and immediately become available in professional registration. New employee/professional applications appear in `/admin` → **Professionals** → **Awaiting review**.
- **Security and validation:** bcrypt password hashing, signed expiring HttpOnly session cookies, role-based authorization, login rate limiting, request validation, escaped search patterns, Helmet security headers, and database-backed booking ownership checks.

Bookings track an hourly rate, selected service duration, total amount, and booking lifecycle but do not collect payments. Professional verification documents are stored privately under `private-storage/`, served only to admins, and excluded from version control. Browser location lookup needs explicit user permission and resolves the city through OpenStreetMap Nominatim. Payment processing, SMS/email notifications, and production deployment configuration require provider credentials and are not enabled in this local starter.

## API

### Authentication

- `POST /api/auth/register` — create a customer account or submit a professional application.
- `POST /api/auth/login` — sign in as a customer/professional and set the HttpOnly user session cookie.
- `POST /api/auth/logout` — clear the customer/professional session cookie.
- `GET /api/auth/me` — get the signed-in customer/professional account.
- `POST /api/admin/auth/login` — sign in as an admin using a separate HttpOnly admin session cookie.
- `POST /api/admin/auth/logout` — clear only the admin session cookie.
- `GET /api/admin/auth/me` — get the signed-in admin account.

Admin and customer/professional sessions use separate cookies, so signing in to one role does not replace the other role's session in another browser tab.

Professional registration fields: `name`, `email`, `phone`, `password`, `role: "worker"`, `profession`, `category`, `city`, `experience`, `price`, and `description`. Customer registration uses `role: "customer"` (or omits `role`).

### Marketplace and profiles

- `GET /api/workers` — list approved and available professionals. Optional query parameters: `category`, `city`, `search`.
- `GET /api/workers/categories` — available service categories.
- `GET /api/workers/me` — signed-in professional's profile.
- `PATCH /api/workers/me` — update the signed-in professional's profile or availability.
- `POST /api/workers/me/documents` — upload a private professional verification document (multipart `document` and `type`).

### Bookings

- `POST /api/bookings` — customer booking request (`workerId`, `address`, `scheduledAt`, optional `notes`).
- `GET /api/bookings` — bookings visible to the signed-in customer's account, assigned professional, or admin.
- `PATCH /api/bookings/:id/status` — cancel an eligible customer booking; accept, decline, or complete an assigned job; admins may update statuses.

### Administration

- `GET /api/admin/categories` — list service categories for admins.
- `POST /api/admin/categories` — add a category (`name`, optional `label`).
- `POST /api/admin/professionals` — create a professional account and pending listing (`name`, `email`, `phone`, `password`, `profession`, `category`, `city`, `price`).
- `GET /api/admin/overview` — marketplace counts and recent booking activity.
- `GET /api/admin/professionals?status=pending` — list professional applications by approval status.
- `PATCH /api/admin/professionals/:id/status` — approve or reject a professional.
- `DELETE /api/admin/professionals/:id` — remove a professional account and private documents; booking history is preserved with identifying profile details anonymized.
- `PATCH /api/admin/professionals/:id/documents/:documentId` — verify or reject an uploaded document.
- `GET /api/admin/professionals/:id/documents/:documentId/file` — securely view a private document.
- `GET /api/admin/users?role=customer|worker` — list customer/professional accounts.
- `PATCH /api/admin/users/:id/status` — activate or deactivate an account.

## Project structure

```text
src/
  controllers/   Request handlers and business workflows
  middleware/    Authentication, role authorization, and validation
  models/        Mongoose User, Worker, and Booking models
  routes/        API route definitions
  utils/         Async controller wrapper, errors, and JWT helpers
public/
  index.html     Customer marketplace
  login.html     Account sign-in and registration
  customer.html  Customer booking panel
  worker.html    Professional dashboard
  admin.html     Admin operations panel
scripts/
  seed.js        Sample listings and configured admin bootstrap
test/
  app.test.js    Validation, session, and HTTP smoke tests
```

Run automated checks with `npm test`.
