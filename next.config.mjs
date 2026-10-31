/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Admin e ekbar dekha/age theke ana page kichukkhon browser e thake — abar click korle shoja dekhay (save/refresh korlei notun hoy)
    staleTimes: {
      dynamic: 30,
      static: 120,
    },
  },
};
export default nextConfig;
