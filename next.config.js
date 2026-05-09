/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Aktifkan standalone output untuk Docker deployment
  output: process.env.DOCKER_BUILD ? 'standalone' : undefined,
}

module.exports = nextConfig