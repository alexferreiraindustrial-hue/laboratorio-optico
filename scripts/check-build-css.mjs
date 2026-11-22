import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

async function stylesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? stylesIn(file) : entry.name.endsWith(".css") ? readFile(file, "utf8") : "";
  }));
  return files.flat().join("\n");
}

const css = await stylesIn(".next/static");
for (const [name, pattern] of [
  ["layout flex", /\.flex\s*\{\s*display:\s*flex/],
  ["accessible hidden labels", /\.sr-only\s*\{/],
  ["responsive layout", /@media[^{}]*width[^{}]*\{/],
]) {
  if (!pattern.test(css)) throw new Error(`Generated CSS is missing ${name}. Check the Tailwind/PostCSS configuration.`);
}
console.log("Production CSS includes layout, accessibility and responsive utilities.");
