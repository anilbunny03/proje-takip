'use strict';
// Run: node tests/branding.test.cjs   (no dependencies; Node built-in test runner + vm)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the exact vendored YAML parser used in the browser.
const jsyaml = require('../vendor/jsyaml.min.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'assets', 'branding.js'), 'utf8');
function freshBranding() {
  const window = {};
  const ctx = vm.createContext({
    window, jsyaml, console, atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    TextEncoder, TextDecoder, Uint8Array, Object, Array, JSON, Error, Promise, Map, Set,
  });
  vm.runInContext(SRC, ctx, { filename: 'branding.js' });
  return window.Branding;
}

// 1x1 PNG
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PNG_URI = 'data:image/png;base64,' + PNG_B64;
const good = (over = {}) => ({
  schema: 1,
  organization: { name: 'Acme Ltd', logo: null },
  appearance: { palette: 'blue', mode: 'system' },
  ...over,
});

// ── in-memory File System Access fake ──
function notFound() { const e = new Error('not found'); e.name = 'NotFoundError'; return e; }
function makeDir(name = 'root', parent = null) {
  const files = new Map(), dirs = new Map();
  const d = {
    name, files, dirs, failWrite: false, failGetDir: null,
    async getDirectoryHandle(n, o = {}) {
      if (d.failGetDir) { const e = new Error('denied'); e.name = d.failGetDir; throw e; }
      if (!dirs.has(n)) { if (!o.create) throw notFound(); dirs.set(n, makeDir(n, d)); }
      return dirs.get(n);
    },
    async getFileHandle(n, o = {}) {
      if (!files.has(n)) { if (!o.create) throw notFound(); files.set(n, ''); }
      return {
        async getFile() { const t = files.get(n); return { async text() { return t; } }; },
        async createWritable() {
          if (d.failWrite || (parent && parent.failWrite)) throw new Error('disk full');
          let buf = '';
          return { async write(x) { buf += x; }, async close() { files.set(n, buf); } };
        },
      };
    },
  };
  return d;
}
async function settingsOf(dir) { return dir.dirs.get('.tracker').files.get('settings.md'); }
function withSettings(B, dir, text) {
  const t = makeDir('.tracker'); t.files.set('settings.md', text); dir.dirs.set('.tracker', t);
}

test('validateConfig accepts good config and returns only known fields', () => {
  const B = freshBranding();
  const r = B.validateConfig(good({ evil: 1, organization: { name: ' Acme ', logo: PNG_URI, style: 'x' } }));
  assert.equal(r.ok, true, r.errors && r.errors.join());
  assert.deepEqual(Object.keys(r.config).sort(), ['appearance', 'organization', 'schema']);
  assert.deepEqual(Object.keys(r.config.organization).sort(), ['logo', 'name']);
  assert.equal(r.config.organization.name, 'Acme');
  assert.equal(r.config.organization.logo, PNG_URI);
});

test('validateConfig rejects bad name', () => {
  const B = freshBranding();
  for (const name of ['', '   ', 'x'.repeat(81), 'a\u0000b', 'a\nb', 5, null]) {
    assert.equal(B.validateConfig(good({ organization: { name } })).ok, false, JSON.stringify(name));
  }
});

test('validateConfig rejects bad palette/mode/schema', () => {
  const B = freshBranding();
  assert.equal(B.validateConfig(good({ appearance: { palette: 'red', mode: 'dark' } })).ok, false);
  assert.equal(B.validateConfig(good({ appearance: { palette: 'blue', mode: 'sepia' } })).ok, false);
  assert.equal(B.validateConfig(good({ appearance: { palette: 'blue;} body{display:none', mode: 'dark' } })).ok, false);
  assert.equal(B.validateConfig(good({ schema: 2 })).ok, false);
  assert.equal(B.validateConfig(null).ok, false);
  assert.equal(B.validateConfig([]).ok, false);
  assert.equal(B.validateConfig('x').ok, false);
});

test('validateConfig rejects non-raster / malformed logos', () => {
  const B = freshBranding();
  const svg = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64');
  const bad = [
    svg,
    'data:image/png;base64,' + Buffer.from('<svg/>').toString('base64'), // wrong magic
    'data:image/png;base64,@@@',
    'http://evil.example/x.png',
    'javascript:alert(1)',
    'data:image/gif;base64,R0lGODlhAQABAAAAACw=',
    PNG_URI + '"onerror="x',
    'data:image/png;base64,' + 'A'.repeat(2 * 1024 * 1024),
    42,
  ];
  for (const logo of bad) {
    assert.equal(B.validateConfig(good({ organization: { name: 'A', logo } })).ok, false, String(logo).slice(0, 40));
  }
});

test('validateConfig rejects prototype keys and does not pollute', () => {
  const B = freshBranding();
  const raw = JSON.parse('{"schema":1,"__proto__":{"polluted":true},"organization":{"name":"A"},"appearance":{"palette":"blue","mode":"dark"}}');
  assert.equal(B.validateConfig(raw).ok, false);
  const raw2 = JSON.parse('{"schema":1,"organization":{"name":"A","constructor":{"prototype":{"x":1}}},"appearance":{"palette":"blue","mode":"dark"}}');
  assert.equal(B.validateConfig(raw2).ok, false);
  assert.equal(({}).polluted, undefined);
  assert.equal(({}).x, undefined);
});

test('serializeSettings/parseSettings round trip', () => {
  const B = freshBranding();
  const cfg = B.validateConfig(good({ organization: { name: 'Çelik Ürünleri A.Ş.', logo: PNG_URI } })).config;
  const text = B.serializeSettings(cfg);
  assert.match(text, /^---\r?\n/);
  const p = B.parseSettings(text);
  assert.equal(p.ok, true, p.errors && p.errors.join());
  assert.deepEqual(JSON.parse(JSON.stringify(p.config)), JSON.parse(JSON.stringify(cfg)));
});

test('parseSettings fails on missing frontmatter, corrupt yaml, invalid config', () => {
  const B = freshBranding();
  assert.equal(B.parseSettings('hello').ok, false);
  assert.equal(B.parseSettings('---\n{not: valid: yaml: [\n---\n').ok, false);
  assert.equal(B.parseSettings('---\n{"schema":1}\n---\n').ok, false);
});

test('detectImageType + fitSize', () => {
  const B = freshBranding();
  assert.equal(B.detectImageType(Buffer.from(PNG_B64, 'base64')), 'image/png');
  assert.equal(B.detectImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0])), 'image/jpeg');
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')]);
  assert.equal(B.detectImageType(webp), 'image/webp');
  assert.equal(B.detectImageType(Buffer.from('<svg xmlns=')), null);
  assert.equal(B.detectImageType(Buffer.from('GIF89a....')), null);
  const fs2 = (...a) => JSON.parse(JSON.stringify(B.fitSize(...a)));
  assert.deepEqual(fs2(1000, 500, 256), { width: 256, height: 128 });
  assert.deepEqual(fs2(100, 50, 256), { width: 100, height: 50 });
  assert.deepEqual(fs2(500, 1000, 256), { width: 128, height: 256 });
  assert.equal(B.MAX_LOGO_BYTES, 2 * 1024 * 1024);
});

test('ensureBeforePick false when unconfigured, true when configured', async () => {
  const B = freshBranding();
  assert.equal(B.ensureBeforePick(), false);
  B.setDraft(good());
  assert.equal(B.ensureBeforePick(), true);
  assert.equal(B.getState().persisted, false);
});

test('setDraft rejects invalid config', () => {
  const B = freshBranding();
  assert.throws(() => B.setDraft(good({ appearance: { palette: 'x', mode: 'dark' } })));
  assert.equal(B.getState().configured, false);
});

test('loadFromDirectory loads valid existing settings', async () => {
  const B = freshBranding();
  const dir = makeDir();
  withSettings(B, dir, B.serializeSettings(B.validateConfig(good({ organization: { name: 'Org A' } })).config));
  const r = await B.loadFromDirectory(dir);
  assert.equal(r.status, 'loaded');
  assert.equal(B.getState().configured, true);
  assert.equal(B.getState().persisted, true);
  assert.equal(B.getState().config.organization.name, 'Org A');
});

test('loadFromDirectory fails closed on invalid settings and clears prior org', async () => {
  const B = freshBranding();
  B.setDraft(good({ organization: { name: 'Prev' } }));
  const dir = makeDir();
  withSettings(B, dir, '---\nschema: 1\n---\n');
  await assert.rejects(() => B.loadFromDirectory(dir));
  assert.equal(B.getState().configured, false);
  assert.equal(dir.dirs.get('.tracker').files.get('settings.md'), '---\nschema: 1\n---\n'); // untouched
});

test('loadFromDirectory fails closed on non-NotFound read errors', async () => {
  const B = freshBranding();
  B.setDraft(good());
  const dir = makeDir(); dir.failGetDir = 'NotAllowedError';
  await assert.rejects(() => B.loadFromDirectory(dir));
  assert.equal(B.getState().configured, false);
});

test('missing settings + no draft => rejects BRANDING_MISSING, nothing written', async () => {
  const B = freshBranding();
  const dir = makeDir();
  await assert.rejects(() => B.loadFromDirectory(dir), (e) => e.code === 'BRANDING_MISSING');
  assert.equal(B.getState().configured, false);
  assert.equal(B.getState().hasDirectory, false);
  assert.equal(dir.dirs.size, 0);
  assert.equal(B.ensureBeforePick(), false);
});

test('invalid settings clear directory so later edits cannot write to it', async () => {
  const B = freshBranding();
  const dir = makeDir(); withSettings(B, dir, 'garbage');
  await assert.rejects(() => B.loadFromDirectory(dir));
  assert.equal(B.getState().hasDirectory, false);
});

test('persistToDirectory is idempotent after load (no org overwrite)', async () => {
  const B = freshBranding();
  const dir = makeDir();
  const text = B.serializeSettings(B.validateConfig(good({ organization: { name: 'Real Org' } })).config);
  withSettings(B, dir, text);
  await B.loadFromDirectory(dir);
  await B.persistToDirectory(dir);
  assert.equal(await settingsOf(dir), text);
});

test('localStorage cache never authorizes: init leaves unconfigured', () => {
  const window = {};
  const store = { 'bnb-tracker-branding-draft-v1': JSON.stringify(good({ organization: { name: 'Cached' } })) };
  const ctx = vm.createContext({ window, jsyaml, console, atob: (x) => Buffer.from(x, 'base64').toString('binary'),
    localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } } });
  vm.runInContext(SRC, ctx);
  window.Branding.init();
  assert.equal(window.Branding.getState().configured, false);
  assert.equal(window.Branding.ensureBeforePick(), false);
});

test('missing settings + draft => draft persisted to directory', async () => {
  const B = freshBranding();
  B.setDraft(good({ organization: { name: 'Draft Org', logo: PNG_URI } }));
  const dir = makeDir();
  const r = await B.loadFromDirectory(dir);
  assert.equal(r.status, 'saved');
  const text = await settingsOf(dir);
  assert.match(text, /Draft Org/);
  assert.equal(B.getState().persisted, true);
  assert.equal(B.parseSettings(text).ok, true);
});

test('workspace switch does not leak previous org into workspace without config', async () => {
  const B = freshBranding();
  const a = makeDir('A');
  withSettings(B, a, B.serializeSettings(B.validateConfig(good({ organization: { name: 'Org A', logo: PNG_URI } })).config));
  await B.loadFromDirectory(a);
  const b = makeDir('B');
  await assert.rejects(() => B.loadFromDirectory(b), (e) => e.code === 'BRANDING_MISSING');
  assert.equal(B.getState().config, null);
  assert.equal(b.dirs.size, 0);
  assert.equal(B.ensureBeforePick(), false);
});

test('persistToDirectory failure rejects and leaves state unpersisted', async () => {
  const B = freshBranding();
  B.setDraft(good());
  const dir = makeDir(); dir.failWrite = true;
  await assert.rejects(() => B.persistToDirectory(dir));
  assert.equal(B.getState().persisted, false);
  const dir2 = makeDir();
  await B.persistToDirectory(dir2);
  assert.equal(B.getState().persisted, true);
});

test('persistToDirectory without config rejects', async () => {
  const B = freshBranding();
  await assert.rejects(() => B.persistToDirectory(makeDir()));
});

test('persistToDirectory preserves unrelated top-level keys, drops dangerous ones', async () => {
  const B = freshBranding();
  const dir = makeDir();
  const existing = B.serializeSettings(B.validateConfig(good()).config, { other: { keep: 1 } });
  withSettings(B, dir, existing);
  await B.loadFromDirectory(dir);
  B.setDraft(good({ organization: { name: 'Renamed' } }));
  await B.persistToDirectory(dir);
  const p = B.parseSettings(await settingsOf(dir));
  assert.equal(p.ok, true);
  assert.equal(p.config.organization.name, 'Renamed');
  assert.deepEqual(JSON.parse(JSON.stringify(p.extras)), { other: { keep: 1 } });
});

test('persistToDirectory refuses to overwrite an invalid existing file', async () => {
  const B = freshBranding();
  B.setDraft(good());
  const dir = makeDir();
  withSettings(B, dir, 'garbage');
  await assert.rejects(() => B.persistToDirectory(dir));
  assert.equal(await settingsOf(dir), 'garbage');
});

test('branding snapshot restores exact workspace identity after failed selection',async()=>{
  const B=freshBranding(); const a=makeDir('A'),b=makeDir('B');
  withSettings(B,a,B.serializeSettings(good({organization:{name:'Org A',logo:PNG_URI}})));
  withSettings(B,b,B.serializeSettings(good({organization:{name:'Org B',logo:null}})));
  await B.loadFromDirectory(a); const snapshot=B.snapshot();
  await B.loadFromDirectory(b); B.restore(snapshot);
  assert.equal(B.getState().config.organization.name,'Org A');
  assert.equal(B.getState().persisted,true);
  assert.equal(B.snapshot().dir,a);
  B.setDraft(good({organization:{name:'Org A değişti',logo:null}}));
  await B.persistToDirectory(B.snapshot().dir);
  assert.match(await settingsOf(a),/Org A değişti/);
  assert.doesNotMatch(await settingsOf(b),/Org A değişti/);
});
test('recursive YAML aliases and nested dangerous arrays cannot hang validation',()=>{
  const B=freshBranding();
  const yamlText='---\nschema: 1\norganization:\n  name: Safe\nappearance:\n  palette: blue\n  mode: light\nextra: &loop\n  self: *loop\n---\n';
  assert.doesNotThrow(()=>B.parseSettings(yamlText));
  const raw=good();raw.organization.nested=[[[JSON.parse('{"__proto__":{"bad":true}}')]]];
  assert.equal(B.validateConfig(raw).ok,false);
});
test('oversized settings rejected before parsing YAML',()=>{
  const B=freshBranding();
  const p=B.parseSettings('---\n'+ 'x'.repeat(1500001)+'\n---\n');
  assert.equal(p.ok,false);assert.match(p.errors.join(' '),/büyük/);
});

test('palette/mode catalogs', () => {
  const B = freshBranding();
  assert.deepEqual([...B.PALETTES], ['blue', 'green', 'purple', 'gold']);
  assert.deepEqual([...B.MODES], ['light', 'dark', 'system']);
});
