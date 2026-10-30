/* Proje Takip Uygulaması — Kurum kimliği / görünüm (window.Branding)
 *
 * Public API: init(), open(), ensureBeforePick(), loadFromDirectory(handle),
 *             persistToDirectory(handle), plus validateConfig / parseSettings /
 *             serializeSettings / setDraft / getState / detectImageType / fitSize (tests).
 * Settings live in <workspace>/.tracker/settings.md (YAML frontmatter, via global jsyaml).
 * Nothing runs at load time except defining window.Branding; DOM work starts in init().
 */
(function (root) {
  'use strict';

  var SCHEMA = 1;
  var PALETTES = Object.freeze(['blue', 'green', 'purple', 'gold']);
  var MODES = Object.freeze(['light', 'dark', 'system']);
  var PALETTE_LABELS = { blue: 'Mavi', green: 'Yeşil', purple: 'Mor', gold: 'Altın' };
  var MODE_LABELS = { light: 'Açık', dark: 'Koyu', system: 'Sistem' };
  var MAX_LOGO_BYTES = 2 * 1024 * 1024;     // upload limit
  var MAX_LOGO_DIM = 256;                   // stored raster is resized to fit this box
  var MAX_SOURCE_PIXELS = 40e6;             // refuse decompression bombs
  var MAX_LOGO_URI_CHARS = 700000;          // stored data URI limit
  var MAX_NAME_CHARS = 80;
  var SETTINGS_DIR = '.tracker';
  var SETTINGS_FILE = 'settings.md';
  var CACHE_KEY = 'bnb-tracker-branding-draft-v1';
  var APP_SUFFIX = ' Proje Takip Uygulaması';
  var DANGEROUS = ['__proto__', 'constructor', 'prototype'];
  var KNOWN_TOP = ['schema', 'organization', 'appearance'];
  var LOGO_RE = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+\/]+={0,2})$/;
  var NAME_BAD_RE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069\u200e\u200f]/;

  var state = {
    config: null,        // validated config or null
    persisted: false,    // true only after a verified write / successful load from a directory
    dir: null,           // current workspace handle (set by loadFromDirectory/persistToDirectory)
    deferred: false,     // user said "my folder already has settings": allow one pick
    cacheError: null,
    prefill: null,       // cached last setup: form prefill only, never authorization
    afterMissing: false,
    initialized: false,
    originals: null,
    mqList: null,
  };

  // ───────────────────────── pure helpers ─────────────────────────
  function isPlainObject(o) {
    return o !== null && typeof o === 'object' && Object.prototype.toString.call(o) === '[object Object]';
  }
  function hasDangerousKey(o) {
    var seen = new WeakSet(), pending = [o], count = 0;
    while (pending.length) {
      var node = pending.pop();
      if (!isPlainObject(node) && !Array.isArray(node)) continue;
      // Settings never need YAML aliases. Reject cycles and shared references,
      // rather than later expanding them with dump(noRefs:true).
      if (seen.has(node) || ++count > 10000) return true;
      seen.add(node);
      var names = Object.getOwnPropertyNames(node);
      for (var i = 0; i < names.length; i++) {
        if (DANGEROUS.indexOf(names[i]) !== -1) return true;
        pending.push(node[names[i]]);
      }
    }
    return false;
  }
  function mkError(code, message, cause) {
    var e = new Error(message); e.code = code; if (cause) e.cause = cause; return e;
  }

  function detectImageType(bytes) {
    if (!bytes || bytes.length < 3) return null;
    var b = bytes;
    if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
        b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
    if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
        b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
    return null;
  }

  function fitSize(w, h, max) {
    if (!(w > 0) || !(h > 0)) return { width: 0, height: 0 };
    var s = Math.min(1, max / Math.max(w, h));
    return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
  }

  function validateLogo(logo) {
    if (logo === null || logo === undefined) return null;
    if (typeof logo !== 'string') return 'Logo geçersiz.';
    if (logo.length > MAX_LOGO_URI_CHARS) return 'Logo çok büyük.';
    var m = LOGO_RE.exec(logo);
    if (!m || m[2].length % 4 !== 0) return 'Logo yalnızca PNG, JPEG veya WebP data URI olabilir.';
    var head;
    try {
      var bin = atob(m[2].slice(0, 16));
      head = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) head[i] = bin.charCodeAt(i);
    } catch (e) { return 'Logo çözülemedi.'; }
    if (detectImageType(head) !== 'image/' + m[1]) return 'Logo içeriği türüyle uyuşmuyor.';
    return null;
  }

  function normalizeName(name) {
    if (typeof name !== 'string') return null;
    var n = name.normalize('NFC').trim();
    if (!n || NAME_BAD_RE.test(n)) return null;
    if (Array.from(n).length > MAX_NAME_CHARS) return null;
    return n;
  }

  /** Returns {ok, errors, config}. config contains only known, validated fields. */
  function validateConfig(raw) {
    var errors = [];
    if (!isPlainObject(raw)) return { ok: false, errors: ['Ayarlar bir nesne olmalı.'], config: null };
    if (Object.getOwnPropertyNames(raw).some(function (k) { return DANGEROUS.indexOf(k) !== -1; }) ||
        hasDangerousKey(raw.organization) || hasDangerousKey(raw.appearance)) {
      return { ok: false, errors: ['Ayarlarda yasaklı anahtar var.'], config: null };
    }
    if (raw.schema !== SCHEMA) errors.push('Desteklenmeyen şema sürümü.');
    var org = raw.organization, app = raw.appearance;
    var name = null, logo = null;
    if (!isPlainObject(org)) errors.push('organization eksik.');
    else {
      name = normalizeName(org.name);
      if (name === null) errors.push('Kurum adı 1-' + MAX_NAME_CHARS + ' karakter olmalı ve kontrol karakteri içermemeli.');
      var le = validateLogo(org.logo);
      if (le) errors.push(le); else logo = org.logo || null;
    }
    if (!isPlainObject(app)) errors.push('appearance eksik.');
    else {
      if (PALETTES.indexOf(app.palette) === -1) errors.push('Geçersiz renk paleti.');
      if (MODES.indexOf(app.mode) === -1) errors.push('Geçersiz tema.');
    }
    if (errors.length) return { ok: false, errors: errors, config: null };
    return {
      ok: true, errors: [],
      config: {
        schema: SCHEMA,
        organization: { name: name, logo: logo },
        appearance: { palette: app.palette, mode: app.mode },
      },
    };
  }

  function yaml() {
    if (typeof jsyaml !== 'undefined') return jsyaml;
    if (root && root.jsyaml) return root.jsyaml;
    throw mkError('NO_YAML', 'js-yaml yüklenemedi.');
  }

  function serializeSettings(config, extras) {
    var v = validateConfig(config);
    if (!v.ok) throw mkError('BRANDING_INVALID', 'Geçersiz ayar: ' + v.errors.join(' '));
    var doc = { schema: v.config.schema, organization: v.config.organization, appearance: v.config.appearance };
    if (isPlainObject(extras)) {
      if (hasDangerousKey(extras)) throw mkError('BRANDING_INVALID', 'Ek ayarlarda yasaklı anahtar var.');
      Object.keys(extras).forEach(function (k) { if (KNOWN_TOP.indexOf(k) === -1) doc[k] = extras[k]; });
    }
    var body = yaml().dump(doc, { lineWidth: -1, noRefs: true });
    return '---\n' + body.replace(/\n+$/, '') + '\n---\n\n# Kurum ayarları\n\n' +
      'Bu dosya Proje Takip Uygulaması tarafından yönetilir.\n';
  }

  /** Returns {ok, errors, config, extras}. */
  function parseSettings(text) {
    if (typeof text !== 'string') return { ok: false, errors: ['Dosya okunamadı.'], config: null, extras: {} };
    if (text.length > 1500000) return {ok:false,errors:['Ayar dosyası çok büyük.'],config:null,extras:{}};
    var t = text.replace(/^\uFEFF/, '');
    var m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(t);
    if (!m) return { ok: false, errors: ['YAML başlığı bulunamadı.'], config: null, extras: {} };
    var doc;
    try { doc = yaml().load(m[1]); }
    catch (e) { return { ok: false, errors: ['YAML okunamadı: ' + (e && e.message ? e.message : e)], config: null, extras: {} }; }
    if (hasDangerousKey(doc)) return { ok: false, errors: ['Ayarlarda yasaklı anahtar var.'], config: null, extras: {} };
    var v = validateConfig(doc);
    if (!v.ok) return { ok: false, errors: v.errors, config: null, extras: {} };
    var extras = {};
    Object.keys(doc).forEach(function (k) { if (KNOWN_TOP.indexOf(k) === -1) extras[k] = doc[k]; });
    return { ok: true, errors: [], config: v.config, extras: extras };
  }

  // ───────────────────────── draft cache (localStorage, explicit errors) ─────────────────────────
  function cacheWrite(cfg) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cfg)); state.cacheError = null; }
    catch (e) { state.cacheError = 'Taslak tarayıcı önbelleğine yazılamadı: ' + (e && e.message ? e.message : e); }
  }
  function cacheClear() {
    try { localStorage.removeItem(CACHE_KEY); }
    catch (e) { state.cacheError = 'Taslak önbelleği temizlenemedi: ' + (e && e.message ? e.message : e); }
  }
  function cacheRead() {
    var s;
    try { s = localStorage.getItem(CACHE_KEY); }
    catch (e) { state.cacheError = 'Taslak önbelleği okunamadı: ' + (e && e.message ? e.message : e); return null; }
    if (!s) return null;
    try {
      var v = validateConfig(JSON.parse(s));
      if (v.ok) return v.config;
      cacheClear();
      state.cacheError = 'Önbellekteki taslak geçersizdi, atıldı.';
    } catch (e) { cacheClear(); state.cacheError = 'Önbellekteki taslak bozuktu, atıldı.'; }
    return null;
  }

  // ───────────────────────── state transitions ─────────────────────────
  function setConfig(cfg, persisted) {
    state.config = cfg; state.persisted = !!persisted;
    applyToDocument();
  }
  function resetConfig() { setConfig(null, false); }

  /** Sets an unpersisted (draft) config. Throws if invalid. */
  function setDraft(raw) {
    var v = validateConfig(raw);
    if (!v.ok) throw mkError('BRANDING_INVALID', 'Geçersiz ayar: ' + v.errors.join(' '));
    setConfig(v.config, false);
    cacheWrite(v.config);
    return v.config;
  }

  function getState() {
    return {
      configured: !!state.config, persisted: state.persisted,
      config: state.config ? JSON.parse(JSON.stringify(state.config)) : null,
      cacheError: state.cacheError, hasDirectory: !!state.dir,
    };
  }

  function snapshot() {
    return {config:state.config?JSON.parse(JSON.stringify(state.config)):null,
      persisted:state.persisted,dir:state.dir,deferred:state.deferred};
  }
  function restore(previous) {
    state.dir=previous.dir;
    state.deferred=previous.deferred;
    if(previous.config || previous.dir) { closeDialog(); state.afterMissing=false; }
    setConfig(previous.config,previous.persisted);
  }

  // ───────────────────────── directory I/O ─────────────────────────
  function isNotFound(e) { return !!e && (e.name === 'NotFoundError' || e.code === 8); }

  /** Returns file text or null when .tracker or settings.md does not exist. Other errors propagate. */
  async function readSettingsText(handle) {
    var tdir;
    try { tdir = await handle.getDirectoryHandle(SETTINGS_DIR); }
    catch (e) { if (isNotFound(e)) return null; throw e; }
    var fh;
    try { fh = await tdir.getFileHandle(SETTINGS_FILE); }
    catch (e) { if (isNotFound(e)) return null; throw e; }
    return await (await fh.getFile()).text();
  }

  async function persistToDirectory(handle) {
    if (!handle) throw mkError('NO_DIR', 'Klasör seçilmedi.');
    if (!state.config) throw mkError('NOT_CONFIGURED', 'Kaydedilecek kurum ayarı yok.');
    var cfg = state.config;
    var existing = await readSettingsText(handle);
    var extras = {};
    if (existing !== null) {
      var p = parseSettings(existing);
      if (!p.ok) throw mkError('BRANDING_INVALID', 'Mevcut ' + SETTINGS_DIR + '/' + SETTINGS_FILE +
        ' geçersiz, üzerine yazılmadı: ' + p.errors.join(' '));
      extras = p.extras;
    }
    var text = serializeSettings(cfg, extras);
    if (existing === text) {          // already identical on disk: nothing to overwrite
      state.dir = handle;
      if (state.config === cfg) { state.persisted = true; cacheClear(); }
      return true;
    }
    var tdir = await handle.getDirectoryHandle(SETTINGS_DIR, { create: true });
    var fh = await tdir.getFileHandle(SETTINGS_FILE, { create: true });
    var w = await fh.createWritable();
    try { await w.write(text); await w.close(); }
    catch (e) { try { if (w.abort) await w.abort(); } catch (_) { /* original error matters */ } throw e; }
    var back = await readSettingsText(handle);
    if (back !== text) throw mkError('VERIFY_FAILED', 'Ayar dosyası yazıldı ancak doğrulanamadı.');
    state.dir = handle;
    if (state.config === cfg) { state.persisted = true; cacheClear(); }
    return true;
  }

  async function loadFromDirectory(handle) {
    if (!handle) throw mkError('NO_DIR', 'Klasör seçilmedi.');
    state.dir = handle;
    state.deferred = false;
    var text;
    try { text = await readSettingsText(handle); }
    catch (e) { state.dir = null; resetConfig(); throw mkError('BRANDING_READ', 'Kurum ayarları okunamadı: ' + (e && e.message ? e.message : e), e); }
    if (text !== null) {
      var p = parseSettings(text);
      if (!p.ok) {
        state.dir = null; resetConfig();
        throw mkError('BRANDING_INVALID', SETTINGS_DIR + '/' + SETTINGS_FILE + ' geçersiz: ' + p.errors.join(' '));
      }
      setConfig(p.config, true);
      cacheClear();
      return { status: 'loaded', config: getState().config };
    }
    if (state.config && !state.persisted) {          // explicit new draft → save into this workspace
      try { await persistToDirectory(handle); }
      catch (e) { throw mkError('BRANDING_WRITE', 'Kurum ayarları kaydedilemedi: ' + (e && e.message ? e.message : e), e); }
      return { status: 'saved', config: getState().config };
    }
    state.dir = null; resetConfig();                 // never leak previous workspace's identity
    state.afterMissing = true;
    if (hasDoc()) open();
    throw mkError('BRANDING_MISSING', 'Bu klasörde kurum ayarı yok. Kurulumu tamamlayıp Klasör Aç’a yeniden tıklayın.');
  }

  // ───────────────────────── logo processing (browser) ─────────────────────────
  async function processLogoFile(file) {
    if (!file) throw new Error('Dosya seçilmedi.');
    if (file.size > MAX_LOGO_BYTES) throw new Error('Logo en fazla 2 MB olabilir.');
    if (file.size === 0) throw new Error('Dosya boş.');
    var head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (!detectImageType(head)) throw new Error('Yalnızca PNG, JPEG veya WebP yüklenebilir (SVG desteklenmez).');
    var src, w, h, cleanup = function () {};
    try {
      if (typeof createImageBitmap === 'function') {
        src = await createImageBitmap(file); w = src.width; h = src.height;
        cleanup = function () { if (src.close) src.close(); };
      } else throw new Error('fallback');
    } catch (_) {
      var url = URL.createObjectURL(file);
      try {
        src = await new Promise(function (res, rej) {
          var im = new Image(); im.onload = function () { res(im); };
          im.onerror = function () { rej(new Error('Görsel çözülemedi.')); }; im.src = url;
        });
      } catch (e) { URL.revokeObjectURL(url); throw new Error('Görsel çözülemedi; dosya bozuk olabilir.'); }
      w = src.naturalWidth; h = src.naturalHeight;
      cleanup = function () { URL.revokeObjectURL(url); };
    }
    try {
      if (!w || !h) throw new Error('Görsel boyutu okunamadı.');
      if (w * h > MAX_SOURCE_PIXELS) throw new Error('Görsel çözünürlüğü çok yüksek.');
      var dims = [MAX_LOGO_DIM, 128, 64];
      for (var i = 0; i < dims.length; i++) {
        var sz = fitSize(w, h, dims[i]);
        var cv = document.createElement('canvas'); cv.width = sz.width; cv.height = sz.height;
        var ctx = cv.getContext('2d');
        if (!ctx) throw new Error('Canvas kullanılamıyor.');
        ctx.drawImage(src, 0, 0, sz.width, sz.height);
        var uri = cv.toDataURL('image/png');
        if (!validateLogo(uri)) return uri;
      }
      throw new Error('Logo yeniden boyutlandırıldıktan sonra bile çok büyük.');
    } finally { cleanup(); }
  }

  // ───────────────────────── apply to document ─────────────────────────
  function hasDoc() { return typeof document !== 'undefined' && !!document.body; }

  function resolveTheme(mode) {
    if (mode === 'light' || mode === 'dark') return mode;
    try { return root.matchMedia && root.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; }
    catch (_) { return 'dark'; }
  }

  function captureOriginals() {
    if (state.originals || !hasDoc()) return;
    var cloneKids = function (el) { return Array.prototype.map.call(el.childNodes, function (n) { return n.cloneNode(true); }); };
    var h1 = document.querySelector('#welcome h1');
    state.originals = {
      title: document.title,
      h1: h1 ? h1.textContent : null,
      logos: Array.prototype.map.call(document.querySelectorAll('.logo'), function (el) { return { el: el, kids: cloneKids(el) }; }),
      icons: Array.prototype.map.call(document.querySelectorAll('.logo-icon'), function (el) { return { el: el, kids: cloneKids(el) }; }),
    };
  }
  function restoreKids(rec) {
    while (rec.el.firstChild) rec.el.removeChild(rec.el.firstChild);
    rec.kids.forEach(function (n) { rec.el.appendChild(n.cloneNode(true)); });
  }

  function applyToDocument() {
    if (!hasDoc()) return;
    captureOriginals();
    var o = state.originals, de = document.documentElement, cfg = state.config;
    if (!cfg) {
      de.removeAttribute('data-brand-palette'); de.removeAttribute('data-brand-theme');
      if (o) {
        document.title = o.title;
        var h1 = document.querySelector('#welcome h1'); if (h1 && o.h1 !== null) h1.textContent = o.h1;
        o.logos.forEach(restoreKids); o.icons.forEach(restoreKids);
      }
      return;
    }
    var name = cfg.organization.name;
    de.setAttribute('data-brand-palette', cfg.appearance.palette);
    de.setAttribute('data-brand-theme', resolveTheme(cfg.appearance.mode));
    document.title = name + APP_SUFFIX;
    var h = document.querySelector('#welcome h1'); if (h) h.textContent = name + APP_SUFFIX;
    if (o) o.logos.forEach(function (rec) {
      while (rec.el.firstChild) rec.el.removeChild(rec.el.firstChild);
      var s = document.createElement('span'); s.textContent = name;
      rec.el.appendChild(s); rec.el.appendChild(document.createTextNode(APP_SUFFIX));
    });
    if (o) o.icons.forEach(function (rec) {
      if (cfg.organization.logo) {
        while (rec.el.firstChild) rec.el.removeChild(rec.el.firstChild);
        var im = document.createElement('img');
        im.className = 'brand-logo-img'; im.alt = ''; im.decoding = 'async';
        im.src = cfg.organization.logo; rec.el.appendChild(im);
      } else {
        rec.el.textContent = name.split(/\s+/).slice(0,2).map(function(s){return Array.from(s)[0];}).join('').toLocaleUpperCase('tr');
      }
    });
  }

  // ───────────────────────── UI ─────────────────────────
  var ui = null;   // {dlg, ...}
  var uiSeq = 0;

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function card(no, title, kids) {
    var lg = el('legend', { 'class': 'brand-legend' }, [
      el('span', { 'class': 'brand-step-no', 'aria-hidden': 'true', text: String(no) }),
      el('span', { text: title }),
    ]);
    return el('fieldset', { 'class': 'brand-card' }, [lg].concat(kids));
  }
  function choice(group, value, label) {
    var inp = el('input', { type: 'radio', name: 'brand-' + group, value: value });
    var sw = group === 'palette' ? el('span', { 'class': 'brand-swatch', 'data-swatch': value, 'aria-hidden': 'true' }) : null;
    return el('label', { 'class': 'brand-choice' }, [inp, sw, el('span', { text: label })]);
  }

  function buildUI() {
    var f = {};
    f.name = el('input', { id: 'brand-name', 'class': 'brand-input', type: 'text', required: 'required',
      maxlength: String(MAX_NAME_CHARS), autocomplete: 'organization', 'aria-describedby': 'brand-name-err brand-name-hint' });
    f.nameErr = el('p', { id: 'brand-name-err', 'class': 'brand-error', role: 'alert' });
    f.file = el('input', { id: 'brand-file', 'class': 'brand-file', type: 'file',
      accept: 'image/png,image/jpeg,image/webp', 'aria-describedby': 'brand-logo-hint brand-logo-err' });
    f.filePick = el('button', {type:'button', 'class':'brand-btn', text:'Logo seç'});
    f.fileName = el('span', {'class':'brand-file-name', text:'Dosya seçilmedi'});
    f.filePick.addEventListener('click',function(){f.file.click();});
    f.logoRemove = el('button', { type: 'button', 'class': 'brand-btn', text: 'Logoyu kaldır' });
    f.logoErr = el('p', { id: 'brand-logo-err', 'class': 'brand-error', role: 'alert' });
    f.logoThumb = el('div', { 'class': 'brand-logo-thumb', 'aria-hidden': 'true' });

    var palette = el('div', { 'class': 'brand-choices', role: 'radiogroup', 'aria-labelledby': 'brand-palette-lbl' },
      PALETTES.map(function (p) { return choice('palette', p, PALETTE_LABELS[p]); }));
    var modes = el('div', { 'class': 'brand-choices', role: 'radiogroup', 'aria-labelledby': 'brand-mode-lbl' },
      MODES.map(function (m) { return choice('mode', m, MODE_LABELS[m]); }));

    var steps = el('div', { 'class': 'brand-steps' }, [
      card(1, 'Kurum adı', [
        el('label', { 'class': 'brand-label', 'for': 'brand-name', text: 'Kurumunuzun adı (zorunlu)' }),
        f.name,
        el('p', { id: 'brand-name-hint', 'class': 'brand-hint', text: 'En fazla ' + MAX_NAME_CHARS + ' karakter. Başlıkta ve ana ekranda görünür.' }),
        f.nameErr,
      ]),
      card(2, 'Logo (isteğe bağlı)', [
        el('label', { 'class': 'brand-label', 'for': 'brand-file', text: 'PNG, JPEG veya WebP dosyası' }),
        el('div', { 'class': 'brand-logo-row' }, [f.logoThumb, f.filePick, f.fileName, f.file]),
        el('p', { id: 'brand-logo-hint', 'class': 'brand-hint', text: 'En fazla 2 MB. SVG desteklenmez. Görsel tarayıcıda küçültülür.' }),
        f.logoRemove, f.logoErr,
      ]),
      card(3, 'Görünüm', [
        el('p', { id: 'brand-palette-lbl', 'class': 'brand-label', text: 'Renk paleti' }), palette,
        el('p', { id: 'brand-mode-lbl', 'class': 'brand-label', text: 'Tema' }), modes,
      ]),
    ]);

    f.pvName = el('span', { 'class': 'brand-pv-name' });
    f.pvIcon = el('span', { 'class': 'brand-pv-icon', 'aria-hidden': 'true' });
    f.preview = el('div', { 'class': 'brand-preview', 'aria-hidden': 'true' }, [
      el('div', { 'class': 'brand-pv-header' }, [f.pvIcon, f.pvName]),
      el('div', { 'class': 'brand-pv-body' }, [
        el('div', { 'class': 'brand-pv-card' }, [
          el('span', { 'class': 'brand-pv-line' }), el('span', { 'class': 'brand-pv-line brand-pv-short' }),
          el('span', { 'class': 'brand-pv-btn', text: 'Yeni Görev' }),
        ]),
      ]),
    ]);
    var side = el('section', { 'class': 'brand-side', 'aria-labelledby': 'brand-pv-title' }, [
      el('h3', { id: 'brand-pv-title', 'class': 'brand-h3', text: 'Canlı önizleme' }), f.preview,
    ]);

    f.status = el('p', { 'class': 'brand-status', role: 'status', 'aria-live': 'polite' });
    f.cancel = el('button', { type: 'button', 'class': 'brand-btn', text: 'İptal' });
    f.skip = el('button', { type: 'button', 'class': 'brand-btn', text: 'Klasörümde ayar zaten var' });
    f.save = el('button', { type: 'submit', 'class': 'brand-btn brand-btn-primary', text: 'Kaydet ve devam et' });
    f.title = el('h2', { id: 'brand-title', 'class': 'brand-h2' });
    f.desc = el('p', { id: 'brand-desc', 'class': 'brand-hint' });
    f.close = el('button', { type: 'button', 'class': 'brand-x', 'aria-label': 'Kapat', text: '×' });

    f.form = el('form', { 'class': 'brand-form', novalidate: 'novalidate' }, [
      el('div', { 'class': 'brand-head' }, [el('div', null, [f.title, f.desc]), f.close]),
      el('div', { 'class': 'brand-grid' }, [steps, side]),
      f.status,
      el('div', { 'class': 'brand-actions' }, [f.skip, f.cancel, f.save]),
    ]);
    f.dlg = el('dialog', { id: 'branding-dialog', 'class': 'brand-dialog', 'aria-labelledby': 'brand-title', 'aria-describedby': 'brand-desc' }, [f.form]);
    document.body.appendChild(f.dlg);

    f.mode = 'onboarding'; f.logo = null; f.busy = false; f.returnFocus = null;
    f.dlg.addEventListener('cancel', function (ev) { if (f.mode === 'onboarding' && !state.afterMissing) ev.preventDefault(); });
    f.dlg.addEventListener('close', function () { try { if (f.returnFocus && f.returnFocus.focus) f.returnFocus.focus(); } catch (_) {} });
    f.close.addEventListener('click', function () { closeDialog(); });
    f.cancel.addEventListener('click', function () { closeDialog(); });
    f.skip.addEventListener('click', function () { state.deferred = true; closeDialog(); });
    f.form.addEventListener('input', function () { updatePreview(); });
    f.form.addEventListener('change', function () { updatePreview(); });
    f.logoRemove.addEventListener('click', function () { f.logo = null; f.file.value = ''; f.fileName.textContent='Dosya seçilmedi'; f.logoErr.textContent = ''; updatePreview(); });
    f.file.addEventListener('change', onFile);
    f.form.addEventListener('submit', function (ev) { ev.preventDefault(); onSubmit(); });
    return f;
  }

  function radioVal(group) {
    var r = ui.form.querySelector('input[name="brand-' + group + '"]:checked'); return r ? r.value : null;
  }
  function setRadio(group, value) {
    Array.prototype.forEach.call(ui.form.querySelectorAll('input[name="brand-' + group + '"]'), function (r) { r.checked = r.value === value; });
  }

  function paintLogo(host, uri) {
    while (host.firstChild) host.removeChild(host.firstChild);
    if (uri) { var im = el('img', { 'class': 'brand-logo-img', alt: '' }); im.src = uri; host.appendChild(im); }
  }

  function updatePreview() {
    var name = ui.name.value.trim();
    ui.pvName.textContent = (name || 'Kurum adınız') + APP_SUFFIX;
    ui.preview.setAttribute('data-brand-palette', radioVal('palette') || 'blue');
    ui.preview.setAttribute('data-brand-theme', resolveTheme(radioVal('mode') || 'system'));
    paintLogo(ui.pvIcon, ui.logo); paintLogo(ui.logoThumb, ui.logo);
    ui.logoRemove.hidden = !ui.logo;
  }

  async function onFile() {
    var file = ui.file.files && ui.file.files[0];
    ui.logoErr.textContent = '';
    if (!file) return;
    var my = ++uiSeq;
    ui.status.textContent = 'Logo işleniyor…';
    try {
      var uri = await processLogoFile(file);
      if (my !== uiSeq) return;
      ui.logo = uri; ui.fileName.textContent=file.name; ui.status.textContent = 'Logo hazır.';
    } catch (e) {
      if (my !== uiSeq) return;
      ui.file.value = ''; ui.logoErr.textContent = e.message || 'Logo yüklenemedi.'; ui.status.textContent = '';
    }
    updatePreview();
  }

  function setBusy(b) { ui.busy = b; ui.save.disabled = b; }

  async function onSubmit() {
    if (ui.busy) return;
    ui.nameErr.textContent = ''; ui.status.textContent = '';
    var name = normalizeName(ui.name.value);
    if (name === null) {
      ui.nameErr.textContent = ui.name.value.trim()
        ? 'Kurum adı en fazla ' + MAX_NAME_CHARS + ' karakter olmalı ve özel kontrol karakteri içermemeli.'
        : 'Kurum adı zorunludur.';
      ui.name.setAttribute('aria-invalid', 'true'); ui.name.focus(); return;
    }
    ui.name.removeAttribute('aria-invalid');
    var v = validateConfig({
      schema: SCHEMA, organization: { name: name, logo: ui.logo },
      appearance: { palette: radioVal('palette') || 'blue', mode: radioVal('mode') || 'system' },
    });
    if (!v.ok) { ui.status.textContent = v.errors.join(' '); return; }
    var wasOnboarding = ui.mode === 'onboarding';
    var prev = { config: state.config, persisted: state.persisted };
    if (state.dir) {
      setBusy(true); ui.status.textContent = 'Kaydediliyor…';
      setConfig(v.config, false);
      try { await persistToDirectory(state.dir); }
      catch (e) {
        setConfig(prev.config, prev.persisted);
        ui.status.textContent = 'Kaydedilemedi: ' + (e && e.message ? e.message : e);
        setBusy(false); return;
      }
      setBusy(false);
    } else {
      setConfig(v.config, false); cacheWrite(v.config);
    }
    closeDialog();
    emit('branding:changed');
    state.afterMissing = false;
    if (wasOnboarding) emit('branding:ready');
  }

  function emit(type) {
    try {
      var s = getState();
      document.dispatchEvent(new CustomEvent(type, { detail: {
        organization: s.config ? s.config.organization.name : null,
        persisted: s.persisted, hasDirectory: s.hasDirectory, cacheError: s.cacheError } }));
    } catch (e) { /* CustomEvent unavailable: parent still gets return values */ }
  }

  function closeDialog() {
    if (!ui) return;
    uiSeq++;
    if (ui.dlg.open) ui.dlg.close();
    else ui.dlg.removeAttribute('open');
  }

  function open() {
    if (!hasDoc()) return false;
    if (!ui) ui = buildUI();
    var cfg = state.config;
    ui.mode = cfg ? 'settings' : 'onboarding';
    ui.returnFocus = document.activeElement;
    ui.title.textContent = cfg ? 'Kurum ve görünüm ayarları' : 'Önce kurumunuzu tanıtın';
    ui.desc.textContent = cfg
      ? 'Ad, logo ve renkleri değiştirin. Ayarlar çalışma klasörünüzde saklanır.'
      : (state.afterMissing ? 'Seçtiğiniz klasörde kurum ayarı yok. Üç kısa adımı tamamlayıp Klasör Aç’a yeniden tıklayın.' : 'Üç kısa adım. Bitince Klasör Aç’a tıklayın.');
    var pre = cfg || state.prefill;
    ui.name.value = pre ? pre.organization.name : '';
    ui.logo = cfg ? cfg.organization.logo : null;
    ui.file.value = ''; ui.fileName.textContent=ui.logo?'Kayıtlı logo':'Dosya seçilmedi'; ui.nameErr.textContent = ''; ui.logoErr.textContent = '';
    ui.name.removeAttribute('aria-invalid');
    ui.status.textContent = state.cacheError ? 'Uyarı: ' + state.cacheError : '';
    setRadio('palette', pre ? pre.appearance.palette : 'blue');
    setRadio('mode', pre ? pre.appearance.mode : 'system');
    ui.close.hidden = ui.cancel.hidden = !cfg && !state.afterMissing;
    ui.skip.hidden = !!cfg || !!state.dir || state.afterMissing;
    ui.save.textContent = cfg ? 'Kaydet' : 'Kaydet ve devam et';
    setBusy(false);
    updatePreview();
    if (!ui.dlg.open) {
      if (typeof ui.dlg.showModal === 'function') ui.dlg.showModal(); else ui.dlg.setAttribute('open', '');
    }
    ui.name.focus();
    return true;
  }

  function ensureBeforePick() {
    if (state.config || state.deferred) return true;
    open();
    return false;
  }

  function init() {
    if (state.initialized) return;
    state.initialized = true;
    if (hasDoc()) captureOriginals();
    state.prefill = cacheRead();
    applyToDocument();
    try {
      if (root.matchMedia) {
        state.mqList = root.matchMedia('(prefers-color-scheme: light)');
        var h = function () { if (state.config && state.config.appearance.mode === 'system') applyToDocument(); };
        if (state.mqList.addEventListener) state.mqList.addEventListener('change', h);
      }
    } catch (e) { state.cacheError = state.cacheError || ('Sistem teması izlenemedi: ' + e.message); }
  }

  root.Branding = {
    init: init, open: open, ensureBeforePick: ensureBeforePick, snapshot:snapshot, restore:restore,
    loadFromDirectory: loadFromDirectory, persistToDirectory: persistToDirectory,
    validateConfig: validateConfig, parseSettings: parseSettings, serializeSettings: serializeSettings,
    setDraft: setDraft, getState: getState, detectImageType: detectImageType, fitSize: fitSize,
    processLogoFile: processLogoFile,
    PALETTES: PALETTES, MODES: MODES, MAX_LOGO_BYTES: MAX_LOGO_BYTES,
  };
})(typeof window !== 'undefined' ? window : globalThis);
