import { readFileSync } from 'node:fs';

export const controlPage = readFileSync(new URL('./page.html', import.meta.url), 'utf8');
