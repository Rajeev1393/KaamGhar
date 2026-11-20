# KaamGhar Provider

Flutter workspace for KaamGhar service providers. It uses the existing Node API and Next.js gateway for provider sign-in, signup, password recovery, booking status updates, earnings, professional profiles, and verification documents.

## Run locally

Start `npm run dev` in both `Abr-backend` and `Abr-frontend`. The API listens on port 4000 and the gateway listens on port 3001 by default.

From this directory, run:

```powershell
flutter pub get
flutter build web --no-web-resources-cdn
node tool/serve.cjs
```

Open [http://127.0.0.1:3101](http://127.0.0.1:3101). The local server proxies same-origin API requests to port 3001 so the browser can use the existing HttpOnly session cookie. For hosted web builds, serve the assets and proxy `/api/*` on the same HTTPS origin.

For Android or Windows, select a device with `flutter devices` and run `flutter run -d DEVICE_ID`. The Android emulator uses `http://10.0.2.2:3001`. Windows uses `http://localhost:3001`. For a physical Android device, pass `--dart-define=KAAMGHAR_URL=http://YOUR_PC_LAN_IP:3001` in debug mode. Use an HTTPS gateway for release builds.

Android needs the SDK tools and accepted licenses. Windows desktop needs the Visual Studio Desktop development with C++ workload.
