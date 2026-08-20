import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray package-lock.json in the home directory makes Turbopack infer the
  // wrong workspace root, which leaves every route 404ing in dev. Pin it here.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
