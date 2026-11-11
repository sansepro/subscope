import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('release pipeline compiles Windows exe on version tags', () => {
  const workflow = read('../../.github/workflows/release.yml');
  assert.match(workflow, /push:/);
  assert.match(workflow, /tags:\s*\n\s*- ['"]v\*['"]/);
  assert.match(workflow, /windows-latest/);
  assert.match(workflow, /contents: write/);
  assert.match(workflow, /build\.bat --ci/);
  assert.match(workflow, /bin\\Subscope\.exe/);
});

test('release attaches standalone exe, portable zip, and checksums', () => {
  const workflow = read('../../.github/workflows/release.yml');
  assert.match(workflow, /Subscope\.exe/);
  assert.match(workflow, /Subscope-windows-x64\.zip/);
  assert.match(workflow, /SHA256SUMS\.txt/);
  assert.match(workflow, /Get-FileHash/);
  assert.match(workflow, /gh release (create|upload)/);
  assert.match(workflow, /gh release upload/);
});

test('release rejects missing or invalid native binary', () => {
  const workflow = read('../../.github/workflows/release.yml');
  assert.match(workflow, /Test-Path/);
  assert.match(workflow, /0x4D/);
  assert.match(workflow, /0x5A/);
});

test('release packaging is independent of README contents or optional docs', () => {
  const workflow = read('../../.github/workflows/release.yml');
  assert.match(workflow, /Get-ChildItem/);
  assert.match(workflow, /Where-Object/);
  assert.match(workflow, /Compress-Archive/);
  assert.doesNotMatch(workflow, /-LiteralPath ['"]README\.md['"]/);
  assert.doesNotMatch(workflow, /--notes-file/);
});
