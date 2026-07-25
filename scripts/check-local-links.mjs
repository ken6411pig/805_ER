import { access, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const root = process.cwd();
const ignoredDirectories = new Set(['.git', '__pycache__', 'node_modules']);
const localAttributePattern = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;

async function findHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) files.push(...await findHtmlFiles(path));
    } else if (entry.name.endsWith('.html')) {
      files.push(path);
    }
  }

  return files;
}

function isLocalReference(value) {
  return value && !value.startsWith('#') && !/^(?:data|https?|mailto|tel|javascript):/i.test(value) && !value.startsWith('//');
}

const failures = [];
for (const file of await findHtmlFiles(root)) {
  const html = await (await import('node:fs/promises')).readFile(file, 'utf8');
  for (const match of html.matchAll(localAttributePattern)) {
    const reference = match[1];
    if (!isLocalReference(reference)) continue;
    const pathWithoutFragment = reference.split(/[?#]/, 1)[0];
    try {
      await access(join(dirname(file), pathWithoutFragment), constants.F_OK);
    } catch {
      failures.push(`${relative(root, file)} references missing file: ${reference}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('All local HTML links resolve.');
}
