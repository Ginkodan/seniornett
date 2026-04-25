import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost",
        "localhost:5173",
        "localhost:5174",
        "localhost:5175",
        "localhost:5176",
      ],
    },
  },
};

export default nextConfig;
