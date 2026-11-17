# KaamGhar Provider Portal

Standalone Next.js frontend for service providers. It uses the existing Express API and only returns bookings assigned to the signed-in provider.

## Run locally

Start the backend in another PowerShell terminal:

```powershell
Set-Location E:\RajeevTestProject\Abr1\Abr-backend
npm run dev
```

Then start the provider portal:

```powershell
Set-Location E:\RajeevTestProject\Abr1\Abr-provider
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3002/provider](http://localhost:3002/provider). `BACKEND_URL` defaults to `http://localhost:4000`; change it in `.env.local` if the API runs elsewhere.
