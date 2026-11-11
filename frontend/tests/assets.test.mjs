import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyAssets } from '../scripts/verify-assets.mjs';

function fixture(content) {
  const dir=mkdtempSync(join(tmpdir(),'subscope-bundle-'));
  mkdirSync(join(dir,'assets'));
  writeFileSync(join(dir,'index.html'), `<html><link rel="stylesheet" href="/assets/main.css"><script src="/assets/main.js"></script>${content}</html>`);
  writeFileSync(join(dir,'modal.html'), '<script src="/assets/main.js"></script>');
  writeFileSync(join(dir,'assets/main.js'), 'document.body.textContent = "OK";');
  writeFileSync(join(dir,'assets/main.css'), 'body{color:#fafafa}');
  return dir;
}

test('bundle validator accepts embedded local CSS and JS',()=>{
 const path=fixture('');
 try{assert.equal(verifyAssets(path).ok,true)}finally{rmSync(path,{recursive:true,force:true})}
});

test('bundle validator rejects remote JS',()=>{
 const path=fixture('<script src="https://cdn.example.com/vendor.js"></script>');
 try{const result=verifyAssets(path); assert.equal(result.ok,false); assert.ok(result.errors.some(s=>s.includes('EXTERNAL')))}finally{rmSync(path,{recursive:true,force:true})}
});

test('bundle validator rejects missing local resource',()=>{
 const path=fixture('<link rel="stylesheet" href="/assets/missing.css">');
 try{const result=verifyAssets(path); assert.equal(result.ok,false); assert.ok(result.errors.some(s=>s.includes('MISSING')))}finally{rmSync(path,{recursive:true,force:true})}
});
