/* SECTION: idb —— IndexedDB 封装：状态镜像、打卡凭证图片、自动备份。localStorage 之外的兜底大容量存储。
   Node 环境（无 IDB）下 available=false，core 会自动降级，不报错。 */
'use strict';
const TTIDB = (() => {
  const DB_NAME = 'rike-db';
  const DB_VER = 1;
  const STORE_STATE = 'state';     // key: 主键 -> 完整 state 镜像
  const STORE_ATTACH = 'attach';   // key: attachId -> { id, data(dataURL), name, ts }
  const STORE_BACKUP = 'backup';   // key: backupId -> { id, ts, label, size, data }
  const hasIDB = typeof indexedDB !== 'undefined';
  let dbPromise = null;

  const open = () => {
    if (!hasIDB) return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      let req;
      try { req = indexedDB.open(DB_NAME, DB_VER); }
      catch (e) { resolve(null); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_STATE)) db.createObjectStore(STORE_STATE);
        if (!db.objectStoreNames.contains(STORE_ATTACH)) db.createObjectStore(STORE_ATTACH, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORE_BACKUP)) db.createObjectStore(STORE_BACKUP, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    return dbPromise;
  };

  const tx = async (store, mode, fn) => {
    const db = await open();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const t = db.transaction(store, mode);
        const os = t.objectStore(store);
        const out = fn(os);
        let settled = false;
        t.oncomplete = () => { if (!settled) { settled = true; resolve(out && out.__val !== undefined ? out.__val : out); } };
        t.onerror = () => { settled = true; resolve(null); };
        t.onabort = () => { settled = true; resolve(null); };
      } catch (e) { resolve(null); }
    });
  };
  const reqVal = req => new Promise(resolve => {
    if (!req) { resolve(null); return; }
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });

  /* ---- 状态镜像 ---- */
  const putState = (key, obj) => tx(STORE_STATE, 'readwrite', os => os.put(obj, key));
  const getState = key => tx(STORE_STATE, 'readonly', os => { const r = os.get(key); r.__pending = reqVal(r); return r.__pending; }).then(v => v);

  /* ---- 凭证附件（dataURL） ---- */
  const putAttach = (id, data, name) => tx(STORE_ATTACH, 'readwrite', os => os.put({ id, data, name: name || '', ts: Date.now() }));
  const getAttach = id => tx(STORE_ATTACH, 'readonly', os => reqVal(os.get(id)));
  const deleteAttach = id => tx(STORE_ATTACH, 'readwrite', os => os.delete(id));
  const allAttach = () => tx(STORE_ATTACH, 'readonly', os => reqVal(os.getAll()));

  /* ---- 备份 ---- */
  const putBackup = (id, rec) => tx(STORE_BACKUP, 'readwrite', os => os.put(Object.assign({ id }, rec)));
  const listBackups = () => tx(STORE_BACKUP, 'readonly', os => reqVal(os.getAll()).then(a => (a || []).map(x => ({ id: x.id, ts: x.ts, label: x.label, size: x.size }))));
  const getBackup = id => tx(STORE_BACKUP, 'readonly', os => reqVal(os.get(id)));
  const deleteBackup = id => tx(STORE_BACKUP, 'readwrite', os => os.delete(id));

  const ready = () => open().then(db => !!db);

  return {
    get available() { return hasIDB; },
    ready, putState, getState,
    putAttach, getAttach, deleteAttach, allAttach,
    putBackup, listBackups, getBackup, deleteBackup
  };
})();
window.TTIDB = TTIDB;
