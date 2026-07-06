import type { EditorElement, EditorPage, UuiElement } from "./types";

/** Hilfsfunktionen für den (rekursiven) Elementbaum einer Page. */

let uidCounter = 0;
export function newUid(): string {
	uidCounter += 1;
	return `e${Date.now().toString(36)}${uidCounter.toString(36)}`;
}

export function flatten(elements: EditorElement[]): EditorElement[] {
	const out: EditorElement[] = [];
	const walk = (els: EditorElement[]) => {
		for (const el of els) {
			out.push(el);
			if (el.children) walk(el.children);
		}
	};
	walk(elements);
	return out;
}

export function findByUid(
	elements: EditorElement[],
	uid: string,
): EditorElement | null {
	for (const el of elements) {
		if (el._uid === uid) return el;
		if (el.children) {
			const found = findByUid(el.children, uid);
			if (found) return found;
		}
	}
	return null;
}

/** Liefert absolute Position eines Elements (Kinder sind relativ zum Parent). */
export function absolutePosition(
	page: EditorPage,
	uid: string,
	evalNum: (v: unknown) => number,
): { x: number; y: number } | null {
	const walk = (
		els: EditorElement[],
		offX: number,
		offY: number,
	): { x: number; y: number } | null => {
		for (const el of els) {
			const x = offX + evalNum(el.position?.x);
			const y = offY + evalNum(el.position?.y);
			if (el._uid === uid) return { x, y };
			if (el.children) {
				const found = walk(el.children, x, y);
				if (found) return found;
			}
		}
		return null;
	};
	return walk(page.blocks, 0, 0);
}

/** Immutables Update: wendet patch auf Element mit uid an. */
export function updateByUid(
	elements: EditorElement[],
	uid: string,
	patch:
		| Partial<EditorElement>
		| ((el: EditorElement) => Partial<EditorElement>),
): EditorElement[] {
	return elements.map((el) => {
		if (el._uid === uid) {
			const p = typeof patch === "function" ? patch(el) : patch;
			return { ...el, ...p };
		}
		if (el.children) {
			const children = updateByUid(el.children, uid, patch);
			if (children !== el.children) return { ...el, children };
		}
		return el;
	});
}

export function removeByUids(
	elements: EditorElement[],
	uids: Set<string>,
): EditorElement[] {
	return elements
		.filter((el) => !uids.has(el._uid))
		.map((el) =>
			el.children
				? { ...el, children: removeByUids(el.children, uids) }
				: el,
		);
}

/** Verschiebt ein Element in der Geschwister-Liste (Layer-Reihenfolge). */
export function moveInSiblings(
	elements: EditorElement[],
	uid: string,
	dir: -1 | 1,
): EditorElement[] {
	const idx = elements.findIndex((el) => el._uid === uid);
	if (idx >= 0) {
		const next = idx + dir;
		if (next < 0 || next >= elements.length) return elements;
		const copy = [...elements];
		[copy[idx], copy[next]] = [copy[next], copy[idx]];
		return copy;
	}
	return elements.map((el) =>
		el.children
			? { ...el, children: moveInSiblings(el.children, uid, dir) }
			: el,
	);
}

/** EditorElement → UuiElement für den Export. Der echte Ingame-Editor
 *  schreibt visible/locked pro Element (siehe Beispiel-UIs) — wir mappen
 *  unsere Editor-Metadaten darauf. */
export function stripEditorMeta(elements: EditorElement[]): UuiElement[] {
	return elements.map((el) => {
		const { _uid, _locked, _hidden, _group, children, ...rest } = el;
		const out: UuiElement & { visible?: boolean; locked?: boolean } = {
			...rest,
		};
		out.visible = !_hidden;
		out.locked = !!_locked;
		if (children && children.length > 0)
			out.children = stripEditorMeta(children);
		return out;
	});
}

/** UuiElement → EditorElement beim Laden/Import: visible/locked aus der
 *  Datei in Editor-Metadaten übersetzen, uids vergeben. */
export function attachEditorMeta(elements: UuiElement[]): EditorElement[] {
	return elements.map((el) => {
		const { children, ...rest } = el as UuiElement & {
			visible?: boolean;
			locked?: boolean;
		};
		const { visible, locked, ...fields } = rest;
		const out: EditorElement = { ...fields, _uid: newUid() };
		if (visible === false) out._hidden = true;
		if (locked === true) out._locked = true;
		if (children && children.length > 0)
			out.children = attachEditorMeta(children);
		return out;
	});
}

/** Entfernt ein Element (beliebige Tiefe) und liefert Baum + Element. */
function extractByUid(
	elements: EditorElement[],
	uid: string,
): { blocks: EditorElement[]; element: EditorElement | null } {
	let found: EditorElement | null = null;
	const walk = (els: EditorElement[]): EditorElement[] =>
		els
			.filter((el) => {
				if (el._uid === uid) {
					found = el;
					return false;
				}
				return true;
			})
			.map((el) =>
				el.children ? { ...el, children: walk(el.children) } : el,
			);
	const blocks = walk(elements);
	return { blocks, element: found };
}

/** Hängt ein Element als Kind in einen Container (z.B. grid_block) ein. */
export function nestInto(
	elements: EditorElement[],
	uid: string,
	containerUid: string,
): EditorElement[] {
	if (uid === containerUid) return elements;
	const { blocks, element } = extractByUid(elements, uid);
	if (!element) return elements;
	// Container darf nicht Nachfahre des Elements sein
	if (findByUid(element.children ?? [], containerUid)) return elements;
	return updateByUid(blocks, containerUid, (parent) => ({
		children: [...(parent.children ?? []), element],
	}));
}

/** Holt ein verschachteltes Element zurück auf die oberste Ebene. */
export function unnest(
	elements: EditorElement[],
	uid: string,
	newPosition?: { x: number; y: number },
): EditorElement[] {
	const { blocks, element } = extractByUid(elements, uid);
	if (!element) return elements;
	const moved = newPosition ? { ...element, position: newPosition } : element;
	return [...blocks, moved];
}

/** Kopiert Elemente mit frischen uids (für Paste/Duplicate). */
export function cloneWithNewUids(elements: EditorElement[]): EditorElement[] {
	return elements.map((el) => ({
		...el,
		_uid: newUid(),
		children: el.children ? cloneWithNewUids(el.children) : undefined,
	}));
}
