# Mobile App Install Guide

## 1. Open terminal

Open a terminal in the project folder:

```powershell
cd c:\Users\user\Downloads\roomfindermobile\mobile
```

## 2. Install Node modules

Run:

```powershell
npm install
```

If you already have `node_modules` and want a fresh install:

```powershell
rm -r node_modules package-lock.json
npm install
```

## 3. Start the app

Start the Expo development server:

```powershell
npm start
```

For a web preview:

```powershell
npx expo start --web
```

## 4. Fix non-interactive start issues

If Expo refuses `--non-interactive`, use the CI environment variable:

```powershell
set CI=1
npx expo start --web
```

## 5. Verify the fix

The delete fix was applied in:

- `src/screens/ReservationHistoryScreen.js`

Try navigating to the booking history screen, then delete a reservation to confirm the Firestore delete flow works.

## 6. Troubleshooting

- If `npm install` fails, make sure Node.js is installed and use the latest supported version for Expo.
- If `expo` is not found, install the Expo CLI globally:

```powershell
npm install -g expo-cli
```

- If the app still crashes, reopen the terminal and rerun the install commands.
