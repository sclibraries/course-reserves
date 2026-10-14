import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = path.resolve(globalThis.process.cwd(), 'src');
const exemptFiles = new Set([
  'config/defaults.js',
  'services/apiClient.js',
  'components/page-sections/course-record/api.js',
]);
const hardcodedApiUrl = new RegExp(['https:', '', 'libtools2\\.smith\\.edu'].join('/'));

function getSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return getSourceFiles(entryPath);
    return /\.jsx?$/.test(entry.name) ? [entryPath] : [];
  });
}

describe('API host configuration guard', () => {
  it('routes production API calls through config outside documented fallbacks', () => {
    const violations = getSourceFiles(sourceRoot)
      .filter((filePath) => !exemptFiles.has(path.relative(sourceRoot, filePath)))
      .flatMap((filePath) => {
        const contents = readFileSync(filePath, 'utf8');
        return Array.from(contents.matchAll(new RegExp(hardcodedApiUrl.source, 'gi')), ([match]) =>
          `${path.relative(sourceRoot, filePath)}: ${match}`
        );
      });

    expect(violations).toEqual([]);
  });
});
