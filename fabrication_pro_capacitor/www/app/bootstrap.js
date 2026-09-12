  const FABRI_CADABRA_VERSION='1.0.5'; // @generated from package.json by scripts/sync-app-version.mjs

  // ---------------- Shared helpers ----------------
  function gcd(a,b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { const t = b; b = a % b; a = t; }
    return a;
  }

  function trimZeros(n,maxDecimals=6) {
    return Number(n.toFixed(maxDecimals)).toString();
  }


  async function requireRecoverySnapshot(reason) {
    const service=window.FabriCadabraRecovery;
    if (!service || typeof service.create!=='function') {
      throw new Error('Automatic recovery protection is unavailable. Create a manual Fabri-Cadabra backup before retrying.');
    }
    await service.create(reason);
  }


  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

