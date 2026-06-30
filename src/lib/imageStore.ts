// IndexedDB-backed store for image blobs.
// Keeps thousands of images out of memory by storing the File/Blob in IndexedDB
// and only creating object URLs for the ones currently rendered (virtualized grid).

const DB_NAME = 'lumina-albums';
const DB_VERSION = 1;
const STORE_NAME = 'images';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface StoredImage {
  id: string;
  blob: Blob;
  filename: string;
  folderName: string;
  mimeType: string;
  size: number;
}

// Store a single image blob keyed by id.
export async function putImage(id: string, data: StoredImage): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(data, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Bulk store many images in a single transaction for speed.
export async function putImages(items: StoredImage[]): Promise<void> {
  if (items.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const item of items) {
      store.put(item, item.id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getImage(id: string): Promise<StoredImage | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result as StoredImage | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function getImages(ids: string[]): Promise<Map<string, StoredImage>> {
  if (ids.length === 0) return new Map();
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const result = new Map<string, StoredImage>();
    let pending = ids.length;
    if (pending === 0) return resolve(result);
    for (const id of ids) {
      const req = store.get(id);
      req.onsuccess = () => {
        if (req.result) result.set(id, req.result as StoredImage);
        pending--;
        if (pending === 0) resolve(result);
      };
      req.onerror = () => reject(req.error);
    }
  });
}

export async function deleteImage(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteImages(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const id of ids) store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Delete all images for a set of ids and return how many were removed.
export async function clearAllImages(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Object URL cache so we don't recreate URLs for visible images repeatedly.
const urlCache = new Map<string, string>();

export async function getObjectUrl(id: string): Promise<string | null> {
  if (urlCache.has(id)) return urlCache.get(id)!;
  const img = await getImage(id);
  if (!img) return null;
  const url = URL.createObjectURL(img.blob);
  urlCache.set(id, url);
  return url;
}

export function revokeObjectUrl(id: string): void {
  const url = urlCache.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(id);
  }
}

export function revokeAllObjectUrls(): void {
  for (const url of urlCache.values()) URL.revokeObjectURL(url);
  urlCache.clear();
}

// Read a stored image as a data URL (base64) for sending to the analysis API.
export async function getImageAsDataURL(
  id: string,
  maxDim = 800,
  quality = 0.8
): Promise<{ dataUrl: string; mimeType: string } | null> {
  const img = await getImage(id);
  if (!img) return null;

  // For small images, skip canvas resize.
  if (img.size < 200_000) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve({ dataUrl: reader.result as string, mimeType: img.mimeType });
      reader.readAsDataURL(img.blob);
    });
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        let width = image.width;
        let height = image.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(image, 0, 0, width, height);
          resolve({ dataUrl: canvas.toDataURL('image/jpeg', quality), mimeType: 'image/jpeg' });
        } else {
          resolve({ dataUrl: e.target?.result as string, mimeType: img.mimeType });
        }
      };
      image.onerror = () => resolve({ dataUrl: e.target?.result as string, mimeType: img.mimeType });
      image.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(img.blob);
  });
}
