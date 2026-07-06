import type { EditorPage } from "./types";

/**
 * localStorage-Persistenz für Editor-Projekte.
 * Ein Eintrag pro UI unter uui:page:<name>; Index unter uui:pages.
 */

const INDEX_KEY = "uui:pages";
const PAGE_PREFIX = "uui:page:";

export interface StoredPageMeta {
	name: string;
	description?: string;
	updatedAt: number;
}

function readIndex(): StoredPageMeta[] {
	if (typeof window === "undefined") return [];
	try {
		return JSON.parse(localStorage.getItem(INDEX_KEY) ?? "[]");
	} catch {
		return [];
	}
}

function writeIndex(index: StoredPageMeta[]) {
	localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

export function listPages(): StoredPageMeta[] {
	return readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function pageExists(name: string): boolean {
	return readIndex().some((p) => p.name === name);
}

export function loadPage(name: string): EditorPage | null {
	if (typeof window === "undefined") return null;
	const raw = localStorage.getItem(PAGE_PREFIX + name);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as EditorPage;
	} catch {
		return null;
	}
}

export function savePage(page: EditorPage) {
	localStorage.setItem(PAGE_PREFIX + page.name, JSON.stringify(page));
	const index = readIndex().filter((p) => p.name !== page.name);
	index.push({
		name: page.name,
		description: page.desc,
		updatedAt: Date.now(),
	});
	writeIndex(index);
}

export function deletePage(name: string) {
	localStorage.removeItem(PAGE_PREFIX + name);
	writeIndex(readIndex().filter((p) => p.name !== name));
}

export function renamePage(oldName: string, newName: string) {
	const page = loadPage(oldName);
	if (!page) return;
	deletePage(oldName);
	savePage({ ...page, name: newName });
}

/** Name wie im Plugin: klein, keine Leerzeichen, yml-tauglich. */
export function sanitizePageName(input: string): string {
	return input
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "_")
		.replace(/[^a-z0-9_-]/g, "")
		.slice(0, 48);
}
