// Gera as imagens do README em docs/telas/.
//
//   PORTAL_LINK="https://lab.oticahub.com/acompanhar/vendedor/<token>" node scripts/capturar-telas.mjs
//       -> telas públicas (login e portal do vendedor), sem abrir janela.
//
//   node scripts/capturar-telas.mjs --painel
//       -> abre o Chrome; você mesmo faz o login e o script fotografa as telas internas.
//
// Precisa do Google Chrome instalado e de: npm i --no-save playwright-core
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "https://lab.oticahub.com";
const OUT = "docs/telas";
const painel = process.argv.includes("--painel");

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: !painel });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
const page = await context.newPage();

async function shot(path, file, { full = false, wait = 1500, width, height } = {}) {
  if (width && height) await page.setViewportSize({ width, height });
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${OUT}/${file}`, fullPage: full });
  console.log("ok", file);
  if (width && height) await page.setViewportSize({ width: 1440, height: 900 });
}

if (!painel) {
  await shot("/login", "login.png");
  if (process.env.PORTAL_LINK) {
    const portal = new URL(process.env.PORTAL_LINK).pathname;
    await shot(portal, "portal-vendedor.png", { width: 430, height: 932 });
    await page.goto(BASE + portal, { waitUntil: "networkidle" });
    const first = await page.locator('a[href*="/os/"]').first().getAttribute("href");
    if (first) await shot(first, "portal-os.png", { width: 430, height: 932 });
  }
} else {
  await page.goto(BASE + "/login");
  console.log("Faça o login na janela do Chrome. Aguardando o painel abrir...");
  await page.waitForURL(/\/dashboard/, { timeout: 5 * 60_000 });
  await shot("/dashboard", "dashboard.png", { wait: 2500 });
  await shot("/montagem", "bancada.png", { wait: 2500 });
  await shot("/laboratorio?view=kanban", "kanban.png", { wait: 2500 });
  await shot("/laboratorio/rapido", "lancamento-rapido.png");
  await shot("/ranking", "ranking.png", { wait: 2500 });
  await page.goto(BASE + "/montagem", { waitUntil: "networkidle" });
  const os = await page.locator('article a[href^="/montagem/"]').first().getAttribute("href");
  if (os) await shot(os, "ordem-servico.png", { wait: 2500 });
}

await browser.close();
