import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trejder",
    short_name: "Trejder",
    description: "En enkel marknadsplats för bilhandlare.",
    start_url: "/app/oversikt",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#06342d",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
