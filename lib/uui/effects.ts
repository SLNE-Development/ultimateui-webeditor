"use client";

/**
 * Effekt-Presets (contents/effects/<name>.yml) — Hover-/Klick-/Open-/Close-
 * Effekte. Schema aus den gebündelten Plugin-Presets (scale.yml/transform.yml):
 * id, name, type, amount-percent, scale-x/y ("5%"), move-x/y, opacity-delta,
 * rotation-deg, duration-ms, interpolation.
 */

export interface UuiEffect {
	id: string;
	name: string;
	type: "scale" | "transform" | "move";
	"amount-percent"?: number;
	"scale-x"?: string | number;
	"scale-y"?: string | number;
	"move-x"?: number;
	"move-y"?: number;
	"opacity-delta"?: number;
	"rotation-deg"?: number;
	"duration-ms"?: number;
	interpolation?: string;
}

const KEY = "uui:effects";

/** Die beiden mitgelieferten Plugin-Presets (auf jedem Server vorhanden). */
export const BUILTIN_EFFECTS: Record<string, UuiEffect> = {
	scale: {
		id: "scale",
		name: "Scale",
		type: "scale",
		"amount-percent": 5,
		"scale-x": "5%",
		"scale-y": "5%",
		"move-x": 0,
		"move-y": 0,
		"opacity-delta": 0,
		"rotation-deg": 0,
		"duration-ms": 250,
		interpolation: "ease-in-out",
	},
	transform: {
		id: "transform",
		name: "Transform",
		type: "transform",
		"move-x": 0,
		"move-y": -6,
		"scale-x": "8%",
		"scale-y": "8%",
		"opacity-delta": 0,
		"rotation-deg": 0,
		"duration-ms": 250,
		interpolation: "ease-in-out",
	},
};

export function listCustomEffects(): Record<string, UuiEffect> {
	if (typeof window === "undefined") return {};
	try {
		return JSON.parse(localStorage.getItem(KEY) ?? "{}");
	} catch {
		return {};
	}
}

export function saveEffect(effect: UuiEffect) {
	const all = listCustomEffects();
	all[effect.id] = effect;
	localStorage.setItem(KEY, JSON.stringify(all));
}

export function deleteEffect(id: string) {
	const all = listCustomEffects();
	delete all[id];
	localStorage.setItem(KEY, JSON.stringify(all));
}

/** Alle bekannten Effektnamen (Builtins + eigene). */
export function allEffectNames(): string[] {
	return [
		...new Set([
			...Object.keys(BUILTIN_EFFECTS),
			...Object.keys(listCustomEffects()),
		]),
	].sort();
}

const EFFECT_KEY_ORDER: (keyof UuiEffect)[] = [
	"id",
	"name",
	"type",
	"amount-percent",
	"scale-x",
	"scale-y",
	"move-x",
	"move-y",
	"opacity-delta",
	"rotation-deg",
	"duration-ms",
	"interpolation",
];

/** Serialisiert ein Effekt-Preset im Format der Plugin-Dateien. */
export function effectToYaml(effect: UuiEffect): string {
	const lines: string[] = [];
	for (const k of EFFECT_KEY_ORDER) {
		const v = effect[k];
		if (v === undefined || v === "") continue;
		lines.push(`${k}: ${v}`);
	}
	return `${lines.join("\n")}\n`;
}
