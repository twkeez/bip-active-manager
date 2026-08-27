import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Belt-and-braces pin of the Turbopack workspace root.
  //
  // Next infers the root by searching upward for a lockfile. A stray, empty
  // ~/package-lock.json made it pick /Users/tom, which 404'd every dev route and —
  // worse — made postcss fail to resolve tailwindcss, spawning a new worker process
  // per failure at ~30/sec until the machine ran out of memory and panicked.
  //
  // The real fix was removing that stray lockfile; this pin alone does NOT prevent it,
  // because postcss resolution goes through Turbopack's webpack-compat layer, which
  // uses the inferred root regardless. Keep both.
  //
  // Was `__dirname`, which is undefined when this config loads as ESM — so the pin was
  // silently a no-op. cwd is correct in both module systems, since `next dev`/`next
  // build` always run from the package root.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
