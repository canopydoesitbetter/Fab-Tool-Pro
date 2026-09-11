  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function storageSet(key,value) {
    try { localStorage.setItem(key,value); } catch (e) {}
  }


