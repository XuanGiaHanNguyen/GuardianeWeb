/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root to this project. Without it, Next.js sees the stray
  // lockfile at ~/package-lock.json and guesses the wrong root.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
