import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OticaHub Lab",
    short_name: "Lab",
    description: "Gestão operacional do laboratório óptico — lançar OS, bancada e entrega.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f3f6f6",
    theme_color: "#087e83",
    lang: "pt-BR",
    orientation: "any",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
