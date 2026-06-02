Running the app (Expo)

Quick start (recommended: Expo Go on device)

1. Ensure dependencies are installed:

```bash
cd mobile
npm install
```

2. Start the Expo dev server:

```bash
npm start
```
```

3. Open the Expo Go app on your phone and scan the QR code shown in the terminal.

Run on Android emulator (requires Android SDK / adb)

1. Install Android Studio and set up an Android Virtual Device (AVD).
2. Install Android SDK command-line tools and the SDK platforms.
3. Set environment variables (in Windows PowerShell / System settings):

- `ANDROID_SDK_ROOT` or `ANDROID_HOME` -> C:\Users\<your-user>\AppData\Local\Android\Sdk
- Add to `PATH`: %ANDROID_SDK_ROOT%\platform-tools

4. Restart your terminal/IDE so the env vars take effect.
5. From the `mobile` folder run:

```bash
npm run android
```

Troubleshooting

- If you see "adb is not recognized" or "Default install location not found", set the SDK path and add `platform-tools` to `PATH`.
- To choose a different Metro port (if 8081 is in use), allow the prompt to use 8082.
- If the Metro server is already running in another terminal, use that terminal's QR or URL (e.g., http://localhost:8081).

If you'd like, I can update `mobile/README.md` instead, or attempt the emulator run after you install Android Studio — tell me which you prefer.