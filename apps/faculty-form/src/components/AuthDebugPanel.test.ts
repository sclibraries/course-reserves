import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('AuthDebugPanel source copy', () => {
  it('does not expose real-looking mock identity examples or generated account previews', () => {
    const source = readFileSync(join(__dirname, 'AuthDebugPanel.tsx'), 'utf8');

    expect(source).not.toContain('Karla');
    expect(source).not.toContain('999999999');
    expect(source).not.toContain('Will create:');
    expect(source).not.toContain('Token Expires');
  });
});
