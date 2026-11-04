import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OticaHub Lab",
    short_name: "Lab",
    description: "Gestão operacional do laboratório óptico — lançar OS, bancada e entrega.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ede6d8",
    theme_color: "#0b5c54",
    lang: "pt-BR",
    orientation: "any",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
