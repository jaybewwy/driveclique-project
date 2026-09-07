import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.driveclique.app',
  appName: 'DriveClique',
  webDir: 'dist',

  // androidScheme: 'http' (default is 'https' since Capacitor 3) makes the
  // WebView load the app itself over http://localhost instead of
  // https://localhost — necessary during local dev because the backend runs
  // on plain HTTP (10.0.2.2:5000 in the emulator); an https page is not
  // allowed to call an http endpoint at all (browser "mixed content"
  // blocking, separate from and stricter than CSP). Switch this back to the
  // default (remove the whole `server` block) once the app talks to a real
  // HTTPS-deployed backend for release builds.
  server: {
    androidScheme: 'http',
  },

  // Uncomment `server.url` for live-reload during development:
  //   1. Find your machine's local IP: `ipconfig` (Windows) / `ifconfig` (Mac/Linux)
  //   2. Start the Vite dev server: npm run dev
  //   3. Uncomment the line below and replace the IP
  //   4. Run: npx cap run android  (or ios on Mac)
  //   IMPORTANT: Comment this out again before a release build.
  // server: {
  //   url: 'http://192.168.x.x:5173',
  //   cleartext: true,
  // },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#09090b',        // zinc-950 — matches app background
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      spinnerColor: '#dc2626',           // red-600 — brand accent
    },
    StatusBar: {
      style: 'Dark',                     // white icons on dark background
      backgroundColor: '#09090b',
    },
  },
};

export default config;
