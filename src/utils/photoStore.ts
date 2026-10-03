import { WardrobePhotoStore } from '../types';

const DB_NAME = 'stylesaathi_photos_db';
const STORE_NAME = 'photos';
const DB_VERSION = 1;

class IndexedDBPhotoStore implements WardrobePhotoStore {
  private memFallback = new Map<string, string>();
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  private async getDB(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return null;
    }
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          console.warn('IndexedDB unavailable, falling back to memory store.');
          resolve(null);
        };
      } catch (err) {
        console.warn('IndexedDB init error, using memory fallback:', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  async savePhoto(id: string, dataUrl: string): Promise<string> {
    const db = await this.getDB();
    if (!db) {
      this.memFallback.set(id, dataUrl);
      return dataUrl;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(dataUrl, id);
        req.onsuccess = () => resolve(dataUrl);
        req.onerror = () => {
          this.memFallback.set(id, dataUrl);
          resolve(dataUrl);
        };
      } catch (err) {
        this.memFallback.set(id, dataUrl);
        resolve(dataUrl);
      }
    });
  }

  async getPhoto(id: string): Promise<string | null> {
    if (this.memFallback.has(id)) {
      return this.memFallback.get(id) || null;
    }

    const db = await this.getDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (err) {
        resolve(null);
      }
    });
  }

  async deletePhoto(id: string): Promise<void> {
    this.memFallback.delete(id);
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch (err) {
        resolve();
      }
    });
  }

  async clearPhotos(): Promise<void> {
    this.memFallback.clear();
    const db = await this.getDB();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch (err) {
        resolve();
      }
    });
  }
}

export const photoStore = new IndexedDBPhotoStore();
