import YAML from "yaml";
import { SCREEN_READ_DEFAULTS } from "./defaults";
import { attachEditorMeta, stripEditorMeta } from "./tree";
import type { EditorPage, UuiElement, UuiPage } from "./types";

/**
 * Serialisierung in das UltimateUI-Save-Format. Der Ingame-Editor schreibt
 * über Bukkit YamlConfiguration (SnakeYAML, Block-Style, 2-Space-Indent,
 * Listen-Items auf Key-Ebene). Dieser Dumper bildet das Format nach:
 *  - layer/position/size als Doubles ("835.0"), opacity als int
 *  - Actions als {type, value, name} (name = Duplikat von value)
 *  - editor_animation.keyframes.<row>.'<tick>' mit implizitem linear
 *  - neue Pages: nur name + blocks (screen nur bei Abweichung vom Default)
 */

/* ------------------------------------------------------------------ */
/* Key-Reihenfolge                                                      */
/* ------------------------------------------------------------------ */

const PAGE_KEY_ORDER = [
	"name",
	"desc",
	"command",
	"permission",
	"page-hidden",
	"screen",
	"behavior",
	"animation",
	"animation-loop",
	"open-on-join",
	"blocks",
];

/** Reihenfolge wie handleEditorSelectionCreateElement + Anhänge-Reihenfolge */
const ELEMENT_KEY_ORDER = [
	"component",
	"params",
	"case",
	"loop",
	"type",
	"id",
	"name",
	"enabled",
	"layer",
	"disable-hitbox",
	"opacity",
	"color",
	"font",
	"align",
	"text",
	"text-wrap",
	"item",
	"custom_model_data",
	"enchants",
	"glowing",
	"unicode",
	"image",
	"direction",
	"gap",
	"element_h",
	"position",
	"size",
	"visible",
	"locked",
	"outline",
	"rounding",
	"rotation",
	"pivot",
	"visibility",
	"hover",
	"hitbox",
	"click",
	"hud",
	"show",
	"actions",
	"editor_animation",
	"children",
];

function orderKeys(
	obj: Record<string, unknown>,
	order: string[],
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const k of order) if (obj[k] !== undefined) out[k] = obj[k];
	for (const k of Object.keys(obj))
		if (!(k in out) && obj[k] !== undefined) out[k] = obj[k];
	return out;
}

/* ------------------------------------------------------------------ */
/* Element-Aufbereitung                                                 */
/* ------------------------------------------------------------------ */

function cleanElement(el: UuiElement): Record<string, unknown> {
	// Component-Referenzen sind reine {component, params}-Maps — alle anderen
	// Keys würden vom Resolver als Params durchgereicht (editor.yml-Belege).
	if (el.component) {
		const ref: Record<string, unknown> = { component: el.component };
		if (el.params && Object.keys(el.params).length > 0)
			ref.params = el.params;
		const extra = el as unknown as Record<string, unknown>;
		if (extra.case !== undefined) ref.case = extra.case;
		if (extra.loop !== undefined) ref.loop = extra.loop;
		return ref;
	}

	const copy: Record<string, unknown> = { ...el };

	for (const k of Object.keys(copy)) {
		const v = copy[k];
		if (v === undefined || v === null) delete copy[k];
		else if (Array.isArray(v) && v.length === 0) delete copy[k];
	}

	// Items: Plugin schreibt `item: DIAMOND` (String), wenn nur material
	if (el.item) {
		const { material, custom_model_data, glowing, enchants } = el.item;
		const extras =
			custom_model_data !== undefined ||
			glowing !== undefined ||
			(enchants && enchants.length > 0);
		if (!material && !extras) delete copy.item;
		else if (!extras) copy.item = material;
		else
			copy.item = orderKeys(
				{
					material,
					custom_model_data,
					glowing,
					enchants,
				} as Record<string, unknown>,
				["material", "custom_model_data", "glowing", "enchants"],
			);
	}

	// rounded-Blöcke: echte Dateien tragen rounding.unicode-Ecken mit Farbtag
	if (
		(el.type === "rounded" || el.type === "block_rounded") &&
		!el.rounding
	) {
		const tag = `<#${el.color ?? "ffffff"}>`;
		copy.rounding = { unicode: { tl: tag, tr: tag, br: tag, bl: tag } };
	}

	if (el.position) copy.position = { x: el.position.x, y: el.position.y };
	if (el.size) {
		const s: Record<string, unknown> = {
			width: el.size.width,
			height: el.size.height,
		};
		if (el.size.depth !== undefined) s.depth = el.size.depth;
		copy.size = s;
	}

	// Actions: name = Duplikat von value (wie ActionListManager)
	if (el.actions && el.actions.length > 0) {
		copy.actions = el.actions.map((a) => ({
			type: a.type,
			value: a.value ?? "",
			name: a.value ?? "",
		}));
	}

	// leere visibility/hover/outline-Objekte entfernen
	for (const k of ["visibility", "hover", "outline", "pivot", "hud"]) {
		const v = copy[k];
		if (
			v &&
			typeof v === "object" &&
			Object.values(v as object).every((x) => x === undefined)
		)
			delete copy[k];
	}

	// editor_animation: leere Tracks strippen, Ticks aufsteigend sortieren
	if (el.editor_animation) {
		const kf = el.editor_animation.keyframes ?? {};
		const rows: Record<string, unknown> = {};
		for (const row of ["rotation", "position", "scale", "opacity"] as const) {
			const track = kf[row];
			if (track && Object.keys(track).length > 0) {
				const sorted: Record<string, unknown> = {};
				for (const tick of Object.keys(track).sort(
					(a, b) => Number(a) - Number(b),
				))
					sorted[tick] = track[tick];
				rows[row] = sorted;
			}
		}
		if (Object.keys(rows).length === 0) delete copy.editor_animation;
		else {
			const anim: Record<string, unknown> = {};
			if (el.editor_animation.delay !== undefined)
				anim.delay = el.editor_animation.delay;
			anim.keyframes = rows;
			copy.editor_animation = anim;
		}
	}

	if (el.children)
		copy.children = el.children.map((c) => cleanElement(c));

	return orderKeys(copy, ELEMENT_KEY_ORDER);
}

/* ------------------------------------------------------------------ */
/* Page → Plain Object                                                  */
/* ------------------------------------------------------------------ */

function screenDiffersFromDefaults(page: EditorPage): boolean {
	const s = page.screen as unknown as Record<string, unknown>;
	const d = SCREEN_READ_DEFAULTS as Record<string, unknown>;
	for (const k of Object.keys(s)) {
		if (s[k] === undefined || k === "preview") continue;
		if (!(k in d)) return true;
		if (s[k] !== d[k]) return true;
	}
	return false;
}

/** Entfernt rekursiv undefined-Felder und leere Objekte (für optionale
 *  Page-Level-Sektionen wie behavior/animation/open-on-join). */
function pruneDeep(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(pruneDeep);
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			const pruned = pruneDeep(v);
			if (pruned === undefined) continue;
			if (
				pruned &&
				typeof pruned === "object" &&
				!Array.isArray(pruned) &&
				Object.keys(pruned as object).length === 0
			)
				continue;
			out[k] = pruned;
		}
		return out;
	}
	return value;
}

export function pageToPlain(page: EditorPage): Record<string, unknown> {
	const plain: Record<string, unknown> = {
		...page,
		blocks: stripEditorMeta(page.blocks).map(cleanElement),
	};
	// Editor-interne Felder nie exportieren
	for (const k of Object.keys(plain)) if (k.startsWith("_")) delete plain[k];
	for (const k of ["behavior", "animation", "open-on-join"]) {
		if (plain[k] !== undefined) plain[k] = pruneDeep(plain[k]);
	}
	// Ingame-Editor schreibt screen nie — nur exportieren, wenn angepasst
	if (!screenDiffersFromDefaults(page)) delete plain.screen;
	for (const k of Object.keys(plain)) {
		const v = plain[k];
		if (
			v === undefined ||
			v === null ||
			v === "" ||
			(typeof v === "object" &&
				!Array.isArray(v) &&
				Object.keys(v as object).length === 0)
		)
			delete plain[k];
	}
	return orderKeys(plain, PAGE_KEY_ORDER);
}

/* ------------------------------------------------------------------ */
/* Bukkit-Style-Dumper                                                  */
/* ------------------------------------------------------------------ */

const FLOAT_KEYS = new Set(["layer", "rotation"]);
const FLOAT_PARENT_CHILD: Record<string, Set<string>> = {
	position: new Set(["x", "y"]),
	size: new Set(["width", "height", "depth"]),
};
const INT_KEYS = new Set([
	"opacity",
	"text-wrap",
	"custom_model_data",
	"delay",
	"width", // screen.width etc. bleiben ints (nur size.* ist float)
	"height",
]);

function isFloatContext(path: string[]): boolean {
	const key = path[path.length - 1];
	const parent = path[path.length - 2];
	if (path.includes("keyframes")) {
		// alle numerischen Keyframe-Werte sind Doubles
		return key !== "interpolation" && key !== "delay";
	}
	if (parent && FLOAT_PARENT_CHILD[parent]?.has(key)) return true;
	if (FLOAT_KEYS.has(key) && parent !== "screen") return true;
	return false;
}

function formatNumber(n: number, path: string[]): string {
	if (isFloatContext(path) && Number.isInteger(n)) return `${n}.0`;
	return String(n);
}

const NEEDS_QUOTE =
	/^$|^[\s]|[\s]$|^(true|false|null|yes|no|on|off|~)$|^-?\d|^[!&*\-?{}[\],#|>@`"'%]|:\s|:$|\s#|[\n\t]/i;

function formatString(s: string): string {
	if (NEEDS_QUOTE.test(s) || s === "---") {
		return `'${s.replace(/'/g, "''")}'`;
	}
	return s;
}

function dumpValue(
	value: unknown,
	indent: number,
	path: string[],
	lines: string[],
	keyPrefix: string,
): void {
	const pad = "  ".repeat(indent);
	if (value === null || value === undefined) {
		lines.push(`${pad}${keyPrefix} null`);
		return;
	}
	if (typeof value === "number") {
		lines.push(`${pad}${keyPrefix} ${formatNumber(value, path)}`);
		return;
	}
	if (typeof value === "boolean") {
		lines.push(`${pad}${keyPrefix} ${value}`);
		return;
	}
	if (typeof value === "string") {
		lines.push(`${pad}${keyPrefix} ${formatString(value)}`);
		return;
	}
	if (Array.isArray(value)) {
		if (value.length === 0) {
			lines.push(`${pad}${keyPrefix} []`);
			return;
		}
		lines.push(`${pad}${keyPrefix}`.trimEnd());
		for (const item of value) dumpListItem(item, indent, path, lines);
		return;
	}
	// Map
	const entries = Object.entries(value as Record<string, unknown>).filter(
		([, v]) => v !== undefined,
	);
	if (entries.length === 0) {
		lines.push(`${pad}${keyPrefix} {}`);
		return;
	}
	lines.push(`${pad}${keyPrefix}`.trimEnd());
	for (const [k, v] of entries)
		dumpValue(v, indent + 1, [...path, k], lines, `${formatKey(k)}:`);
}

function dumpListItem(
	item: unknown,
	indent: number,
	path: string[],
	lines: string[],
): void {
	const pad = "  ".repeat(indent);
	if (item === null || typeof item !== "object" || Array.isArray(item)) {
		const scalar =
			typeof item === "number"
				? formatNumber(item, path)
				: typeof item === "string"
					? formatString(item)
					: String(item);
		lines.push(`${pad}- ${scalar}`);
		return;
	}
	const entries = Object.entries(item as Record<string, unknown>).filter(
		([, v]) => v !== undefined,
	);
	if (entries.length === 0) {
		lines.push(`${pad}- {}`);
		return;
	}
	let first = true;
	for (const [k, v] of entries) {
		const sub: string[] = [];
		dumpValue(v, indent + 1, [...path, k], sub, `${formatKey(k)}:`);
		if (first) {
			// erstes Feld in die "- "-Zeile ziehen
			sub[0] = `${pad}- ${sub[0].trimStart()}`;
			first = false;
		}
		lines.push(...sub);
	}
}

function formatKey(k: string): string {
	// numerische Keys (Animation-Ticks) werden gequotet: '15':
	if (/^-?\d+$/.test(k)) return `'${k}'`;
	if (NEEDS_QUOTE.test(k)) return `'${k.replace(/'/g, "''")}'`;
	return k;
}

export function pageToYaml(page: EditorPage): string {
	const plain = pageToPlain(page);
	const lines: string[] = [];
	for (const [k, v] of Object.entries(plain))
		dumpValue(v, 0, [k], lines, `${formatKey(k)}:`);
	return `${lines.join("\n")}\n`;
}

/* ------------------------------------------------------------------ */
/* Import                                                               */
/* ------------------------------------------------------------------ */

export function yamlToPage(text: string): EditorPage {
	const raw = YAML.parse(text) as UuiPage;
	if (!raw || typeof raw !== "object" || !raw.name)
		throw new Error("Not a valid UltimateUI page file (missing name).");
	const { blocks = [], ...rest } = raw;
	// Items als String-Form → Objektform fürs Editieren
	const normalize = (els: UuiElement[]): UuiElement[] =>
		els.map((el) => {
			const copy = { ...el };
			if (typeof copy.item === "string")
				copy.item = { material: copy.item as unknown as string };
			if (copy.children) copy.children = normalize(copy.children);
			return copy;
		});
	return {
		...rest,
		screen: { ...SCREEN_READ_DEFAULTS, ...(raw.screen ?? {}) },
		blocks: attachEditorMeta(normalize(blocks)),
	};
}
