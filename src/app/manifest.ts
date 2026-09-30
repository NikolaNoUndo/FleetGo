import type { MetadataRoute } from "next";

/** "Add to Home screen": Roadline opens full screen like an app, without the browser bar. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Roadline",
    short_name: "Roadline",
    description: "Upravljanje voznim parkom za prevozničke i logističke firme.",
    lang: "sr-Latn",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#151414",
    theme_color: "#151414",
    icons: [
      { src: "/roadline-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/roadline-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/roadline-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
