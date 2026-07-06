import { evalNumExpr } from "./expr";
import { flatten, newUid } from "./tree";
import type { EditorElement, EditorPage } from "./types";

/**
 * Defaults exakt nach dem Plugin (handleEditorSelectionCreateElement,
 * GuiServiceEditorSupportB.java:2666-2737 und Screen-Lese-Defaults in
 * GuiServiceEditorSupport.java:228-245).
 */

/** Standard-Icon-Glyph neuer Blocks/Items im Plugin. */
export const DEFAULT_UNICODE = "";
/** Default-Cursor-Glyph (screen.cursorUnicode-Lese-Default). */
export const DEFAULT_CURSOR_UNICODE = "";

/** Screen-Lese-Defaults des Plugins — eine neue Page-Datei enthält KEINEN
 *  screen-Key; diese Werte gelten dann implizit. */
export const SCREEN_READ_DEFAULTS = {
	width: 1920,
	height: 1060,
	offsetX: 0,
	offsetY: 20,
	hitboxOffsetX: 0,
	hitboxOffsetY: -17,
	cursorSize: 10,
	cursorSpeed: 1.0,
} as const;

/** Neue Page: Datei enthält nur name + blocks (createGuiAndStartEditor). */
export function newPage(name: string): EditorPage {
	return {
		name,
		screen: { ...SCREEN_READ_DEFAULTS },
		blocks: [],
	};
}

function nextLayer(page: EditorPage): number {
	const layers = flatten(page.blocks).map((el) => evalNumExpr(el.layer, 0));
	const max = layers.length ? Math.max(...layers) : 0;
	return Math.floor(max) + 1;
}

/** Eindeutige ID wie buildSelectionCreatedElementId: Basis, bei Konflikt _N. */
function uniqueId(page: EditorPage, base: string): string {
	const existing = new Set(flatten(page.blocks).map((el) => el.id));
	if (!existing.has(base)) return base;
	for (let i = 1; ; i++) {
		const candidate = `${base}_${i}`;
		if (!existing.has(candidate)) return candidate;
	}
}

/** Erstellbare Element-Arten (Kontextmenü/Layer-Menü des Ingame-Editors +
 *  Web-Extras rounded/hitbox, die der Parser ebenfalls versteht). */
export type CreateKind =
	| "block"
	| "text"
	| "item"
	| "image"
	| "rounded"
	| "hitbox"
	| "grid_block"
	| "component";

export function newElement(
	page: EditorPage,
	kind: CreateKind,
	at?: { x: number; y: number },
): EditorElement {
	const screenW = page.screen.width ?? 1920;
	const screenH = page.screen.height ?? 1060;
	// Ingame: mittig, x = width/2 - 125 (Default-Größe 250×250)
	const pos = at ?? { x: screenW / 2 - 125, y: screenH / 2 - 125 };
	const layer = nextLayer(page);

	const base = {
		_uid: newUid(),
		layer,
		opacity: 255,
		color: "ffffff",
		position: { x: Math.round(pos.x), y: Math.round(pos.y) },
		size: { width: 250, height: 250 },
	};

	switch (kind) {
		case "text": {
			const id = uniqueId(page, "text");
			return {
				...base,
				type: "text",
				id,
				name: "Enter text",
				font: "default",
				align: "left",
				text: "Enter text",
			} as EditorElement;
		}
		case "item": {
			// Ingame-Editor: Items sind type "block" mit item-Feld + Icon-Glyph
			const id = uniqueId(page, "item");
			return {
				...base,
				type: "block",
				id,
				name: "Item",
				item: { material: "DIAMOND" },
				unicode: DEFAULT_UNICODE,
			};
		}
		case "image": {
			const id = uniqueId(page, "image");
			return {
				...base,
				type: "image",
				id,
				name: "Image",
				image: "",
				size: { width: 128, height: 128 },
			};
		}
		case "rounded": {
			const id = uniqueId(page, "rounded");
			return { ...base, type: "rounded", id, name: "Rounded" };
		}
		case "hitbox": {
			const id = uniqueId(page, "hitbox");
			return {
				...base,
				type: "hitbox",
				id,
				name: "Hitbox",
				opacity: 0,
				size: { width: 100, height: 100 },
			};
		}
		case "grid_block": {
			// Layout-Container: rendert selbst nichts, ordnet children an
			const id = uniqueId(page, "grid");
			return {
				...base,
				type: "grid_block",
				id,
				name: "Grid",
				direction: "row",
				gap: 8,
				size: { width: 400, height: 100 },
				children: [],
			};
		}
		case "component": {
			// Referenz auf contents/components/<name>.yml
			const id = uniqueId(page, "component");
			return {
				...base,
				type: "block",
				id,
				name: "Component",
				component: "",
				params: {},
			} as EditorElement;
		}
		default: {
			const id = uniqueId(page, "block");
			return {
				...base,
				type: "block",
				id,
				name: "Block",
				unicode: DEFAULT_UNICODE,
			};
		}
	}
}
