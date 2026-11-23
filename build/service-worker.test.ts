import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { listFiles, serviceWorkerSource, versionOf } from './service-worker';

const dirs: string[] = [];

function site(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'sw-test-'));
  dirs.push(dir);
  for (const [name, content] of Object.entries(files)) {
    const path = join(dir, name);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, content);
  }
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('listFiles', () => {
  it('lists every built file, sorted, except the service worker itself', () => {
    const dir = site({
      'index.html': '<html>',
      'assets/index-abc.js': 'js',
      'icons/icon-192.png': 'png',
      'sw.js': 'old',
    });
    expect(listFiles(dir)).toEqual(['assets/index-abc.js', 'icons/icon-192.png', 'index.html']);
  });
});

describe('versionOf', () => {
  it('changes when any file changes, and only then', () => {
    const a = site({ 'index.html': '<html>', 'assets/x.js': '1' });
    const b = site({ 'index.html': '<html>', 'assets/x.js': '1' });
    const c = site({ 'index.html': '<html>', 'assets/x.js': '2' });
    const v = (dir: string) => versionOf(dir, listFiles(dir));
    expect(v(a)).toBe(v(b));
    expect(v(a)).not.toBe(v(c));
    expect(v(a)).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe('serviceWorkerSource', () => {
  const source = serviceWorkerSource(['assets/index-abc.js', 'index.html', 'manifest.webmanifest'], 'v1');

  it('precaches the page as "./" and every other file', () => {
    expect(source).toContain('"./"');
    expect(source).toContain('"./assets/index-abc.js"');
    expect(source).toContain('"./manifest.webmanifest"');
    expect(source).not.toContain('"./index.html"');
  });

  it('names its cache after the version', () => {
    expect(source).toContain('const VERSION = "v1";');
  });

  it('waits to take over until asked', () => {
    expect(source).toContain("event.data.type === 'SKIP_WAITING'");
    expect(source).not.toMatch(/install[\s\S]*skipWaiting\(\)[\s\S]*activate/);
  });

  it('is valid JavaScript', () => {
    expect(() => new Function(source)).not.toThrow();
  });
});
