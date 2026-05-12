/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable Node's built-in node:sqlite by allowing the experimental warning to
  // pass through; mark sqlite as external so the bundler doesn't try to inline it.
  experimental: {
    serverComponentsExternalPackages: ["node:sqlite"]
  }
};

export default nextConfig;
