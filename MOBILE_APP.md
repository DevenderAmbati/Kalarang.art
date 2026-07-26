# BrushOwl Mobile App (Capacitor)

The existing React web app is wrapped with [Capacitor](https://capacitorjs.com/)
to ship native Android (and later iOS) apps to the Play Store / App Store. The
same code in `src/` runs inside a native WebView; Capacitor adds the native
`android/` shell that loads the built web assets from `build/`.

You are on Windows, so day-to-day testing is Android. iOS builds need a Mac
(or Mac cloud CI) later.

## Project pieces added

- `capacitor.config.ts` - app id `art.brushowl.app`, name `BrushOwl`, `webDir: build`
- `android/` - generated native Android project (committed)
- `src/utils/platform.ts` - `isNativeApp()` / `getPlatform()` helpers
- `src/native/nativeApp.ts` - status bar, splash hand-off, hardware back button, push-tap navigation
- Native branches in `src/services/authService.ts` (Google) and `src/services/fcmService.ts` (push)
- PWA install prompt + service worker are disabled inside the native shell

### npm scripts

| Script | What it does |
|--------|--------------|
| `npm run cap:sync` | `build:dev` then `npx cap sync android` (dev Firebase) |
| `npm run cap:sync:prod` | `build` (prod env) then sync |
| `npm run cap:open` | Open the Android project in Android Studio |
| `npm run cap:run` | Build/run on an emulator or connected device |

## One-time tooling on your PC

1. [Android Studio](https://developer.android.com/studio) (installs the Android SDK + emulator)
2. JDK 17+ (see `JAVA_INSTALLATION_GUIDE.md`)
3. Optional: a physical Android phone with USB debugging enabled
   (Settings -> About phone -> tap Build number 7x -> Developer options -> USB debugging)

## How to test BEFORE any store submission

You never need the Play Store to validate the app.

### A. Live reload (fastest daily loop)

1. `npm start` - note the LAN URL (e.g. `http://192.168.1.10:3000`)
2. In `capacitor.config.ts`, uncomment the `server` block and set `url` to that LAN address
3. `npm run cap:sync` then `npm run cap:run`
4. Edit React code -> the app hot-reloads like the browser

Re-comment the `server` block when you want a packaged build.

### B. Packaged build (closest to the store binary)

1. `npm run cap:sync`
2. `npm run cap:open`
3. In Android Studio press Run and pick an emulator (AVD) or your USB device

Use this for splash/status bar, back button, file pickers, offline shell.

### C. Physical device checklist

- Email/password login (works without extra setup)
- Google login (needs `google-services.json`, see below)
- Home / Discover / Favourites scroll + images
- Artwork upload + crop/compress
- Chat + push notification prompt (needs `google-services.json`)
- Share sheet, safe areas, bottom nav, keyboard overlap

### D. Pre-store distribution (still private)

- Google Play Console -> Internal testing track: upload an AAB, invite testers by email
- Or sideload a debug APK straight from Android Studio

## Enabling Google Sign-In and Push (google-services.json)

Both features use the native Firebase SDK, so they need one file:

1. Firebase console -> Project settings -> add an Android app with package
   name `art.brushowl.app`
2. Add your signing SHA-1 and SHA-256 fingerprints (debug and, later, release):
   - Debug: `cd android && ./gradlew signingReport` (copy the debug SHA-1/256)
3. Download `google-services.json` into `android/app/google-services.json`
4. `npm run cap:sync`, then rebuild in Android Studio

`android/app/build.gradle` already applies the google-services Gradle plugin
automatically when this file is present, so no manual Gradle edits are needed.
Without the file, email/password login still works for testing.

### Push notifications not showing on the installed app?

1. **Deploy Cloud Functions** after pull — Android needs an `android.notification`
   payload (data-only works for the PWA service worker, not the native tray).
2. On the phone: open BrushOwl → **Profile → Notifications → Enable**, and allow
   the system permission prompt (Android 13+).
3. Confirm a token exists: Firestore → `userTokens` → a doc like
   `{yourUid}_{deviceId}` with `platform: "android"`.
4. Put the app in the background, then trigger a chat/like from another account.
5. Phone settings → Apps → BrushOwl → Notifications must be allowed.
6. Emulators often lack Google Play Services — use a real device for push tests.

## Store readiness (after local QA is green)

### Icons and splash

Provide a 1024x1024 source icon and generate native assets:

```bash
npm install -D @capacitor/assets
# place a 1024x1024 icon at resources/icon.png (and optional resources/splash.png)
npx capacitor-assets generate --android
```

### Versioning

Bump before each release in `android/app/build.gradle`:

- `versionCode` - integer, must increase every upload
- `versionName` - user-facing string, e.g. `1.0.1`

### Signing (release)

1. Create a keystore (keep it private, never commit):
   ```bash
   keytool -genkey -v -keystore brushowl-release.keystore -alias brushowl -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Configure release signing in `android/app/build.gradle` (or via
   `android/keystore.properties`, git-ignored)
3. Build an app bundle: Android Studio -> Build -> Generate Signed Bundle (AAB)

### Play Console

Privacy policy URL (you have `/privacy`), screenshots, content rating, data
safety form, then release: Internal -> Closed -> Production.

## iOS (later, needs macOS)

Same Capacitor project on a Mac:

```bash
npm install @capacitor/ios
npx cap add ios
npm run build && npx cap sync ios
npx cap open ios   # run in Simulator or archive for TestFlight
```

Requires an Apple Developer account. Add the iOS app + `GoogleService-Info.plist`
in Firebase for Google auth and push.
