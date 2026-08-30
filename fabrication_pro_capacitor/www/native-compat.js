/*
 * Fabri-Cadabra — Capacitor native compatibility layer
 *
 * Purpose: make the existing Blob + <a download> JSON exports reliable inside
 * native iOS/Android WebViews without changing existing application data,
 * calculations, validation, import formats, timer behavior, or export payloads.
 *
 * Also loads the approved Fabri-Cadabra UI enhancement layer in both browser
 * and native builds while leaving the preserved original HTML untouched.
 */
(() => {
  'use strict';

  const cap = window.Capacitor;
  const isNative = !!(cap && (
    (typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) ||
    (typeof cap.getPlatform === 'function' && cap.getPlatform() !== 'web')
  ));
  if (!isNative) return;

  const plugins = cap.Plugins || {};
  const Filesystem = plugins.Filesystem;
  const Share = plugins.Share;
  if (!Filesystem || !Share) {
    console.warn('[Fabri-Cadabra] Native export bridge unavailable; browser download behavior will be used.');
    return;
  }

  const blobByUrl = new Map();
  const createObjectURL = URL.createObjectURL.bind(URL);
  const revokeObjectURL = URL.revokeObjectURL.bind(URL);
  const anchorClick = HTMLAnchorElement.prototype.click;

  URL.createObjectURL = function(object) {
    const url = createObjectURL(object);
    if (object instanceof Blob) blobByUrl.set(url, object);
    return url;
  };

  URL.revokeObjectURL = function(url) {
    blobByUrl.delete(String(url));
    return revokeObjectURL(url);
  };

  function safeFilename(value) {
    const name = String(value || 'Fabrication-Export.json')
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
      .replace(/^\.+/, '')
      .trim();
    return name || 'Fabrication-Export.json';
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const value = String(reader.result || '');
        const comma = value.indexOf(',');
        if (comma < 0) reject(new Error('Unable to encode export file.'));
        else resolve(value.slice(comma + 1));
      };
      reader.onerror = () => reject(reader.error || new Error('Unable to read export file.'));
      reader.readAsDataURL(blob);
    });
  }

  async function nativeExport(blob, filename) {
    const data = await blobToBase64(blob);
    const path = safeFilename(filename);

    await Filesystem.writeFile({
      path,
      data,
      directory: 'CACHE',
    });

    const result = await Filesystem.getUri({
      path,
      directory: 'CACHE'
    });

    await Share.share({
      title: path,
      files: [result.uri],
      dialogTitle: 'Export Fabrication JSON'
    });
  }

  HTMLAnchorElement.prototype.click = function() {
    const href = String(this.href || '');
    const filename = this.download;
    const blob = filename && href.startsWith('blob:') ? blobByUrl.get(href) : null;

    if (!blob) return anchorClick.call(this);

    nativeExport(blob, filename).catch(error => {
      console.error('[Fabri-Cadabra] Native JSON export failed; falling back to WebView download behavior.', error);
      try { anchorClick.call(this); } catch (fallbackError) {
        console.error('[Fabri-Cadabra] WebView fallback export also failed.', fallbackError);
      }
    });
  };
})();
