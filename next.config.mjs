/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // Sarvopakar Partner APK is auto-published by the Android repo's CI on
      // every build. Redirecting keeps the stable sarvopakar.com URL while the
      // file itself always stays current — no manual uploads.
      {
        source: '/sarvopakar-provider.apk',
        destination:
          'https://raw.githubusercontent.com/sunilkumarm048/sarvopakar-provider-android/main/release/sarvopakar-provider.apk',
        permanent: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'via.placeholder.com' },
    ],
  },
};

export default nextConfig;
