import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cwd } from "node:process";
import { expect, it } from "vitest";

const css = readFileSync(resolve(cwd(), "src/index.css"), "utf8");
const readTokens = (source: string, selector: string) => {
  const block = source.match(new RegExp(`${selector}\\s*\\{([^}]+)\\}`))?.[1] ?? "";
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
};
function contrastRatio(first: string, second: string) {
  const luminance = (color: string) => {
    const [h, s, l] = color.match(/[\d.]+/g)!.map(Number);
    const channel = (n: number) => {
      const k = (n + h / 30) % 12;
      const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
      const value = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(value * 255) / 255;
    };
    return [0, 8, 4].map(channel).reduce((sum, value, index) => {
      const linear = value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      return sum + linear * [0.2126, 0.7152, 0.0722][index];
    }, 0);
  };
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}
const pairs = [
  ["foreground", "background"], ["card-foreground", "card"], ["muted-foreground", "background"],
  ["muted-foreground", "muted"], ["primary-foreground", "primary"], ["primary", "background"],
  ["destructive-foreground", "destructive"], ["destructive", "background"], ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"], ...["draft", "submitted", "review", "partial", "complete", "canceled"].map((status) => [`status-${status}`, "background"]),
];

it("keeps every theme text pair above browser-rounded 4.6:1 contrast", () => {
  for (const mode of [":root", ".dark"]) {
    const tokens = readTokens(css, mode);
    for (const [foreground, background] of pairs) {
      expect(contrastRatio(tokens[foreground], tokens[background]), `${mode} ${foreground}/${background}`).toBeGreaterThanOrEqual(4.6);
    }
  }
});
