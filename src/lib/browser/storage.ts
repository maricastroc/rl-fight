/** Small wrappers around browser storage. Every call tolerates private mode and blocked storage. */

export function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage unavailable: nothing to remove.
  }
}

const DB_NAME = "kruang";
const STORE = "templates";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export type StoredTemplate = { name: string; fileName: string; bytes: Uint8Array; savedAt: number };

export async function loadStoredTemplate(id: string): Promise<StoredTemplate | null> {
  try {
    const value = await withStore<StoredTemplate | undefined>("readonly", (store) => store.get(id));
    return value ?? null;
  } catch {
    return null;
  }
}

export function saveStoredTemplate(id: string, template: StoredTemplate): Promise<unknown> {
  return withStore("readwrite", (store) => store.put(template, id));
}

export function deleteStoredTemplate(id: string): Promise<unknown> {
  return withStore("readwrite", (store) => store.delete(id));
}
