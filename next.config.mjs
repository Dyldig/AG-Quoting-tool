/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['puppeteer'],
  },
  images: {
    domains: [],
  },
}

export default nextConfig
