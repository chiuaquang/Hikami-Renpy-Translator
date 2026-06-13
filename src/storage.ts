import { nowIso } from './utils';

const DB_NAME = 'vntranslator_prenpy';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('files')) {
        const s = db.createObjectStore('files', { keyPath: 'key' });
        s.createIndex('byProject', 'projectId', { unique: false });
      }

      if (!db.objectStoreNames.contains('tm')) {
        const s = db.createObjectStore('tm', { keyPath: 'key' });
        s.createIndex('byTarget', 'target', { unique: false });
        s.createIndex('byUpdated', 'updatedAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const Store = {
  async loadProject(projectId: string): Promise<{ project: any; files: any[] }> {
    const db = await openDb();
    const tx = db.transaction(['projects', 'files'], 'readonly');
    const pReq = tx.objectStore('projects').get(projectId);
    const files: any[] = [];
    await new Promise<void>((resolve, reject) => {
      pReq.onsuccess = () => resolve();
      pReq.onerror = () => reject(pReq.error);
    });
    const project = pReq.result || null;

    if (project) {
      const idx = tx.objectStore('files').index('byProject');
      const range = IDBKeyRange.only(projectId);
      const cursorReq = idx.openCursor(range);
      await new Promise<void>((resolve, reject) => {
        cursorReq.onerror = () => reject(cursorReq.error);
        cursorReq.onsuccess = () => {
          const c = cursorReq.result;
          if (!c) return resolve();
          files.push(c.value);
          c.continue();
        };
      });
    }

    await txDone(tx);
    db.close();
    return { project, files };
  },

  async saveProject(project: any): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(['projects'], 'readwrite');
    tx.objectStore('projects').put({ ...project, updatedAt: nowIso() });
    await txDone(tx);
    db.close();
  },

  async saveFile(projectId: string, path: string, payload: any): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(['files'], 'readwrite');
    const key = `${projectId}::${path}`;
    tx.objectStore('files').put({ key, projectId, path, ...payload, updatedAt: nowIso() });
    await txDone(tx);
    db.close();
  },

  async deleteProject(projectId: string): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(['projects', 'files'], 'readwrite');
    tx.objectStore('projects').delete(projectId);

    const idx = tx.objectStore('files').index('byProject');
    const range = IDBKeyRange.only(projectId);
    const cursorReq = idx.openCursor(range);
    await new Promise<void>((resolve, reject) => {
      cursorReq.onerror = () => reject(cursorReq.error);
      cursorReq.onsuccess = () => {
        const c = cursorReq.result;
        if (!c) return resolve();
        c.delete();
        c.continue();
      };
    });

    await txDone(tx);
    db.close();
  },

  async deleteFile(projectId: string, path: string): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(['files'], 'readwrite');
    const key = `${projectId}::${path}`;
    tx.objectStore('files').delete(key);
    await txDone(tx);
    db.close();
  },

  async tmGetMany(target: string, sourceMaskedList: string[]): Promise<Map<string, any>> {
    const keys = Array.from(new Set((sourceMaskedList || []).map(v => String(v ?? ''))));
    if (!keys.length) return new Map();

    const db = await openDb();
    const tx = db.transaction(['tm'], 'readonly');
    const store = tx.objectStore('tm');
    const out = new Map<string, any>();

    const reqs = keys.map((sourceMasked) => {
      const key = `${target}::${sourceMasked}`;
      const req = store.get(key);
      return new Promise<[string, any]>((resolve, reject) => {
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve([sourceMasked, req.result || null]);
      });
    });

    const rows = await Promise.all(reqs);
    for (const [sourceMasked, value] of rows) {
      if (value) out.set(sourceMasked, value);
    }

    await txDone(tx);
    db.close();
    return out;
  },

  async tmGet(target: string, sourceMasked: string[]): Promise<any> {
    const db = await openDb();
    const tx = db.transaction(['tm'], 'readonly');
    const key = `${target}::${sourceMasked}`;
    const req = tx.objectStore('tm').get(key);
    const value = await new Promise((resolve, reject) => {
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result || null);
    });
    await txDone(tx);
    db.close();
    return value;
  },

  async tmPut(target: string, sourceMasked: string, translation: string, meta: any = {}): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(['tm'], 'readwrite');
    const key = `${target}::${sourceMasked}`;
    const store = tx.objectStore('tm');
    const existingReq = store.get(key);
    const existing = await new Promise<any>((resolve, reject) => {
      existingReq.onerror = () => reject(existingReq.error);
      existingReq.onsuccess = () => resolve(existingReq.result || null);
    });

    const count = (existing?.count || 0) + 1;
    store.put({
      key,
      target,
      sourceMasked,
      translation: String(translation ?? ''),
      updatedAt: nowIso(),
      count,
      ...meta,
    });

    await txDone(tx);
    db.close();
  },

  async tmList(target: string, limit = 500): Promise<any[]> {
    const db = await openDb();
    const tx = db.transaction(['tm'], 'readonly');
    const idx = tx.objectStore('tm').index('byTarget');
    const range = IDBKeyRange.only(target);
    const req = idx.openCursor(range);
    const out: any[] = [];
    await new Promise<void>((resolve, reject) => {
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return resolve();
        out.push(c.value);
        if (out.length >= limit) return resolve();
        c.continue();
      };
    });
    await txDone(tx);
    db.close();
    out.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    return out;
  },

  async tmDelete(key: string): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(['tm'], 'readwrite');
    tx.objectStore('tm').delete(key);
    await txDone(tx);
    db.close();
  },

  async tmClear(target: string): Promise<void> {
    const db = await openDb();
    const tx = db.transaction(['tm'], 'readwrite');
    const store = tx.objectStore('tm');
    const idx = store.index('byTarget');
    const range = IDBKeyRange.only(target);
    const req = idx.openCursor(range);
    await new Promise<void>((resolve, reject) => {
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return resolve();
        c.delete();
        c.continue();
      };
    });
    await txDone(tx);
    db.close();
  },

  async tmExport(target: string): Promise<string> {
    const list = await Store.tmList(target, 50000);
    return JSON.stringify({ target, exportedAt: nowIso(), entries: list }, null, 2);
  },

  async tmImport(jsonText: string): Promise<number> {
    const obj = JSON.parse(String(jsonText || ''));
    const entries = Array.isArray(obj?.entries) ? obj.entries : [];
    const db = await openDb();
    const tx = db.transaction(['tm'], 'readwrite');
    const store = tx.objectStore('tm');
    for (const e of entries) {
      if (!e || typeof e.key !== 'string') continue;
      store.put({ ...e, updatedAt: nowIso() });
    }
    await txDone(tx);
    db.close();
    return entries.length;
  }
};
