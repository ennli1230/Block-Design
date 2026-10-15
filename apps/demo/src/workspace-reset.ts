/** One local reset requested for the clean Turkish installation. Never seed demo data. */
export async function resetWorkspaceCache(storage: Storage): Promise<void> {
  const marker = "blockdesign:maintenance:clean-tr-20261014-v3";
  if (storage.getItem(marker)) return;
  const entries = Object.fromEntries(
    Object.keys(storage)
      .filter((key) => key.startsWith("blockdesign:"))
      .map((key) => [key, storage.getItem(key)]),
  );
  if (Object.keys(entries).length) {
    // IndexedDB avoids doubling localStorage usage and exhausting its quota.
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("blockdesign-workspace-backups", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("snapshots");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction("snapshots", "readwrite");
        transaction.objectStore("snapshots").put(entries, marker);
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error);
        };
        transaction.onabort = () => {
          db.close();
          reject(transaction.error);
        };
      };
    });
    for (const key of Object.keys(entries)) storage.removeItem(key);
  }
  storage.setItem(marker, "done");
}
