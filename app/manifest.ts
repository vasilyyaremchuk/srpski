import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Srpski helper",
    short_name: "Srpski",
    description: "Serbian ↔ Russian live translator",
    start_url: "/",
    display: "standalone",
    background_color: "#16171a",
    theme_color: "#16171a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
