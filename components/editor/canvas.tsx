"use client";

import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
	readImageSize,
	sanitizeImageName,
	saveAsset,
	useAssetUrl,
} from "@/lib/uui/assets";
import { type CreateKind, newElement } from "@/lib/uui/defaults";
import { evalNumExpr } from "@/lib/uui/expr";
import { parseTextMarkup, patchTextMarkup } from "@/lib/uui/textstyle";
import {
	cloneWithNewUids,
	findByUid,
	nestInto,
	updateByUid,
} from "@/lib/uui/tree";
import type { EditorElement } from "@/lib/uui/types";
import { cn } from "@/lib/utils";
import { Lock, MousePointerClick, Zap } from "lucide-react";
import React from "react";
import { useEditor } from "./store";

/* ------------------------------------------------------------------ */
/* Konstanten (Werte wie im Ingame-Editor)                              */
/* ------------------------------------------------------------------ */

/** Snap-Toleranz für Smart Guides in Screen-Pixeln (Photoshop-artig) */
const GUIDE_SNAP_PX = 8;
/** Zoom-Faktoren: Linksklick ×1.12, Rechtsklick ×0.8929 */
const ZOOM_IN_FACTOR = 1.12;
const ZOOM_OUT_FACTOR = 0.8929;
/** Bewegung in px (Screen), ab der ein Klick zum Drag wird */
const DRAG_THRESHOLD = 3;

/* ------------------------------------------------------------------ */
/* Geometrie                                                            */
/* ------------------------------------------------------------------ */

interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

function elementRect(el: EditorElement, parent?: Rect): Rect {
	const px = parent?.x ?? 0;
	const py = parent?.y ?? 0;
	return {
		x: px + evalNumExpr(el.position?.x),
		y: py + evalNumExpr(el.position?.y),
		w: evalNumExpr(el.size?.width, 0),
		h: evalNumExpr(el.size?.height, 0),
	};
}

function collectRects(
	elements: EditorElement[],
	parent?: Rect,
	out: { uid: string; rect: Rect; el: EditorElement }[] = [],
): { uid: string; rect: Rect; el: EditorElement }[] {
	for (const el of elements) {
		const rect = elementRect(el, parent);
		out.push({ uid: el._uid, rect, el });
		if (el.children) collectRects(el.children, rect, out);
	}
	return out;
}

function stripMarkup(text: string): string {
	return text
		.replace(/<[^>]*>/g, "")
		.replace(/[&§][0-9a-fk-orx]/gi, "")
		.replace(/%%?[^%]*?%%?/g, (m) => m.replaceAll("%", ""));
}

/** Findet das Eltern-Element eines uid (null = Top-Level). */
function findParentOf(
	elements: EditorElement[],
	uid: string,
	parent: EditorElement | null = null,
): EditorElement | null | undefined {
	for (const el of elements) {
		if (el._uid === uid) return parent;
		if (el.children) {
			const found = findParentOf(el.children, uid, el);
			if (found !== undefined) return found;
		}
	}
	return undefined;
}

/** Hat das Element Maus-Interaktion im Spiel? */
function isInteractive(el: EditorElement): boolean {
	if (el["disable-hitbox"]) return false;
	return !!(
		(el.actions && el.actions.length > 0) ||
		el.hover?.effect ||
		el.hover?.image ||
		(el.hover?.color && el.hover.color !== "none")
	);
}

/* ------------------------------------------------------------------ */
/* Element-Rendering                                                    */
/* ------------------------------------------------------------------ */

/** Sichtbarer Ecken-Radius je Rounding-Modus (Annäherung an die Glyphen). */
function roundingRadius(
	rounding: EditorElement["rounding"],
	w: number,
	h: number,
): number {
	const cap = Math.min(w, h) / 2;
	let base = 12; // default: Ecken-Unicode-Glyphen
	if (typeof rounding === "string") {
		const m = rounding.toLowerCase();
		if (["none", "off", "disabled", "false", "0"].includes(m)) base = 0;
		else if (m === "small") base = 6;
		else if (m === "medium") base = 18;
		else if (m === "large") base = 26;
		else base = 12; // regular/default/normal
	}
	return Math.min(base, cap);
}

function ElementView({
	el,
	editMode,
	anchorDx = 0,
	inGrid = false,
}: {
	el: EditorElement;
	editMode: boolean;
	/** horizontale Verschiebung durch HUD-Anker-Simulation (nur Top-Level) */
	anchorDx?: number;
	/** Kind eines grid_block: Position wird vom Layout bestimmt (ignoriert) */
	inGrid?: boolean;
}) {
	// Hooks vor jedem early-return (Hook-Regeln)
	const imgUrl = useAssetUrl(
		el.type === "image" && el.image ? `img:${el.image}` : undefined,
	);
	const hoverImgUrl = useAssetUrl(
		el.type === "image" && el.hover?.image
			? `img:${el.hover.image}`
			: undefined,
	);
	const [hovering, setHovering] = React.useState(false);

	if (el._hidden || el.enabled === false) return null;

	// im Grid bestimmt das Layout die Position — eigene x/y werden ignoriert
	const x = inGrid ? 0 : evalNumExpr(el.position?.x) + anchorDx;
	const y = inGrid ? 0 : evalNumExpr(el.position?.y);
	const w = evalNumExpr(el.size?.width, 0);
	const h = evalNumExpr(el.size?.height, 0);
	const rawOpacity = evalNumExpr(el.opacity ?? 255, 255) / 255;
	// Edit-Modus: unsichtbare Elemente (z.B. Image-Anker mit opacity 0)
	// bleiben mit Mindest-Deckkraft greifbar; Preview zeigt echte Werte.
	const opacity = editMode ? Math.max(rawOpacity, 0.3) : rawOpacity;
	const ghost = editMode && rawOpacity < 0.05;
	const color = `#${(el.color ?? "ffffff").replace(/[^0-9a-fA-F]/g, "").padEnd(6, "0").slice(0, 6)}`;
	const rotation = evalNumExpr(el.rotation, 0);
	const zIndex = Math.round(evalNumExpr(el.layer) * 10) + 50000;
	const interactive = !editMode && isInteractive(el);

	const common: React.CSSProperties = {
		left: x,
		top: y,
		zIndex,
		transform: rotation ? `rotate(${rotation}deg)` : undefined,
	};
	const boxStyle: React.CSSProperties = { ...common, width: w, height: h };

	let body: React.ReactNode = null;

	if (el.component) {
		body = (
			<div
				className="absolute border border-fuchsia-500/60 border-dashed p-1 text-[10px] text-fuchsia-300"
				style={{ ...common, width: Math.max(80, w), height: Math.max(24, h) }}
				data-uid={el._uid}
			>
				component: {el.component}
			</div>
		);
	} else {
		switch (el.type) {
			case "text": {
				const fontSize = Math.max(8, h * 0.16);
				const style = parseTextMarkup(el.text);
				const textColor = style.color ? `#${style.color}` : color;
				const decorations = [
					style.underlined && "underline",
					style.strikethrough && "line-through",
				]
					.filter(Boolean)
					.join(" ");
				body = (
					<div
						className={cn(
							"absolute select-none",
							interactive && "uui-interactive",
						)}
						style={{
							...common,
							fontFamily: '"Monocraft", monospace',
							fontSize,
							lineHeight: 1.15,
							color: textColor,
							fontWeight: style.bold ? 700 : 400,
							fontStyle: style.italic ? "italic" : undefined,
							textDecorationLine: decorations || undefined,
							opacity,
							textAlign: el.align ?? "left",
							maxWidth: el["text-wrap"]
								? Number(el["text-wrap"])
								: undefined,
							whiteSpace: el["text-wrap"] ? "pre-wrap" : "pre",
							transform:
								el.align === "center"
									? `translateX(-50%)${rotation ? ` rotate(${rotation}deg)` : ""}`
									: common.transform,
						}}
						data-uid={el._uid}
					>
						{stripMarkup(style.body) || " "}
					</div>
				);
				break;
			}
			case "hitbox":
				body = (
					<div
						className="absolute border border-cyan-400/60 border-dashed bg-cyan-400/5"
						style={{ ...boxStyle, opacity: Math.max(opacity, 0.3) }}
						data-uid={el._uid}
					/>
				);
				break;
			case "image": {
				// Ingame rendert das Bild via Resource-Pack unabhängig von der
				// Anker-Opacity — hochgeladene Bilder daher immer sichtbar zeigen.
				const activeUrl =
					!editMode && hovering && hoverImgUrl ? hoverImgUrl : imgUrl;
				body = activeUrl ? (
					<img
						src={activeUrl}
						alt={el.image}
						draggable={false}
						className={cn(
							"absolute select-none",
							interactive && "uui-interactive",
						)}
						style={{
							...boxStyle,
							opacity: Math.max(rawOpacity, 0.9),
							objectFit: "fill",
						}}
						data-uid={el._uid}
						onMouseEnter={() => setHovering(true)}
						onMouseLeave={() => setHovering(false)}
					/>
				) : (
					<div
						className={cn(
							"absolute flex items-center justify-center overflow-hidden border border-sky-400/50 bg-sky-500/10 text-[10px] text-sky-200",
							ghost && "border-dashed",
							interactive && "uui-interactive",
						)}
						style={{ ...boxStyle, opacity: Math.max(rawOpacity, 0.55) }}
						data-uid={el._uid}
						title="Kein Bild hochgeladen — Design → Image → Upload"
					>
						🖼 {el.image || "image"}
					</div>
				);
				break;
			}
			case "grid_block": {
				// Layout-Container: ordnet Kinder automatisch an (Row/Column + Gap);
				// Kind-Positionen werden ignoriert, loop: N erzeugt N Kopien.
				const kids: React.ReactNode[] = [];
				for (const child of el.children ?? []) {
					if (child._hidden || child.enabled === false) continue;
					const copies =
						child.loop !== undefined
							? Math.max(
									1,
									Math.min(16, Math.floor(evalNumExpr(child.loop, 1))),
								)
							: 1;
					const cw = evalNumExpr(child.size?.width, 20);
					const ch = evalNumExpr(
						el.element_h !== undefined
							? el.element_h
							: child.size?.height,
						20,
					);
					for (let i = 0; i < copies; i++) {
						kids.push(
							<div
								key={`${child._uid}_${i}`}
								style={{
									position: "relative",
									width: cw,
									height: ch,
									flexShrink: 0,
									// Loop-Kopien leicht transparent (nur Vorschau)
									opacity: i > 0 ? 0.55 : 1,
								}}
							>
								<ElementView el={child} editMode={editMode} inGrid />
							</div>,
						);
					}
				}
				body = (
					<div
						className={cn(
							"absolute",
							editMode &&
								"border border-emerald-500/50 border-dashed bg-emerald-500/5",
						)}
						style={{
							...boxStyle,
							width: w || undefined,
							height: h || undefined,
							display: "flex",
							flexWrap: el.row_size !== undefined ? "wrap" : "nowrap",
							alignContent: "flex-start",
							flexDirection: el.direction === "column" ? "column" : "row",
							gap: evalNumExpr(el.gap, 0),
							opacity: editMode ? Math.max(opacity, 0.4) : opacity,
							overflow: editMode ? "visible" : "hidden",
						}}
						data-uid={el._uid}
					>
						{editMode && kids.length === 0 && (
							<span className="p-0.5 text-[9px] text-emerald-300">
								grid ({el.direction ?? "row"}) — Layers-Panel: Elemente per
								⋯-Menü einhängen
							</span>
						)}
						{kids}
					</div>
				);
				break;
			}
			default: {
				// block / rounded / block_rounded (Items = block mit item-Feld)
				if (el.item?.material) {
					body = (
						<div
							className={cn(
								"absolute flex items-center justify-center overflow-hidden border border-amber-400/60 bg-amber-500/15 text-[10px] text-amber-200",
								interactive && "uui-interactive",
							)}
							style={{ ...boxStyle, opacity }}
							data-uid={el._uid}
						>
							{el.item.material.slice(0, 28)}
						</div>
					);
					break;
				}
				const isRounded =
					el.type === "rounded" || el.type === "block_rounded";
				body = (
					<div
						className={cn(
							"absolute",
							ghost && "border border-neutral-500 border-dashed",
							interactive && "uui-interactive",
						)}
						style={{
							...boxStyle,
							backgroundColor: color,
							opacity,
							borderRadius: isRounded
								? roundingRadius(el.rounding, w, h)
								: 0,
							boxShadow: el.outline
								? `0 0 0 ${el.outline.size ?? 1}px #${el.outline.color ?? "141414"}`
								: undefined,
						}}
						data-uid={el._uid}
					/>
				);
			}
		}
	}

	return (
		<>
			{body}
			{/* grid_block rendert seine Kinder selbst (Flex-Layout) */}
			{el.type !== "grid_block" && el.children && el.children.length > 0 && (
				<div className="absolute" style={{ left: x, top: y, zIndex }}>
					{el.children.map((c) => (
						<ElementView key={c._uid} el={c} editMode={editMode} />
					))}
				</div>
			)}
		</>
	);
}

/* ------------------------------------------------------------------ */
/* Stage-Hintergrund (umschaltbar: Farben, Checker, Sky, Screenshot)    */
/* ------------------------------------------------------------------ */

const BG_PRESETS: Record<string, React.CSSProperties> = {
	dark: { backgroundColor: "#080808" },
	black: { backgroundColor: "#000000" },
	white: { backgroundColor: "#ffffff" },
	checker: {
		backgroundColor: "#1a1a1a",
		backgroundImage:
			"linear-gradient(45deg, #262626 25%, transparent 25%, transparent 75%, #262626 75%), linear-gradient(45deg, #262626 25%, transparent 25%, transparent 75%, #262626 75%)",
		backgroundSize: "32px 32px",
		backgroundPosition: "0 0, 16px 16px",
	},
	sky: {
		// grober Minecraft-Tag-Himmel + Plains-Boden
		background:
			"linear-gradient(180deg, #78a7ff 0%, #9dc2ff 55%, #b7d5a8 55.5%, #7da453 62%, #6c9147 100%)",
	},
};

function StageBackground({ bg }: { bg: string }) {
	const assetKey = bg.startsWith("asset:") ? bg.slice(6) : undefined;
	const url = useAssetUrl(assetKey);
	const style: React.CSSProperties =
		assetKey && url
			? {
					backgroundImage: `url(${url})`,
					backgroundSize: "cover",
					backgroundPosition: "center",
				}
			: (BG_PRESETS[bg] ?? BG_PRESETS.dark);
	return (
		<div
			className="absolute shadow-[0_0_0_1px_#2a2a2a,0_0_60px_rgba(0,0,0,0.8)]"
			style={{ inset: 0, ...style }}
		/>
	);
}

/* ------------------------------------------------------------------ */
/* Drag-Zustände                                                        */
/* ------------------------------------------------------------------ */

type DragMode =
	| { kind: "none" }
	| {
			kind: "pending-move";
			pointerId: number;
			screenX: number;
			screenY: number;
			startX: number;
			startY: number;
			origins: Map<string, { x: number; y: number }>;
			/** Bounding-Box der Selektion beim Drag-Start (für Smart Guides) */
			originBox: Rect;
	  }
	| {
			kind: "move";
			pointerId: number;
			startX: number;
			startY: number;
			origins: Map<string, { x: number; y: number }>;
			originBox: Rect;
	  }
	| {
			kind: "resize";
			pointerId: number;
			handle: string;
			startX: number;
			startY: number;
			origin: Rect;
			/** relative Ausgangsposition des Elements (Kinder: relativ zum Parent) */
			originRel: { x: number; y: number };
			uid: string;
	  }
	| {
			kind: "pending-marquee";
			pointerId: number;
			screenX: number;
			screenY: number;
			startX: number;
			startY: number;
	  }
	| {
			kind: "marquee";
			pointerId: number;
			startX: number;
			startY: number;
			curX: number;
			curY: number;
	  }
	| {
			kind: "pan";
			pointerId: number;
			startX: number;
			startY: number;
			origin: { x: number; y: number };
	  };

/* ------------------------------------------------------------------ */
/* Canvas                                                               */
/* ------------------------------------------------------------------ */

export default function Canvas() {
	const { state, dispatch } = useEditor();
	const viewportRef = React.useRef<HTMLDivElement>(null);
	// Drag-Zustand als Ref: Pointer-Events feuern schneller als React-State
	// aktualisiert — der Ref ist immer aktuell, ein Spiegel-State rendert Overlays.
	const dragRef = React.useRef<DragMode>({ kind: "none" });
	const [drag, setDragUi] = React.useState<DragMode>({ kind: "none" });
	const setDrag = React.useCallback((d: DragMode) => {
		dragRef.current = d;
		setDragUi(d);
	}, []);
	const [hovered, setHovered] = React.useState<string | null>(null);
	/** aktive Smart-Guide-Linien während eines Drags (Stage-Koordinaten) */
	const [guides, setGuides] = React.useState<{
		x: number | null;
		y: number | null;
	} | null>(null);
	const [textEdit, setTextEdit] = React.useState<{
		uid: string;
		value: string;
	} | null>(null);

	const { page, zoom, pan, tool, selection, preview } = state;
	const screenW = page.screen.width ?? 1920;
	const screenH = page.screen.height ?? 1060;
	// HUD-Anker-Simulation: 1920 = Design-Ansicht, sonst simulierte Breite
	const viewW = state.simWidth === 1920 ? screenW : state.simWidth;
	const anchorDxFor = (el: EditorElement): number => {
		if (viewW === screenW) return 0;
		const a = (el.aligned ?? "").toLowerCase();
		if (a === "left") return 0;
		if (a === "right") return viewW - screenW;
		return (viewW - screenW) / 2;
	};

	const toStage = React.useCallback(
		(clientX: number, clientY: number) => {
			const vp = viewportRef.current!.getBoundingClientRect();
			return {
				x: (clientX - vp.left - pan.x) / zoom,
				y: (clientY - vp.top - pan.y) / zoom,
			};
		},
		[pan, zoom],
	);

	React.useEffect(() => {
		const vp = viewportRef.current;
		if (!vp) return;
		const rect = vp.getBoundingClientRect();
		// Fit-to-Screen: ganze Stage sichtbar, max. defaultZoom (0.8 wie ingame)
		const fit = Math.min(
			0.8,
			(rect.width - 40) / viewW,
			(rect.height - 40) / screenH,
		);
		dispatch({
			type: "set-zoom",
			zoom: fit,
			pan: {
				x: (rect.width - viewW * fit) / 2,
				y: (rect.height - screenH * fit) / 2,
			},
		});
		// beim Wechsel der Sim-Breite neu einpassen
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [viewW]);

	// Escape bricht den Pick-Modus ab
	React.useEffect(() => {
		if (!state.picking) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape")
				dispatch({ type: "set-picking", picking: null });
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [state.picking, dispatch]);

	// Escape bricht laufenden Drag ab
	React.useEffect(() => {
		if (drag.kind === "none") return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				if (drag.kind === "move" || drag.kind === "resize")
					dispatch({ type: "tx-cancel" });
				setGuides(null);
				setDrag({ kind: "none" });
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [drag.kind, dispatch]);

	/** logische Rects (position/size) — für Resize-Ausgang und Snapping */
	const rects = React.useMemo(() => collectRects(page.blocks), [page.blocks]);

	/** tatsächlich gerenderte Rects (Stage-Koordinaten) — Text kann durch
	 *  align/center verschoben rendern; Hit-Test & Overlays folgen dem Auge. */
	const [domRects, setDomRects] = React.useState<Map<string, Rect>>(
		new Map(),
	);
	React.useLayoutEffect(() => {
		const vp = viewportRef.current;
		if (!vp) return;
		const vpr = vp.getBoundingClientRect();
		const map = new Map<string, Rect>();
		for (const node of vp.querySelectorAll<HTMLElement>("[data-uid]")) {
			const uid = node.dataset.uid;
			if (!uid) continue;
			const r = node.getBoundingClientRect();
			map.set(uid, {
				x: (r.left - vpr.left - pan.x) / zoom,
				y: (r.top - vpr.top - pan.y) / zoom,
				w: r.width / zoom,
				h: r.height / zoom,
			});
		}
		setDomRects(map);
	}, [page.blocks, zoom, pan]);

	const stageRect = (uid: string): Rect | null =>
		domRects.get(uid) ?? rects.find((r) => r.uid === uid)?.rect ?? null;

	/** Hit-Test über die echte Render-Reihenfolge (elementsFromPoint):
	 *  oberstes sichtbares Element gewinnt; gesperrte werden übersprungen. */
	const hitTestClient = (clientX: number, clientY: number): string | null => {
		for (const node of document.elementsFromPoint(clientX, clientY)) {
			const uid = (node as HTMLElement).dataset?.uid;
			if (!uid) continue;
			const el = findByUid(page.blocks, uid);
			if (!el || el._locked || el._hidden || el.enabled === false) continue;
			return uid;
		}
		return null;
	};

	const capture = (e: React.PointerEvent) => {
		try {
			viewportRef.current?.setPointerCapture(e.pointerId);
		} catch {
			/* Pointer-ID nicht aktiv (z.B. synthetische Events) */
		}
	};
	const release = (pointerId: number) => {
		try {
			viewportRef.current?.releasePointerCapture(pointerId);
		} catch {
			/* schon released */
		}
	};

	const beginTextEdit = (uid: string) => {
		const el = findByUid(page.blocks, uid);
		if (el?.type === "text" && !el._locked)
			// nur der reine Text — das Markup-Präfix bleibt beim Commit erhalten
			setTextEdit({ uid, value: parseTextMarkup(el.text).body });
	};

	/* ---------------- Pointer-Handler ---------------- */

	const onPointerDown = (e: React.PointerEvent) => {
		if (preview) return;
		if (textEdit) return; // Textfeld hat Fokus
		if (e.button === 1) {
			capture(e);
			setDrag({
				kind: "pan",
				pointerId: e.pointerId,
				startX: e.clientX,
				startY: e.clientY,
				origin: { ...pan },
			});
			return;
		}
		if (e.button !== 0) return;
		const { x: sx, y: sy } = toStage(e.clientX, e.clientY);

		if (tool === "zoom") {
			zoomAt(e.clientX, e.clientY, zoom * ZOOM_IN_FACTOR);
			return;
		}

		const hitUid = hitTestClient(e.clientX, e.clientY);

		// Pick-Modus: angeklicktes Element in den Ziel-Container einhängen
		if (state.picking) {
			if (hitUid && hitUid !== state.picking.containerUid) {
				dispatch({
					type: "set-page",
					page: {
						...page,
						blocks: nestInto(
							page.blocks,
							hitUid,
							state.picking.containerUid,
						),
					},
				});
				dispatch({ type: "select", uids: [state.picking.containerUid] });
			}
			dispatch({ type: "set-picking", picking: null });
			return;
		}

		if (tool === "fill") {
			if (hitUid)
				dispatch({
					type: "set-page",
					page: {
						...page,
						blocks: updateByUid(page.blocks, hitUid, {
							color: state.fillColor,
						}),
					},
				});
			return;
		}
		if (tool === "picker") {
			if (hitUid) {
				const el = findByUid(page.blocks, hitUid);
				if (el?.color)
					dispatch({ type: "set-fill-color", color: el.color });
			}
			return;
		}
		if (tool === "text") {
			if (hitUid) beginTextEdit(hitUid);
			return;
		}

		// move / scale / align / actions / animation
		if (hitUid) {
			const already = selection.includes(hitUid);
			let uids: string[];
			if (e.shiftKey) {
				uids = already
					? selection.filter((u) => u !== hitUid)
					: [...selection, hitUid];
				dispatch({ type: "select", uids });
				return; // Shift-Klick = nur Auswahl togglen, kein Drag
			}
			uids = already ? selection : [hitUid];
			if (!already) dispatch({ type: "select", uids });

			// Drag vormerken — startet erst nach DRAG_THRESHOLD.
			// Grid-Kinder sind nicht verschiebbar (das Layout positioniert sie).
			const origins = new Map<string, { x: number; y: number }>();
			for (const uid of uids) {
				const el = findByUid(page.blocks, uid);
				if (!el || el._locked) continue;
				const parent = findParentOf(page.blocks, uid);
				if (parent && parent.type === "grid_block") continue;
				origins.set(uid, {
					x: evalNumExpr(el.position?.x),
					y: evalNumExpr(el.position?.y),
				});
			}
			if (origins.size > 0) {
				// Bounding-Box der zu ziehenden Elemente (für Smart Guides)
				let bx0 = Infinity;
				let by0 = Infinity;
				let bx1 = -Infinity;
				let by1 = -Infinity;
				for (const uid of origins.keys()) {
					const r = rects.find((rr) => rr.uid === uid)?.rect;
					if (!r) continue;
					bx0 = Math.min(bx0, r.x);
					by0 = Math.min(by0, r.y);
					bx1 = Math.max(bx1, r.x + r.w);
					by1 = Math.max(by1, r.y + r.h);
				}
				const originBox: Rect = Number.isFinite(bx0)
					? { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 }
					: { x: sx, y: sy, w: 0, h: 0 };
				capture(e);
				setDrag({
					kind: "pending-move",
					pointerId: e.pointerId,
					screenX: e.clientX,
					screenY: e.clientY,
					startX: sx,
					startY: sy,
					origins,
					originBox,
				});
			}
		} else {
			if (!e.shiftKey) dispatch({ type: "select", uids: [] });
			capture(e);
			setDrag({
				kind: "pending-marquee",
				pointerId: e.pointerId,
				screenX: e.clientX,
				screenY: e.clientY,
				startX: sx,
				startY: sy,
			});
		}
	};

	const onPointerMove = (e: React.PointerEvent) => {
		let drag = dragRef.current;
		if (drag.kind === "none") {
			if (preview) return;
			setHovered(hitTestClient(e.clientX, e.clientY));
			return;
		}
		if (drag.kind === "pan") {
			dispatch({
				type: "set-pan",
				pan: {
					x: drag.origin.x + (e.clientX - drag.startX),
					y: drag.origin.y + (e.clientY - drag.startY),
				},
			});
			return;
		}
		const { x: sx, y: sy } = toStage(e.clientX, e.clientY);

		// Schwellen-Konvertierung: danach direkt weiterverarbeiten, damit
		// die erste Bewegung nicht verloren geht
		if (drag.kind === "pending-move") {
			if (
				Math.hypot(e.clientX - drag.screenX, e.clientY - drag.screenY) <
				DRAG_THRESHOLD
			)
				return;
			dispatch({ type: "tx-begin" });
			const next: DragMode = {
				kind: "move",
				pointerId: drag.pointerId,
				startX: drag.startX,
				startY: drag.startY,
				origins: drag.origins,
				originBox: drag.originBox,
			};
			setDrag(next);
			drag = next;
		}
		if (drag.kind === "pending-marquee") {
			if (
				Math.hypot(e.clientX - drag.screenX, e.clientY - drag.screenY) <
				DRAG_THRESHOLD
			)
				return;
			const next: DragMode = {
				kind: "marquee",
				pointerId: drag.pointerId,
				startX: drag.startX,
				startY: drag.startY,
				curX: sx,
				curY: sy,
			};
			setDrag(next);
			drag = next;
		}

		if (drag.kind === "move") {
			let dx = sx - drag.startX;
			let dy = sy - drag.startY;
			// Shift = Achsen-Sperre (wie in Photoshop)
			if (e.shiftKey) {
				if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
				else dx = 0;
			}
			// Smart Guides: Kanten/Mitten der Selektion snappen an Kanten/Mitten
			// anderer Elemente + Screen-Rand/-Mitte. Alt hält das Snapping aus.
			let gx: number | null = null;
			let gy: number | null = null;
			if (state.snapping && !e.altKey) {
				const threshold = GUIDE_SNAP_PX / zoom;
				const box = drag.originBox;
				const newX = box.x + dx;
				const newY = box.y + dy;
				const targetsX: number[] = [0, screenW / 2, screenW];
				const targetsY: number[] = [0, screenH / 2, screenH];
				for (const r of rects) {
					if (drag.origins.has(r.uid) || r.el._hidden) continue;
					targetsX.push(
						r.rect.x,
						r.rect.x + r.rect.w / 2,
						r.rect.x + r.rect.w,
					);
					targetsY.push(
						r.rect.y,
						r.rect.y + r.rect.h / 2,
						r.rect.y + r.rect.h,
					);
				}
				let bestX: { d: number; adjust: number; line: number } | null =
					null;
				for (const t of targetsX) {
					for (const edge of [newX, newX + box.w / 2, newX + box.w]) {
						const d = Math.abs(edge - t);
						if (d < threshold && (!bestX || d < bestX.d))
							bestX = { d, adjust: t - edge, line: t };
					}
				}
				let bestY: { d: number; adjust: number; line: number } | null =
					null;
				for (const t of targetsY) {
					for (const edge of [newY, newY + box.h / 2, newY + box.h]) {
						const d = Math.abs(edge - t);
						if (d < threshold && (!bestY || d < bestY.d))
							bestY = { d, adjust: t - edge, line: t };
					}
				}
				if (bestX) {
					dx += bestX.adjust;
					gx = bestX.line;
				}
				if (bestY) {
					dy += bestY.adjust;
					gy = bestY.line;
				}
			}
			setGuides(gx !== null || gy !== null ? { x: gx, y: gy } : null);
			// Pixel-Snapping: Positionen immer auf ganze Pixel
			let blocks = page.blocks;
			for (const [uid, origin] of drag.origins) {
				blocks = updateByUid(blocks, uid, {
					position: {
						x: Math.round(origin.x + dx),
						y: Math.round(origin.y + dy),
					},
				});
			}
			dispatch({ type: "tx-set-page", page: { ...page, blocks } });
			return;
		}

		if (drag.kind === "resize") {
			// absolut vom Ausgangszustand rechnen — robust gegen Event-Bursts
			const dx = sx - drag.startX;
			const dy = sy - drag.startY;
			const o = drag.origin;
			let { x, y, w, h } = o;
			const has = (s: string) => drag.handle.includes(s);
			if (has("e")) w = o.w + dx;
			if (has("s")) h = o.h + dy;
			if (has("w")) {
				w = o.w - dx;
				x = o.x + dx;
			}
			if (has("n")) {
				h = o.h - dy;
				y = o.y + dy;
			}
			// Shift = proportional, nur an Ecken (wie ingame)
			if (e.shiftKey && drag.handle.length === 2) {
				const k = Math.max(w / o.w, h / o.h);
				w = o.w * k;
				h = o.h * k;
				if (has("w")) x = o.x + (o.w - w);
				if (has("n")) y = o.y + (o.h - h);
			}
			w = Math.max(1, Math.round(w));
			h = Math.max(1, Math.round(h));
			const el = findByUid(page.blocks, drag.uid);
			if (!el) return;
			const relX = drag.originRel.x + (x - o.x);
			const relY = drag.originRel.y + (y - o.y);
			dispatch({
				type: "tx-set-page",
				page: {
					...page,
					blocks: updateByUid(page.blocks, drag.uid, {
						position: { x: Math.round(relX), y: Math.round(relY) },
						size: { ...el.size, width: w, height: h },
					}),
				},
			});
			return;
		}

		if (drag.kind === "marquee") {
			setDrag({ ...drag, curX: sx, curY: sy });
		}
	};

	const onPointerUp = (e: React.PointerEvent) => {
		const drag = dragRef.current;
		if (drag.kind === "none") return;
		setGuides(null);
		release(drag.pointerId);
		if (drag.kind === "move" || drag.kind === "resize")
			dispatch({ type: "tx-end" });
		if (drag.kind === "marquee") {
			const x0 = Math.min(drag.startX, drag.curX);
			const y0 = Math.min(drag.startY, drag.curY);
			const x1 = Math.max(drag.startX, drag.curX);
			const y1 = Math.max(drag.startY, drag.curY);
			// wie ingame: alle schneidenden, nicht gesperrten Elemente
			// (auf Basis der sichtbaren Rects)
			const uids = rects
				.filter(({ uid, el }) => {
					if (el._hidden || el._locked) return false;
					const rect = stageRect(uid);
					if (!rect) return false;
					return (
						rect.x < x1 &&
						rect.x + rect.w > x0 &&
						rect.y < y1 &&
						rect.y + rect.h > y0
					);
				})
				.map((r) => r.uid);
			dispatch({ type: "select", uids });
		}
		setDrag({ kind: "none" });
	};

	const onDoubleClick = (e: React.MouseEvent) => {
		if (preview) return;
		const uid = hitTestClient(e.clientX, e.clientY);
		if (uid) beginTextEdit(uid);
	};

	const zoomAt = (clientX: number, clientY: number, nextZoom: number) => {
		const vp = viewportRef.current!.getBoundingClientRect();
		const clamped = Math.min(4, Math.max(0.1, nextZoom));
		const px = clientX - vp.left;
		const py = clientY - vp.top;
		const sx = (px - pan.x) / zoom;
		const sy = (py - pan.y) / zoom;
		dispatch({
			type: "set-zoom",
			zoom: clamped,
			pan: { x: px - sx * clamped, y: py - sy * clamped },
		});
	};

	const onWheel = (e: React.WheelEvent) => {
		zoomAt(e.clientX, e.clientY, zoom * (e.deltaY < 0 ? 1.1 : 0.9));
	};

	const onContextMenuCapture = (e: React.MouseEvent) => {
		if (tool === "zoom") {
			e.preventDefault();
			e.stopPropagation();
			zoomAt(e.clientX, e.clientY, zoom * ZOOM_OUT_FACTOR);
		}
	};

	/* ---------------- Kontextmenü ---------------- */

	const ctxPos = React.useRef({ x: 0, y: 0 });
	const imageInputRef = React.useRef<HTMLInputElement>(null);

	const addElement = (kind: CreateKind) => {
		// "New image" öffnet wie ingame einen Datei-Dialog
		if (kind === "image") {
			imageInputRef.current?.click();
			return;
		}
		const el = newElement(page, kind, ctxPos.current);
		dispatch({
			type: "set-page",
			page: { ...page, blocks: [...page.blocks, el] },
		});
		dispatch({ type: "select", uids: [el._uid] });
	};

	const addImageFromFile = async (file: File) => {
		const name = sanitizeImageName(file.name) || "image";
		await saveAsset(`img:${name}`, file);
		let size = { width: 128, height: 128 };
		try {
			const natural = await readImageSize(file);
			// auf max. 512px skaliert, Seitenverhältnis erhalten
			const k = Math.min(1, 512 / Math.max(natural.width, natural.height));
			size = {
				width: Math.round(natural.width * k),
				height: Math.round(natural.height * k),
			};
		} catch {
			/* Größe nicht lesbar → Default */
		}
		const el = {
			...newElement(page, "image", ctxPos.current),
			image: name,
			size,
		};
		dispatch({
			type: "set-page",
			page: { ...page, blocks: [...page.blocks, el] },
		});
		dispatch({ type: "select", uids: [el._uid] });
	};

	const pasteClipboard = () => {
		if (state.clipboard.length === 0) return;
		const clones = cloneWithNewUids(state.clipboard).map((el, i) => ({
			...el,
			position: {
				x: Math.round(ctxPos.current.x) + i * 10,
				y: Math.round(ctxPos.current.y) + i * 10,
			},
		}));
		dispatch({
			type: "set-page",
			page: { ...page, blocks: [...page.blocks, ...clones] },
		});
		dispatch({ type: "select", uids: clones.map((c) => c._uid) });
	};

	/* ---------------- Overlays ---------------- */

	const selRects = selection
		.map((uid) => {
			const el = findByUid(page.blocks, uid);
			const rect = stageRect(uid);
			return el && rect ? { uid, rect, el } : null;
		})
		.filter(Boolean) as { uid: string; rect: Rect; el: EditorElement }[];

	const hoveredRect =
		hovered && !selection.includes(hovered)
			? (() => {
					const rect = stageRect(hovered);
					return rect ? { uid: hovered, rect } : null;
				})()
			: null;

	const showHandles =
		!preview &&
		selection.length === 1 &&
		(tool === "move" || tool === "scale" || tool === "align") &&
		selRects.length === 1 &&
		!selRects[0].el._locked;

	const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
	const handlePos = (h: string, r: Rect) => ({
		left: r.x + (h.includes("w") ? 0 : h.includes("e") ? r.w : r.w / 2),
		top: r.y + (h.includes("n") ? 0 : h.includes("s") ? r.h : r.h / 2),
	});

	const alignElement = (
		hz?: "left" | "center" | "right",
		vt?: "top" | "center" | "bottom",
	) => {
		if (selRects.length === 0) return;
		let blocks = page.blocks;
		for (const { uid, rect, el } of selRects) {
			if (el._locked) continue;
			const relX = evalNumExpr(el.position?.x);
			const relY = evalNumExpr(el.position?.y);
			const offX = rect.x - relX;
			const offY = rect.y - relY;
			let nx = relX;
			let ny = relY;
			if (hz === "left") nx = 0 - offX;
			if (hz === "center") nx = (screenW - rect.w) / 2 - offX;
			if (hz === "right") nx = screenW - rect.w - offX;
			if (vt === "top") ny = 0 - offY;
			if (vt === "center") ny = (screenH - rect.h) / 2 - offY;
			if (vt === "bottom") ny = screenH - rect.h - offY;
			blocks = updateByUid(blocks, uid, {
				position: { x: Math.round(nx), y: Math.round(ny) },
			});
		}
		dispatch({ type: "set-page", page: { ...page, blocks } });
	};

	const sortedBlocks = React.useMemo(
		() =>
			[...page.blocks].sort(
				(a, b) => evalNumExpr(a.layer) - evalNumExpr(b.layer),
			),
		[page.blocks],
	);

	const cursorClass = preview
		? ""
		: state.picking
			? "cursor-crosshair"
			: tool === "zoom"
			? "cursor-zoom-in"
			: tool === "fill" || tool === "picker"
				? "cursor-crosshair"
				: tool === "text"
					? "cursor-text"
					: drag.kind === "move"
						? "cursor-grabbing"
						: hovered
							? "cursor-move"
							: "cursor-default";

	const hoveredEl = hovered ? findByUid(page.blocks, hovered) : null;

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<div
					ref={viewportRef}
					className={cn(
						"relative flex-1 touch-none overflow-hidden bg-[#050505]",
						cursorClass,
					)}
					onPointerDown={onPointerDown}
					onPointerMove={onPointerMove}
					onPointerUp={onPointerUp}
					onPointerLeave={() => setHovered(null)}
					onDoubleClick={onDoubleClick}
					onWheel={onWheel}
					onContextMenuCapture={onContextMenuCapture}
					onContextMenu={(e) => {
						ctxPos.current = toStage(e.clientX, e.clientY);
					}}
					data-testid="uui-canvas"
				>
					{state.picking && (
						<div className="-translate-x-1/2 absolute top-2 left-1/2 z-50 bg-primary px-3 py-1 text-primary-foreground text-xs shadow">
							Element anklicken, um es einzuhängen — Esc bricht ab
						</div>
					)}
					<input
						ref={imageInputRef}
						type="file"
						accept="image/png,image/jpeg,image/webp"
						className="hidden"
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) addImageFromFile(file);
							e.target.value = "";
						}}
					/>
					<div
						className="absolute origin-top-left"
						style={{
							transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
							width: viewW,
							height: screenH,
						}}
					>
						<StageBackground bg={state.canvasBg} />
						{sortedBlocks.map((el) => (
							<ElementView
								key={el._uid}
								el={el}
								editMode={!preview}
								anchorDx={anchorDxFor(el)}
							/>
						))}

						{/* Hover-Highlight */}
						{!preview && hoveredRect && drag.kind === "none" && (
							<div
								className="pointer-events-none absolute border border-white/50"
								style={{
									left: hoveredRect.rect.x,
									top: hoveredRect.rect.y,
									width: hoveredRect.rect.w,
									height: hoveredRect.rect.h,
									zIndex: 99998,
								}}
							/>
						)}

						{/* Interaktivitäts-Badge am gehoverten Element */}
						{!preview && hoveredRect && hoveredEl && drag.kind === "none" && (
							<div
								className="pointer-events-none absolute flex items-center gap-0.5 bg-neutral-900/90 px-1 py-0.5 text-[10px]"
								style={{
									left: hoveredRect.rect.x,
									top: hoveredRect.rect.y - 18 / zoom,
									zIndex: 99999,
									transform: `scale(${1 / zoom})`,
									transformOrigin: "bottom left",
								}}
							>
								{isInteractive(hoveredEl) ? (
									<>
										<Zap className="size-3 text-amber-400" />
										<span className="text-amber-300">
											{hoveredEl.actions?.length
												? `${hoveredEl.actions.length} action${hoveredEl.actions.length > 1 ? "s" : ""}`
												: "hover"}
										</span>
									</>
								) : (
									<>
										<MousePointerClick className="size-3 text-neutral-500" />
										<span className="text-neutral-500">no interaction</span>
									</>
								)}
								<span className="ml-1 text-neutral-400">
									{hoveredEl.name || hoveredEl.id || hoveredEl.type}
								</span>
							</div>
						)}

						{/* Selektionsrahmen */}
						{!preview &&
							selRects.map(({ uid, rect, el }) => (
								<React.Fragment key={uid}>
									<div
										className={cn(
											"pointer-events-none absolute border",
											el._locked ? "border-red-400/70" : "border-blue-400",
										)}
										style={{
											left: rect.x,
											top: rect.y,
											width: rect.w,
											height: rect.h,
											zIndex: 100000,
										}}
									/>
									{el._locked && (
										<div
											className="pointer-events-none absolute bg-neutral-900/90 p-0.5"
											style={{
												left: rect.x + rect.w - 16 / zoom,
												top: rect.y,
												zIndex: 100001,
												transform: `scale(${1 / zoom})`,
												transformOrigin: "top right",
											}}
										>
											<Lock className="size-3 text-red-400" />
										</div>
									)}
								</React.Fragment>
							))}

					{/* Resize-Handles (bei Selektion in Move/Scale/Align) */}
						{showHandles &&
							HANDLES.map((h) => (
								<div
									key={h}
									className="absolute border border-blue-300 bg-blue-500"
									style={{
										...handlePos(h, selRects[0].rect),
										width: 8 / zoom,
										height: 8 / zoom,
										marginLeft: -4 / zoom,
										marginTop: -4 / zoom,
										zIndex: 100002,
										cursor: `${h}-resize`,
									}}
									onPointerDown={(e) => {
										e.stopPropagation();
										const { x: sx, y: sy } = toStage(e.clientX, e.clientY);
										capture(e);
										// Resize rechnet auf der LOGISCHEN Box (position/size)
										const logical =
											rects.find((r) => r.uid === selRects[0].uid)?.rect ??
											selRects[0].rect;
										dispatch({ type: "tx-begin" });
										setDrag({
											kind: "resize",
											pointerId: e.pointerId,
											handle: h,
											startX: sx,
											startY: sy,
											origin: logical,
											originRel: {
												x: evalNumExpr(selRects[0].el.position?.x),
												y: evalNumExpr(selRects[0].el.position?.y),
											},
											uid: selRects[0].uid,
										});
									}}
								/>
							))}

						{/* Align-Buttons (Align-Tool) */}
						{!preview && tool === "align" && selRects.length > 0 && (
							<div
								className="absolute flex gap-1 bg-neutral-900/95 p-1 shadow"
								style={{
									left: selRects[0].rect.x,
									top: selRects[0].rect.y - 38 / zoom,
									zIndex: 100003,
									transform: `scale(${1 / zoom})`,
									transformOrigin: "bottom left",
								}}
								onPointerDown={(e) => e.stopPropagation()}
							>
								{(
									[
										["⇤", () => alignElement("left", undefined)],
										["↔", () => alignElement("center", undefined)],
										["⇥", () => alignElement("right", undefined)],
										["⤒", () => alignElement(undefined, "top")],
										["↕", () => alignElement(undefined, "center")],
										["⤓", () => alignElement(undefined, "bottom")],
									] as const
								).map(([label, fn], i) => (
									<button
										key={i}
										type="button"
										className="flex size-7 items-center justify-center bg-neutral-800 text-neutral-200 text-sm hover:bg-neutral-700"
										onClick={fn}
									>
										{label}
									</button>
								))}
							</div>
						)}

						{/* Smart Guides (Photoshop-artige Ausrichtlinien) */}
						{guides?.x !== null && guides?.x !== undefined && (
							<div
								className="pointer-events-none absolute bg-pink-500"
								style={{
									left: guides.x,
									top: 0,
									width: Math.max(1, 1 / zoom),
									height: screenH,
									zIndex: 100008,
								}}
							/>
						)}
						{guides?.y !== null && guides?.y !== undefined && (
							<div
								className="pointer-events-none absolute bg-pink-500"
								style={{
									left: 0,
									top: guides.y,
									width: viewW,
									height: Math.max(1, 1 / zoom),
									zIndex: 100008,
								}}
							/>
						)}

						{/* Marquee */}
						{drag.kind === "marquee" && (
							<div
								className="pointer-events-none absolute border border-blue-400 bg-blue-400/10"
								style={{
									left: Math.min(drag.startX, drag.curX),
									top: Math.min(drag.startY, drag.curY),
									width: Math.abs(drag.curX - drag.startX),
									height: Math.abs(drag.curY - drag.startY),
									zIndex: 100004,
								}}
							/>
						)}

						{/* Inline-Text-Editing */}
						{textEdit &&
							(() => {
								const r = rects.find((r) => r.uid === textEdit.uid);
								if (!r) return null;
								const commit = () => {
									dispatch({
										type: "set-page",
										page: {
											...page,
											blocks: updateByUid(page.blocks, textEdit.uid, {
												text: patchTextMarkup(
													findByUid(page.blocks, textEdit.uid)?.text,
													{ body: textEdit.value },
												),
											}),
										},
									});
									setTextEdit(null);
								};
								return (
									<textarea
										autoFocus
										className="absolute resize border border-blue-400 bg-neutral-900/95 px-1 text-neutral-100 outline-none"
										style={{
											left: r.rect.x,
											top: r.rect.y,
											minWidth: 240,
											minHeight: 36,
											fontFamily: '"Monocraft", monospace',
											fontSize: Math.max(12, r.rect.h * 0.16),
											zIndex: 100005,
										}}
										value={textEdit.value}
										onChange={(e) =>
											setTextEdit({ ...textEdit, value: e.target.value })
										}
										onPointerDown={(e) => e.stopPropagation()}
										onKeyDown={(e) => {
											if (e.key === "Enter" && !e.shiftKey) {
												e.preventDefault();
												commit();
											}
											if (e.key === "Escape") setTextEdit(null);
										}}
										onBlur={commit}
									/>
								);
							})()}
					</div>
				</div>
			</ContextMenuTrigger>
			{!preview && (
				<ContextMenuContent>
					<ContextMenuItem onClick={() => addElement("block")}>
						New block
					</ContextMenuItem>
					<ContextMenuItem onClick={() => addElement("text")}>
						New text
					</ContextMenuItem>
					<ContextMenuItem onClick={() => addElement("item")}>
						New item
					</ContextMenuItem>
					<ContextMenuItem onClick={() => addElement("image")}>
						New image
					</ContextMenuItem>
					<ContextMenuSeparator />
					<ContextMenuItem onClick={() => addElement("rounded")}>
						New rounded block
					</ContextMenuItem>
					<ContextMenuItem onClick={() => addElement("hitbox")}>
						New hitbox
					</ContextMenuItem>
					<ContextMenuItem onClick={() => addElement("grid_block")}>
						New grid (layout)
					</ContextMenuItem>
					<ContextMenuItem onClick={() => addElement("component")}>
						New component ref
					</ContextMenuItem>
					<ContextMenuSeparator />
					<ContextMenuItem
						disabled={state.clipboard.length === 0}
						onClick={pasteClipboard}
					>
						Paste
					</ContextMenuItem>
				</ContextMenuContent>
			)}
		</ContextMenu>
	);
}
