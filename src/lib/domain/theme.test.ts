import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
const css = readFileSync("src/app/globals.css", "utf8");
const system = css.slice(css.indexOf("/* Lab Gold design system:"));
function theme(dark: boolean) {
  const selector = dark ? /:root\[data-theme="dark"\]\s*\{([^}]+)\}/ : /:root\s*\{([^}]+)\}/;
  const block = system.match(selector)?.[1] ?? "";
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*#([a-f\d]{3,6})\b/gi)].map(m => [m[1], m[2].length === 3 ? [...m[2]].map(x => x + x).join("") : m[2]]));
}
function luminance(hex: string) {
  const a = hex.match(/../g)!.map(x => parseInt(x, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return a[0] * .2126 + a[1] * .7152 + a[2] * .0722;
}
function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((a, b) => a - b);
  return (y + .05) / (x + .05);
}

describe("Lab Gold theme contrast", () => {
  for (const dark of [false, true]) it(`keeps actual ${dark ? "dark" : "light"} text tokens at AA`, () => {
    const tokens = theme(dark);
    for (const [fg, bg] of [
      ["--ink", "--background"], ["--ink", "--surface"],
      ["--muted", "--background"], ["--muted", "--surface"],
      ["--on-accent", "--accent"], ["--on-accent", "--accent-strong"],
      ["--link", "--surface"], ["--ok", "--ok-soft"],
      ["--warning", "--warning-soft"], ["--danger", "--danger-soft"],
    ]) {
      expect(tokens[fg], fg).toBeDefined();
      expect(tokens[bg], bg).toBeDefined();
      expect(contrast(tokens[fg], tokens[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("defines every theme variable referenced by the stylesheet", () => {
    const defined = new Set([...css.matchAll(/(--[\w-]+):/g)].map(m => m[1]));
    for (const match of css.matchAll(/var\((--[\w-]+)\)/g)) if (!match[1].startsWith("--font-")) expect(defined.has(match[1]), match[1]).toBe(true);
  });
});
