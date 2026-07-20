import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'art.brushowl.app',
  appName: 'BrushOwl',
  webDir: 'build',
  // For live-reload during development, run `npm start` and uncomment the
  // block below, replacing the IP with your machine's LAN address. Leave it
  // commented for packaged (production-like) builds that load bundled assets.
  // server: {
  //   url: 'http://192.168.1.10:3000',
  //   cleartext: true,
  // },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#0a132c',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    FirebaseAuthentication: {
      // Keep the Firebase JS SDK as the single source of truth for auth state.
      // The native plugin only brokers the Google credential; we then sign in
      // to the JS SDK with signInWithCredential.
      skipNativeAuth: true,
      providers: ['google.com'],
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
