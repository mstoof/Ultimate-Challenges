import type { NextConfig } from "next";

const config: NextConfig = {
  // De Neon-driver praat over HTTP en hoeft niet gebundeld te worden.
  serverExternalPackages: ["@neondatabase/serverless"],
};

export default config;
