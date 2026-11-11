import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, join, dirname, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Verify that a production webview loads all UI assets from the embedded dist. */
export function verifyAssets(directory) {
  const root = resolve(directory);
  const errors = [];
  const files = [];
  const walk = dir => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, ent.name);
      if (ent.isDirectory()) walk(path);
      else if (ent.isFile()) files.push(path);
    }
  };
  if (!existsSync(root) || !statSync(root).isDirectory()) return { ok: false, errors: ['DIST / MISSING'] };
  walk(root);

  const checkReference = (ref, origin) => {
    const value = String(ref).trim();
    if (!value || value.startsWith('#') || value.startsWith('data:') || value.startsWith('blob:')) return;
    if (/^(?:https?:)?\/\//i.test(value) || /^(?:javascript:|file:)/i.test(value)) {
      errors.push(`${relative(root, origin)}: EXTERNAL / ${value.slice(0, 110)}`);
      return;
    }
    const path = decodeURIComponent(value.split(/[?#]/)[0]);
    const target = resolve(path.startsWith('/') ? root : dirname(origin), path.replace(/^\/+/, ''));
    if (target !== root && !target.startsWith(root + sep)) {
      errors.push(`${relative(root, origin)}: OUTSIDE / ${value}`);
    } else if (!existsSync(target)) {
      errors.push(`${relative(root, origin)}: MISSING / ${value}`);
    }
  };

  for (const entry of ['index.html', 'modal.html']) {
    if (!files.includes(join(root, entry))) errors.push(`DIST / ${entry} MISSING`);
  }
  if (!files.some(x => x.endsWith('.js'))) errors.push('DIST / JS MISSING');
  if (!files.some(x => x.endsWith('.css'))) errors.push('DIST / CSS MISSING');

  for (const file of files) {
    if (!/\.(html|css)$/i.test(file)) continue;
    const content = readFileSync(file, 'utf8');
    if (file.endsWith('.html')) {
      for (const match of content.matchAll(/<(?:script|link|iframe|img)\b[^>]*?\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) checkReference(match[1], file);
    } else {
      for (const match of content.matchAll(/url\(\s*["']?([^)'"\s]+)["']?\s*\)/gi)) checkReference(match[1], file);
      if (/@import\b/i.test(content)) errors.push(`${relative(root, file)}: CSS IMPORT`);
    }
  }
  return { ok: errors.length === 0, errors, files: files.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = verifyAssets(process.argv[2] || resolve('dist'));
  for (const error of result.errors) console.error(error);
  if (!result.ok) process.exitCode = 1;
  else console.log(`BUNDLE OK / ${result.files} files / NO CDN`);
}
