import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
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
  const workflows = readdirSync(new URL('../.github/workflows/', base)).filter(x => /\.ya?ml$/.test(x));
  assert.deepEqual(workflows, ['release.yml']);
  const workflow = read('../.github/workflows/release.yml');
  assert.match(workflow, /^on:\s*\n\s*push:\s*\n\s*tags:\s*\n\s*- ['\"]?v\*/m);
  assert.doesNotMatch(workflow, /^\s*(branches|pull_request|workflow_dispatch|schedule):/m);
  assert.match(read('../build.bat'), /npm run build/);
  assert.match(read('../build.bat'), /check:assets/);
  assert.match(read('package.json'), /"version": "2\.9\.1"/);
});

test('removed unused legacy node/modal/registry styles', () => {
  const css=read('src/style.css');
  for(const cls of ['.node-modal-backdrop','.registry-table','.score-ring','.compare-stats']){
    assert.ok(!css.includes(cls), `${cls} remains in CSS`);
  }
});
