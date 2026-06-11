import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.driveclique.app',
  appName: 'DriveClique',
  webDir: 'dist',

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
