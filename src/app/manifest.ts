import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SPND Household Budget",
    short_name: "SPND",
    description: "Make room for what matters.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0D0E12",
    theme_color: "#0D0E12",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
