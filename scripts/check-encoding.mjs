import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const sourceExtensions = new Set(['.css', '.html', '.js', '.md', '.py']);
const ignoredDirectories = new Set(['.git', '__pycache__', 'node_modules']);

async function findSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) files.push(...await findSourceFiles(path));
    } else if (sourceExtensions.has(entry.name.slice(entry.name.lastIndexOf('.')))) {
      files.push(path);
    }
  }

  return files;
}

const decoder = new TextDecoder('utf-8', { fatal: true });
const failures = [];

for (const file of await findSourceFiles(root)) {
  try {
    const text = decoder.decode(await readFile(file));
    if (text.includes('\uFFFD')) {
      failures.push(`${relative(root, file)} contains the Unicode replacement character.`);
    }
  } catch {
    failures.push(`${relative(root, file)} is not valid UTF-8.`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('All source files are valid UTF-8.');
}
