/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'wgefhisxkhmrdyccckli.supabase.co',
      },
    ],
  },
};

module.exports = nextConfig;
