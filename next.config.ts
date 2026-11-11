import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Microphone is only needed on our own origin.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [{ key: "Permissions-Policy", value: "microphone=(self)" }],
      },
    ];
  },
};

export default nextConfig;
