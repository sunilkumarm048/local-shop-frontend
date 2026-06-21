import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.localshop.app',
  appName: 'Local Shop',
  // The native app is a WebView that loads your live site. No custom domain
  // needed — point at Vercel now; change this one line to your domain later.
  server: {
    url: 'https://local-shop-frontend.vercel.app',
    cleartext: false,
  },
  android: {
    // Allow the WebView to use geolocation / mixed content as needed.
    allowMixedContent: false,
  },
};

export default config;
