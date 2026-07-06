"use client";

import type {
	EditorElement,
	EditorPage,
	EditorTool,
	SidebarTab,
} from "@/lib/uui/types";
import React from "react";

/** Undo-Limit wie im Plugin (config.yml editor.history.undo-limit). */
const UNDO_LIMIT = 50;

export interface EditorState {
	page: EditorPage;
	past: EditorPage[];
	future: EditorPage[];
	/** Snapshot zu Beginn einer Drag-Transaktion */
	txSnapshot: EditorPage | null;
	selection: string[];
	tool: EditorTool;
	tab: SidebarTab;
	zoom: number;
	pan: { x: number; y: number };
	fillColor: string;
	clipboard: EditorElement[];
	preview: boolean;
	dirty: boolean;
	showTimeline: boolean;
	/** aktuelle Timeline-Position (Ticks) */
	timelineTick: number;
	/** Canvas-Hintergrund: "dark" | "black" | "white" | "checker" | "sky" | "asset:<key>" */
	canvasBg: string;
	/** simulierte Bildschirmbreite für die HUD-Anker-Vorschau (1920 = Design) */
	simWidth: number;
	/** Pick-Modus: nächster Canvas-Klick hängt das Element in diesen Container */
	picking: { containerUid: string } | null;
	/** Smart-Guides-Snapping beim Verschieben (Alt hält temporär aus) */
	snapping: boolean;
}

export type EditorEvent =
	| { type: "set-page"; page: EditorPage; commit?: boolean }
	| { type: "tx-begin" }
	| { type: "tx-set-page"; page: EditorPage }
	| { type: "tx-end" }
	| { type: "tx-cancel" }
	| { type: "undo" }
	| { type: "redo" }
	| { type: "select"; uids: string[] }
	| { type: "set-tool"; tool: EditorTool }
	| { type: "set-tab"; tab: SidebarTab }
	| { type: "set-zoom"; zoom: number; pan?: { x: number; y: number } }
	| { type: "set-pan"; pan: { x: number; y: number } }
	| { type: "set-fill-color"; color: string }
	| { type: "set-clipboard"; elements: EditorElement[] }
	| { type: "set-preview"; preview: boolean }
	| { type: "toggle-timeline"; show?: boolean }
	| { type: "set-timeline-tick"; tick: number }
	| { type: "set-canvas-bg"; bg: string }
	| { type: "set-sim-width"; width: number }
	| { type: "set-picking"; picking: { containerUid: string } | null }
	| { type: "toggle-snapping" }
	| { type: "mark-saved" };

export function editorReducer(
	state: EditorState,
	ev: EditorEvent,
): EditorState {
	switch (ev.type) {
		case "set-page": {
			if (ev.commit === false)
				return { ...state, page: ev.page, dirty: true };
			return {
				...state,
				past: [...state.past, state.page].slice(-UNDO_LIMIT),
				future: [],
				page: ev.page,
				dirty: true,
			};
		}
		case "tx-begin":
			// laufende Transaktion nicht überschreiben (z.B. Live-Color-Streams)
			if (state.txSnapshot) return state;
			return { ...state, txSnapshot: state.page };
		case "tx-set-page":
			return { ...state, page: ev.page, dirty: true };
		case "tx-cancel": {
			if (!state.txSnapshot) return state;
			return { ...state, page: state.txSnapshot, txSnapshot: null };
		}
		case "tx-end": {
			if (!state.txSnapshot) return state;
			if (state.txSnapshot === state.page)
				return { ...state, txSnapshot: null };
			return {
				...state,
				past: [...state.past, state.txSnapshot].slice(-UNDO_LIMIT),
				future: [],
				txSnapshot: null,
			};
		}
		case "undo": {
			const prev = state.past[state.past.length - 1];
			if (!prev) return state;
			return {
				...state,
				past: state.past.slice(0, -1),
				future: [state.page, ...state.future],
				page: prev,
				dirty: true,
			};
		}
		case "redo": {
			const next = state.future[0];
			if (!next) return state;
			return {
				...state,
				past: [...state.past, state.page].slice(-UNDO_LIMIT),
				future: state.future.slice(1),
				page: next,
				dirty: true,
			};
		}
		case "select":
			return { ...state, selection: ev.uids };
		case "set-tool":
			return {
				...state,
				tool: ev.tool,
				showTimeline: ev.tool === "animation" ? true : state.showTimeline,
			};
		case "set-tab":
			return { ...state, tab: ev.tab };
		case "set-zoom":
			return {
				...state,
				zoom: Math.min(4, Math.max(0.1, ev.zoom)),
				pan: ev.pan ?? state.pan,
			};
		case "set-pan":
			return { ...state, pan: ev.pan };
		case "set-fill-color":
			return { ...state, fillColor: ev.color };
		case "set-clipboard":
			return { ...state, clipboard: ev.elements };
		case "set-preview":
			return { ...state, preview: ev.preview };
		case "toggle-timeline":
			return { ...state, showTimeline: ev.show ?? !state.showTimeline };
		case "set-timeline-tick":
			return { ...state, timelineTick: Math.max(0, ev.tick) };
		case "set-sim-width":
			return { ...state, simWidth: Math.max(640, ev.width) };
		case "set-picking":
			return { ...state, picking: ev.picking };
		case "toggle-snapping": {
			const snapping = !state.snapping;
			try {
				localStorage.setItem("uui:snapping", String(snapping));
			} catch {
				/* Session-only */
			}
			return { ...state, snapping };
		}
		case "set-canvas-bg": {
			try {
				localStorage.setItem("uui:canvasBg", ev.bg);
			} catch {
				/* Storage voll/blockiert — Auswahl gilt nur für die Session */
			}
			return { ...state, canvasBg: ev.bg };
		}
		case "mark-saved":
			return { ...state, dirty: false };
		default:
			return state;
	}
}

export function initialEditorState(
	page: EditorPage,
	preview: boolean,
): EditorState {
	return {
		page,
		past: [],
		future: [],
		txSnapshot: null,
		selection: [],
		tool: "move",
		tab: "properties",
		zoom: page.screen.preview?.defaultZoom ?? 0.8,
		pan: { x: 0, y: 0 },
		fillColor: "ffffff",
		clipboard: [],
		preview,
		dirty: false,
		showTimeline: false,
		timelineTick: 0,
		canvasBg:
			(typeof window !== "undefined" &&
				localStorage.getItem("uui:canvasBg")) ||
			"dark",
		simWidth: 1920,
		picking: null,
		snapping:
			typeof window === "undefined" ||
			localStorage.getItem("uui:snapping") !== "false",
	};
}

export const EditorCtx = React.createContext<{
	state: EditorState;
	dispatch: React.Dispatch<EditorEvent>;
} | null>(null);

export function useEditor() {
	const ctx = React.useContext(EditorCtx);
	if (!ctx) throw new Error("useEditor outside EditorCtx");
	return ctx;
}
