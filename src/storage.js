/**
 * storage.js: everything lives in the user's browser (localStorage).
 * There is no server. Export and import move data between browsers.
 */

const STORAGE_KEY = 'memo:v2';

export function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Private browsing or full storage can make saving fail; the app keeps working in memory. */
export function save({ passages }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ passages }));
  } catch {}
}

export function downloadBackup({ passages }) {
  const json = JSON.stringify({ passages }, null, 2);
  const link = document.createElement('a');
  link.href = `data:application/json,${encodeURIComponent(json)}`;
  link.download = `memo-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
}

export async function readBackup(file) {
  const data = JSON.parse(await file.text());
  if (!Array.isArray(data?.passages)) throw new Error('This file is not a Memo backup.');
  return data;
}
