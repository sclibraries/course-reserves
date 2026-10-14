import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { HITCHCOCK_VIDEO_PREFIX, LIBPROXY_PREFIX } from '../util/externalLinks';

const sourceRoot = path.resolve(globalThis.process.cwd(), 'src');
const exemptFiles = new Set([
  'config/defaults.js',
  'services/apiClient.js',
  'components/page-sections/course-record/api.js',
]);
const hardcodedApiUrl = new RegExp(['https:', '', 'libtools2\\.smith\\.edu'].join('/'));
const externalLinkPrefixes = [LIBPROXY_PREFIX, HITCHCOCK_VIDEO_PREFIX];

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

  it('keeps outbound link prefixes in util/externalLinks.js', () => {
    const violations = getSourceFiles(sourceRoot)
      .filter((filePath) => path.relative(sourceRoot, filePath) !== 'util/externalLinks.js')
      .flatMap((filePath) => {
        const contents = readFileSync(filePath, 'utf8');
        return externalLinkPrefixes
          .filter((prefix) => contents.includes(prefix))
          .map((prefix) => `${path.relative(sourceRoot, filePath)}: ${prefix}`);
      });

    expect(violations).toEqual([]);
  });
});
