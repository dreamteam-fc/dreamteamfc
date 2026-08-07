import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dream Team FC",
    short_name: "Dream Team",
    description:
      "Passione per il fantacalcio — leghe private, rose e formazioni.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#050505",
    theme_color: "#1a5fff",
    lang: "it",
    categories: ["sports", "games"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/icon-192-maskable.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
