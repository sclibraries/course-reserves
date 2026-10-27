import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";
import { expect, it } from "vitest";

const css = readFileSync(resolve(cwd(), "src/index.css"), "utf8");
const formCss = readFileSync(resolve(cwd(), "../faculty-form/src/index.css"), "utf8");
const readTokens = (source, selector) => {
  const block = source.match(new RegExp(`${selector}\\s*\\{([^}]+)\\}`))?.[1] ?? "";
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
};
function rgbFromHsl(color) {
  const [h, s, l] = color.match(/[\d.]+/g).map(Number);
  const channel = (n) => {
    const k = (n + h / 30) % 12;
    const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
    const value = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255) / 255;
  };
  return [0, 8, 4].map(channel);
}
function luminance(rgb) {
  return rgb.reduce((sum, value, index) => {
    const linear = value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
}
function contrastRatio(first, second) {
  const [lighter, darker] = [luminance(rgbFromHsl(first)), luminance(rgbFromHsl(second))].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}
function contrastOnTint(foreground, tint, surface) {
  const tintRgb = rgbFromHsl(tint);
  const surfaceRgb = rgbFromHsl(surface);
  const blended = tintRgb.map((channel, index) => channel * 0.15 + surfaceRgb[index] * 0.85);
  const [lighter, darker] = [luminance(rgbFromHsl(foreground)), luminance(blended)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}
const pairs = [
  ["foreground", "background"], ["card-foreground", "card"], ["muted-foreground", "background"],
  ["muted-foreground", "muted"], ["primary-foreground", "primary"], ["primary", "background"],
  ["destructive-foreground", "destructive"], ["destructive", "background"], ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"], ...["draft", "submitted", "review", "partial", "complete", "canceled"].map((status) => [`status-${status}`, "background"]),
];

it("checks status and priority chip contrast and retains shared faculty theme tokens", () => {
  for (const mode of [":root", ".dark"]) {
    const tokens = readTokens(css, mode);
    const adminOnly = /^(status-(draft|submitted|review|partial|complete|canceled)-fg|priority-(normal|high|urgent)(-fg)?|border-strong)$/;
    expect(Object.fromEntries(Object.entries(tokens).filter(([name]) => !adminOnly.test(name))))
      .toEqual(readTokens(formCss, mode));
    for (const [foreground, background] of pairs) {
      expect(contrastRatio(tokens[foreground], tokens[background]), `${mode} ${foreground}/${background}`).toBeGreaterThanOrEqual(4.6);
    }
    for (const status of ["draft", "submitted", "review", "partial", "complete", "canceled"]) {
      expect(contrastOnTint(tokens[`status-${status}-fg`], tokens[`status-${status}`], tokens.card), `${mode} status-${status} tint`).toBeGreaterThanOrEqual(4.5);
    }
    for (const priority of ["normal", "high", "urgent"]) {
      expect(contrastOnTint(tokens[`priority-${priority}-fg`], tokens[`priority-${priority}`], tokens.card), `${mode} priority-${priority} tint`).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(tokens["border-strong"], tokens.card), `${mode} progress track/card`).toBeGreaterThanOrEqual(3);
  }
});
