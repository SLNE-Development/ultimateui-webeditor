"use client";

/**
 * Lokaler Asset-Speicher (IndexedDB) — das "Working Directory" des Web-Editors.
 * - UI-Bilder unter img:<name>  → entsprechen contents/images/<name>.png auf dem Server
 * - Hintergründe unter bg:<name> → nur Editor-Anzeige, nie exportrelevant
 */

const DB_NAME = "uui-assets";
const STORE = "files";

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => {
			if (!req.result.objectStoreNames.contains(STORE))
				req.result.createObjectStore(STORE);
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

function tx<T>(
	mode: IDBTransactionMode,
	fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
	return openDb().then(
		(db) =>
			new Promise<T>((resolve, reject) => {
				const t = db.transaction(STORE, mode);
				const req = fn(t.objectStore(STORE));
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => reject(req.error);
			}),
	);
}

export async function saveAsset(key: string, blob: Blob): Promise<void> {
	await tx("readwrite", (s) => s.put(blob, key));
	urlCache.delete(key);
	notify();
}

export async function getAsset(key: string): Promise<Blob | null> {
	const result = await tx<Blob | undefined>("readonly", (s) => s.get(key));
	return result ?? null;
}

export async function deleteAsset(key: string): Promise<void> {
	await tx("readwrite", (s) => s.delete(key));
	const url = urlCache.get(key);
	if (url) URL.revokeObjectURL(url);
	urlCache.delete(key);
	notify();
}

export async function listAssetKeys(prefix: string): Promise<string[]> {
	const keys = await tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys());
	return keys
		.map(String)
		.filter((k) => k.startsWith(prefix))
		.sort();
}

/* -------------------- Object-URL-Cache + React-Hook -------------------- */

const urlCache = new Map<string, string>();
const listeners = new Set<() => void>();
function notify() {
	for (const l of listeners) l();
}

export async function getAssetUrl(key: string): Promise<string | null> {
	const cached = urlCache.get(key);
	if (cached) return cached;
	const blob = await getAsset(key);
	if (!blob) return null;
	const url = URL.createObjectURL(blob);
	urlCache.set(key, url);
	return url;
}

import React from "react";

/** Liefert die Object-URL eines Assets (oder null) und aktualisiert sich,
 *  wenn Assets gespeichert/gelöscht werden. */
export function useAssetUrl(key: string | undefined): string | null {
	const [url, setUrl] = React.useState<string | null>(
		key ? (urlCache.get(key) ?? null) : null,
	);
	React.useEffect(() => {
		let alive = true;
		const load = () => {
			if (!key) {
				setUrl(null);
				return;
			}
			getAssetUrl(key).then((u) => alive && setUrl(u));
		};
		load();
		listeners.add(load);
		return () => {
			alive = false;
			listeners.delete(load);
		};
	}, [key]);
	return url;
}

/** Dateiname → Plugin-tauglicher Bildname (contents/images/<name>.png). */
export function sanitizeImageName(fileName: string): string {
	return fileName
		.replace(/\.[a-z0-9]+$/i, "")
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "_")
		.replace(/[^a-z0-9_-]/g, "")
		.slice(0, 48);
}

/** Liest die natürliche Größe eines Bild-Blobs. */
export function readImageSize(
	blob: Blob,
): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(blob);
		const img = new Image();
		img.onload = () => {
			resolve({ width: img.naturalWidth, height: img.naturalHeight });
			URL.revokeObjectURL(url);
		};
		img.onerror = reject;
		img.src = url;
	});
}
