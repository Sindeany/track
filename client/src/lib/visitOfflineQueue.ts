import type { purposeLabels } from "./visits";

export type VisitDraftPayload = {
  clientName: string;
  employeeName: string;
  employeeRole: string;
  phone: string;
  address: string;
  visitPurpose: keyof typeof purposeLabels;
  report: string;
  photos: string[];
  updatedAt: number;
};

export type PendingVisitRecord = {
  id: string;
  payload: {
    clientName: string;
    employeeName: string;
    employeeRole: string;
    phone: string;
    address: string;
    visitPurpose: keyof typeof purposeLabels;
    report: string;
    latitude: number;
    longitude: number;
    locationAccuracy: number | null;
    photos: string[];
  };
  queuedAt: number;
};

const DB_NAME = "field-visits-offline-db";
const DB_VERSION = 1;
const DRAFT_STORE = "drafts";
const OUTBOX_STORE = "outbox";
const ACTIVE_DRAFT_KEY = "active-visit-draft";

function openOfflineDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || typeof window.indexedDB === "undefined") {
    return Promise.resolve(null);
  }
  return new Promise(resolve => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DRAFT_STORE)) {
          db.createObjectStore(DRAFT_STORE);
        }
        if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
          db.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveVisitDraft(draft: Omit<VisitDraftPayload, "updatedAt">): Promise<void> {
  const db = await openOfflineDb();
  if (!db) return;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(DRAFT_STORE, "readwrite");
      tx.objectStore(DRAFT_STORE).put({ ...draft, updatedAt: Date.now() }, ACTIVE_DRAFT_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function loadVisitDraft(): Promise<VisitDraftPayload | null> {
  const db = await openOfflineDb();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(DRAFT_STORE, "readonly");
      const req = tx.objectStore(DRAFT_STORE).get(ACTIVE_DRAFT_KEY);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as VisitDraftPayload | undefined) ?? null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export async function clearVisitDraft(): Promise<void> {
  const db = await openOfflineDb();
  if (!db) return;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(DRAFT_STORE, "readwrite");
      tx.objectStore(DRAFT_STORE).delete(ACTIVE_DRAFT_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

export async function enqueuePendingVisit(payload: PendingVisitRecord["payload"]): Promise<PendingVisitRecord | null> {
  const db = await openOfflineDb();
  if (!db) return null;
  const record: PendingVisitRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    payload,
    queuedAt: Date.now(),
  };
  return new Promise(resolve => {
    try {
      const tx = db.transaction(OUTBOX_STORE, "readwrite");
      tx.objectStore(OUTBOX_STORE).put(record);
      tx.oncomplete = () => {
        db.close();
        resolve(record);
      };
      tx.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export async function listPendingVisits(): Promise<PendingVisitRecord[]> {
  const db = await openOfflineDb();
  if (!db) return [];
  return new Promise(resolve => {
    try {
      const tx = db.transaction(OUTBOX_STORE, "readonly");
      const req = tx.objectStore(OUTBOX_STORE).getAll();
      req.onsuccess = () => {
        db.close();
        const items = (req.result as PendingVisitRecord[] | undefined) ?? [];
        resolve(items.sort((a, b) => b.queuedAt - a.queuedAt));
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    } catch {
      db.close();
      resolve([]);
    }
  });
}

export async function removePendingVisit(id: string): Promise<void> {
  const db = await openOfflineDb();
  if (!db) return;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(OUTBOX_STORE, "readwrite");
      tx.objectStore(OUTBOX_STORE).delete(id);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}
