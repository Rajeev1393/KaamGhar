# KaamGhar customer app

Flutter customer app for the existing KaamGhar Node backend. It includes service and city search, optional location lookup, registration, sign-in, password-reset requests, Razorpay booking and payment verification, booking history and cancellation, and support chat with private document attachments. Language and theme preferences are saved on the device. Support replies still come from the existing admin inbox.

## Start the API

In separate terminals, run `npm run dev` from `Abr-backend` and `Abr-frontend`. The default local ports are 4000 for Express and 3001 for Next.js. The Flutter app uses the Next.js same-origin API gateway, including its city lookup route.

## Web

From `Abr-customer-flutter`:

```powershell
flutter pub get
flutter build web --no-web-resources-cdn
node tool/serve.cjs
```

Open [http://127.0.0.1:3100](http://127.0.0.1:3100). The local server forwards `/api/*` to the frontend on port 3001, so the browser can use HttpOnly session cookies. In production, serve the build and proxy `/api/*` on the same HTTPS origin.

## Android and Windows

Open this folder in VS Code and choose an Android emulator, Android phone, or Windows target. The Android emulator uses `http://10.0.2.2:3001`. Windows uses `http://localhost:3001`. On a physical Android phone, pass the PC's reachable LAN address for a debug run:

```powershell
flutter run --dart-define=KAAMGHAR_URL=http://YOUR_PC_LAN_IP:3001
```

Use an HTTPS gateway for release builds. Android uses the Razorpay Flutter SDK. Web uses Razorpay Checkout in the browser, and Windows opens a local checkout page in the default browser and returns to the app after checkout. The Node backend creates orders and verifies payment signatures for all clients.

Android needs the SDK tools and accepted SDK licenses. Windows needs the Visual Studio **Desktop development with C++** workload. These platform tools are independent of the Flutter SDK.
