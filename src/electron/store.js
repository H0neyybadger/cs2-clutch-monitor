/**
 * CS2 Clutch Mode — Lightweight JSON Settings Store
 * 
 * Persists overlay window state and preferences to a JSON file
 * in the Electron userData directory. Zero external dependencies.
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const STORE_FILE = path.join(app.getPath('userData'), 'overlay-settings.json');

const DEFAULTS = {
  window: {
    x: 20,
    y: 20,
    width: 360,
    height: 320,
  },
  prefs: {
    clickThrough: false,
    overlayVisible: true,
  },
};

let _cache = null;

function load() {
  if (_cache) return _cache;
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    // Deep merge with defaults so missing keys get filled
    _cache = {
      window: { ...DEFAULTS.window, ...parsed.window },
      prefs: { ...DEFAULTS.prefs, ...parsed.prefs },
    };
  } catch {
    _cache = JSON.parse(JSON.stringify(DEFAULTS));
    save(); // Write defaults on first run so the file always exists
  }
  return _cache;
}

function save() {
  if (!_cache) return;
  try {
    const dir = path.dirname(STORE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STORE_FILE, JSON.stringify(_cache, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Store] Failed to save settings:', err.message);
  }
}

function getWindow() {
  return load().window;
}

function setWindow(bounds) {
  load();
  _cache.window = { ..._cache.window, ...bounds };
  save();
}

function getPrefs() {
  return load().prefs;
}

function setPrefs(prefs) {
  load();
  _cache.prefs = { ..._cache.prefs, ...prefs };
  save();
}

function getStorePath() {
  return STORE_FILE;
}

module.exports = { load, save, getWindow, setWindow, getPrefs, setPrefs, getStorePath, DEFAULTS };
