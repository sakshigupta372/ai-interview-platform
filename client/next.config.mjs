/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin Turbopack's workspace root to this app. Without it, Next detects
  // multiple lockfiles (root + client) and may infer the wrong root.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
