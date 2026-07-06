/**
 * Datenmodell für UltimateUI-Pages, rekonstruiert aus dem dekompilierten Plugin
 * (dev.xqedii.ultimateUI, Beta v1.2.3). Ziel: verlustfreier Roundtrip zwischen
 * Editor-Zustand und server-kompatiblem YAML unter contents/pages/<name>.yml.
 */

/** Zahlenfelder akzeptieren im Plugin Rechenausdrücke ("1920/2", "9200.0+500")
 *  und Placeholder ("%player_health,MIN=0,MAX=20,DEFAULT=20%"). */
export type NumExpr = number | string;

export type UuiElementType =
	| "block"
	| "block_rounded"
	| "rounded"
	| "text"
	| "hitbox"
	| "item"
	| "image"
	| "grid_block";

export type UuiActionType =
	| "command"
	| "console"
	| "message"
	| "redirect"
	| "teleport"
	| "sound"
	| "delay"
	| "close"
	| "animation";


/**
 * Action-Map exakt wie ActionListManager.buildDefaultActionMap sie erzeugt:
 * {type, value, name} — `name` ist im Plugin stets ein Duplikat von `value`.
 * Es gibt KEINE Left/Right-Unterscheidung und kein delay-Attribut
 * (delay ist ein eigener Action-Typ).
 */
export interface UuiAction {
	type: UuiActionType;
	value?: string;
	name?: string;
}

/** Interpolationen aus AnimationTimelineOperationsManagerBase (+ Legacy-Aliase).
 *  "linear" ist Default und wird NIE explizit geschrieben. */
export type UuiInterpolation =
	| "linear"
	| "smooth"
	| "smooth-in"
	| "smooth-out"
	| "ease-in"
	| "ease-out"
	| "bezier"
	| "back"
	| "back-in"
	| "back-out"
	| "bounce"
	| "bounce-in"
	| "bounce-out";

/**
 * Keyframe-Wert eines Tracks (Key im YAML = Tick als String, z.B. '15'):
 * - rotation/opacity: reine Zahl ODER {value, interpolation}
 * - position: {x, y[, interpolation]}
 * - scale: {offsetX, offsetY, x, y, width, height[, interpolation]}
 */
export type UuiKeyframe =
	| number
	| {
			value?: number;
			x?: number;
			y?: number;
			offsetX?: number;
			offsetY?: number;
			width?: number;
			height?: number;
			interpolation?: UuiInterpolation;
	  };

export type UuiKeyframeTrack = Record<string, UuiKeyframe>;

export interface UuiElementAnimation {
	delay?: number;
	keyframes: {
		position?: UuiKeyframeTrack;
		rotation?: UuiKeyframeTrack;
		scale?: UuiKeyframeTrack;
		opacity?: UuiKeyframeTrack;
	};
}

export interface UuiItemSpec {
	material?: string;
	custom_model_data?: number;
	glowing?: boolean;
	enchants?: string[];
}

export interface UuiElement {
	type: UuiElementType;
	id?: string;
	name?: string;
	enabled?: boolean;
	layer?: NumExpr;
	opacity?: NumExpr;
	color?: string;
	align?: "left" | "center" | "right";
	position?: { x: NumExpr; y: NumExpr };
	size?: { width: NumExpr; height: NumExpr; depth?: NumExpr };
	outline?: { size?: number; color?: string };
	unicode?: string;
	/** text-Element */
	text?: string;
	font?: string;
	"text-wrap"?: number;
	/** item-Element */
	item?: UuiItemSpec;
	/** image-Element (Bildname aus resourcepack) */
	image?: string;
	rotation?: NumExpr;
	pivot?: {
		x?: NumExpr;
		y?: NumExpr;
		mode?: string;
		normalized?: boolean;
	};
	visibility?: { visible?: boolean; placeholder?: string };
	hover?: { color?: string; effect?: string; image?: string; text?: string };
	"disable-hitbox"?: boolean;
	hitbox?: { x?: NumExpr; y?: NumExpr };
	click?: { effect?: string };
	rounding?: string | Record<string, unknown>;
	/** HUD-Anker (echte Dateien: aligned: right beim Scoreboard) */
	aligned?: "left" | "right" | string;
	/** grid_block-Layout */
	direction?: "row" | "column";
	gap?: NumExpr;
	element_h?: NumExpr;
	/** Umbruch nach N Elementen (Zeile/Spalte) */
	row_size?: NumExpr;
	/** Wiederholung: Element wird N-mal erzeugt (max 2048); {counter} = Index */
	loop?: NumExpr;
	/** HUD-Modus */
	hud?: { anchor?: string; aligned?: boolean };
	actions?: UuiAction[];
	editor_animation?: UuiElementAnimation;
	children?: UuiElement[];
	/** Component-Einbindung (statt type) */
	component?: string;
	params?: Record<string, unknown>;
}

export interface UuiScreen {
	width: number;
	height: number;
	offsetX?: number;
	offsetY?: number;
	hitboxOffsetX?: number;
	hitboxOffsetY?: number;
	cursorLayer?: number;
	cursorSize?: number;
	cursorSpeed?: number;
	cursorUnicode?: string;
	preview?: { defaultZoom?: number };
}

export interface UuiPage {
	name: string;
	/** Beschreibung — heißt im YAML `desc` (Save-As-Popup) */
	desc?: string;
	/** Custom-Öffnungs-Command ohne führenden Slash (Save-As-Popup) */
	command?: string;
	permission?: string;
	/** true = Page taucht im Ingame-Editor nicht auf */
	"page-hidden"?: boolean;
	/** Wird vom Ingame-Editor NIE geschrieben; nur exportieren, wenn vom
	 *  Plugin-Lese-Default abweichend (Read-Defaults: 1920×1060, offsetY 20,
	 *  hitboxOffsetY -17, cursorSize 10, cursorSpeed 1). */
	screen: UuiScreen;
	behavior?: {
		"keep-open"?: boolean;
		reopen?: boolean;
		"close-on-death"?: boolean;
		"close-on-damage"?: boolean;
	};
	animation?: {
		open?: { effect?: string };
		close?: { effect?: string; usehud?: boolean };
	};
	"animation-loop"?: boolean;
	"open-on-join"?: { enabled?: boolean; type?: "hud" | "gui"; delay?: number };
	blocks: UuiElement[];
}

/* ------------------------------------------------------------------ */
/* Editor-interner Zustand: Elemente mit stabiler Identität + Editor-  */
/* Metadaten, die beim Export gestrippt werden.                        */
/* ------------------------------------------------------------------ */

export interface EditorElement extends Omit<UuiElement, "children"> {
	/** stabile Editor-ID (nicht exportiert) */
	_uid: string;
	/** Editor-Sperre (Selection > Block) — Export als locked: true */
	_locked?: boolean;
	/** Editor-Ausblendung (Selection > Hide) — Export als visible: false */
	_hidden?: boolean;
	/** Gruppen-Zuordnung im Layers-Panel (rein Editor-intern, NICHT exportiert) */
	_group?: string;
	children?: EditorElement[];
}

/** Layer-Gruppe im Editor (rein organisatorisch; existiert im YAML nicht). */
export interface EditorGroup {
	id: string;
	name: string;
	collapsed?: boolean;
}

export interface EditorPage extends Omit<UuiPage, "blocks"> {
	blocks: EditorElement[];
	/** Editor-Gruppen (nicht exportiert) */
	_groups?: EditorGroup[];
}

export type EditorTool =
	| "move"
	| "scale"
	| "align"
	| "fill"
	| "picker"
	| "zoom"
	| "text"
	| "actions"
	| "animation";

export type SidebarTab = "properties" | "design" | "layers";
