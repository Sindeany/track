/**
 * Safe wrappers for localStorage and sessionStorage that prevent crashes in
 * Safari Private Browsing mode, restricted iframes, or environments where
 * Storage access throws SecurityError or QuotaExceededError.
 */

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window === "undefined" || !window.localStorage) return null;
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      if (typeof window === "undefined" || !window.localStorage) return;
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore private mode or quota errors safely
    }
  },

  removeItem(key: string): void {
    try {
      if (typeof window === "undefined" || !window.localStorage) return;
      window.localStorage.removeItem(key);
    } catch {
      // Ignore safely
    }
  },
};

export const safeSessionStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window === "undefined" || !window.sessionStorage) return null;
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      if (typeof window === "undefined" || !window.sessionStorage) return;
      window.sessionStorage.setItem(key, value);
    } catch {
      // Ignore private mode or quota errors safely
    }
  },

  removeItem(key: string): void {
    try {
      if (typeof window === "undefined" || !window.sessionStorage) return;
      window.sessionStorage.removeItem(key);
    } catch {
      // Ignore safely
    }
  },
};
