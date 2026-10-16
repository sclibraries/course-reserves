import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function createDataStore({ seedPath, runtimePath }) {
  mkdirSync(dirname(runtimePath), { recursive: true });
  if (!existsSync(runtimePath)) copyFileSync(seedPath, runtimePath);

  function read() {
    return JSON.parse(readFileSync(runtimePath, 'utf8'));
  }

  function write(data) {
    const temporaryPath = runtimePath + '.tmp';
    writeFileSync(temporaryPath, JSON.stringify(data, null, 2) + '\n');
    renameSync(temporaryPath, runtimePath);
    return data;
  }

  return {
    read,
    write,
    update(mutator) {
      const data = read();
      const result = mutator(data);
      write(data);
      return result;
    },
    reset() {
      copyFileSync(seedPath, runtimePath);
      return read();
    },
  };
}
