import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const base = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, base), 'utf8');

test('runtime HTML and styles require no external CDN or downloaded fonts', () => {
  for (const path of ['index.html', 'modal.html']) {
    const html = read(path);
    assert.doesNotMatch(html, /<(?:script|link|iframe)\b[^>]*(?:src|href)\s*=\s*["']https?:\/\//i);
    assert.match(html, /src="\/src\/(main|modal)\.js"/);
  }
  const css = read('src/style.css');
  assert.doesNotMatch(css, /@import\s+(?:url\()?\s*["']?https?:\/\//i);
  assert.doesNotMatch(css, /url\(\s*["']?https?:\/\//i);
  assert.doesNotMatch(css, /\b(?:Inter|DM Mono)\b/);
  assert.match(css, /Consolas/);
});

test('bundler keeps both entrypoints and ships only local assets', () => {
  const conf = read('vite.config.js');
  assert.match(conf, /index\.html/);
  assert.match(conf, /modal\.html/);
  assert.match(conf, /assetsInlineLimit:\s*0/);
  assert.ok(existsSync(new URL('scripts/verify-assets.mjs', base)));
  assert.match(read('package.json'), /"check:assets"/);
});

test('release metadata and local build artifacts are ready', () => {
  assert.match(read('../LICENSE'), /^MIT License/m);
  assert.match(read('../LICENSE'), /Permission is hereby granted, free of charge/);
  assert.match(read('../README.md'), /build\.bat/);
  assert.match(read('../README.md'), /Windows 10\/11/);
  assert.match(read('../.gitignore'), /rsrc_windows/);
  assert.match(read('../.github/workflows/ci.yml'), /windows-latest/);
  assert.match(read('../.github/workflows/release.yml'), /tags:/);
  assert.match(read('../build.bat'), /npm run build/);
  assert.match(read('../build.bat'), /check:assets/);
  assert.match(read('package.json'), /"version": "2\.8\.0"/);
});

test('removed unused legacy node/modal/registry styles', () => {
  const css=read('src/style.css');
  for(const cls of ['.node-modal-backdrop','.registry-table','.score-ring','.compare-stats']){
    assert.ok(!css.includes(cls), `${cls} remains in CSS`);
  }
});
