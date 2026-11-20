import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lab Gold",
    short_name: "Lab",
    description: "Gestão operacional do laboratório óptico — lançar OS, bancada e entrega.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7f6f3",
    theme_color: "#8c6239",
    lang: "pt-BR",
    orientation: "any",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
