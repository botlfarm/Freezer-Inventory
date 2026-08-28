/**
 * Safely generates a UUID v4 in both secure (HTTPS/localhost) and sandbox/iframe environments
 * where standard window.crypto.randomUUID might be undefined.
 */
export const generateUUID = (): string => {
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
    try {
      return window.crypto.randomUUID();
    } catch (e) {
      // Fallback below
    }
  }

  // Safe RFC4122 v4 compliant fallback generator using Math.random
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
