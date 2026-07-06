"use client";

import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
	parseTextMarkup,
	patchTextMarkup,
} from "@/lib/uui/textstyle";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { evalNumExpr } from "@/lib/uui/expr";
import {
	absolutePosition,
	findByUid,
	flatten,
	moveInSiblings,
	nestInto,
	newUid,
	unnest,
	updateByUid,
} from "@/lib/uui/tree";
import type {
	EditorElement,
	EditorGroup,
	EditorPage,
	UuiAction,
	UuiActionType,
} from "@/lib/uui/types";
import { cn } from "@/lib/utils";
import {
	sanitizeImageName,
	saveAsset,
	useAssetUrl,
} from "@/lib/uui/assets";
import { allEffectNames } from "@/lib/uui/effects";
import {
	ArrowDown,
	ArrowUp,
	ChevronDown,
	ChevronRight,
	Eye,
	EyeOff,
	FileUp,
	FolderPlus,
	Lock,
	LockOpen,
	MoreHorizontal,
	MousePointerClick,
	Plus,
	Trash2,
} from "lucide-react";
import React from "react";
import { useEditor } from "./store";

/* ------------------------------------------------------------------ */
/* Eingabe-Bausteine (alle mit optionalem hint-Tooltip)                 */
/* ------------------------------------------------------------------ */

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
	if (!hint)
		return (
			<Label className="w-16 shrink-0 text-muted-foreground text-xs">
				{label}
			</Label>
		);
	// Tooltip-Trigger nur auf dem Text selbst, nicht auf der ganzen Label-Spalte
	return (
		<Label className="w-16 shrink-0 text-muted-foreground text-xs">
			<Tooltip>
				<TooltipTrigger asChild>
					<span className="cursor-help">{label}</span>
				</TooltipTrigger>
				<TooltipContent side="left" className="max-w-56">
					{hint}
				</TooltipContent>
			</Tooltip>
		</Label>
	);
}

/** Untergruppe innerhalb einer Sektion — Überschrift + eingerückte Zeilen. */
function SubGroup({
	title,
	hint,
	children,
}: {
	title: string;
	hint?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="mt-1 flex flex-col gap-1">
			{hint ? (
				<Tooltip>
					<TooltipTrigger asChild>
						<p className="w-fit cursor-help font-medium text-[10px] text-muted-foreground uppercase">
							{title}
						</p>
					</TooltipTrigger>
					<TooltipContent side="left" className="max-w-56">
						{hint}
					</TooltipContent>
				</Tooltip>
			) : (
				<p className="font-medium text-[10px] text-muted-foreground uppercase">
					{title}
				</p>
			)}
			<div className="flex flex-col gap-1.5 border-border/60 border-l-2 pl-2.5">
				{children}
			</div>
		</div>
	);
}

function ExprInput({
	label,
	value,
	onCommit,
	hint,
}: {
	label: string;
	value: unknown;
	onCommit: (v: number | string) => void;
	hint?: string;
}) {
	const [draft, setDraft] = React.useState(
		value === undefined || value === null ? "" : String(value),
	);
	React.useEffect(() => {
		setDraft(value === undefined || value === null ? "" : String(value));
	}, [value]);

	const commit = () => {
		const num = Number(draft);
		onCommit(draft.trim() !== "" && !Number.isNaN(num) ? num : draft);
	};

	return (
		<div className="flex items-center gap-1">
			<FieldLabel label={label} hint={hint} />
			<Input
				className="h-7 text-xs"
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={commit}
				onKeyDown={(e) => e.key === "Enter" && commit()}
			/>
		</div>
	);
}

function TextInput({
	label,
	value,
	onCommit,
	placeholder,
	hint,
}: {
	label: string;
	value: string | undefined;
	onCommit: (v: string) => void;
	placeholder?: string;
	hint?: string;
}) {
	const [draft, setDraft] = React.useState(value ?? "");
	React.useEffect(() => setDraft(value ?? ""), [value]);
	return (
		<div className="flex items-center gap-1">
			<FieldLabel label={label} hint={hint} />
			<Input
				className="h-7 text-xs"
				placeholder={placeholder}
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={() => onCommit(draft)}
				onKeyDown={(e) => e.key === "Enter" && onCommit(draft)}
			/>
		</div>
	);
}

function SwitchRow({
	label,
	checked,
	onChange,
	hint,
}: {
	label: string;
	checked: boolean;
	onChange: (v: boolean) => void;
	hint?: string;
}) {
	return (
		<div className="flex items-center justify-between py-0.5">
			<FieldLabel label={label} hint={hint} />
			<Switch checked={checked} onCheckedChange={onChange} />
		</div>
	);
}

function SelectRow({
	label,
	value,
	options,
	onChange,
	hint,
}: {
	label: string;
	value: string;
	options: { value: string; label: string }[];
	onChange: (v: string) => void;
	hint?: string;
}) {
	return (
		<div className="flex items-center gap-1">
			<FieldLabel label={label} hint={hint} />
			<Select value={value} onValueChange={onChange}>
				<SelectTrigger className="h-7 w-full text-xs">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{options.map((o) => (
						<SelectItem key={o.value} value={o.value}>
							{o.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

/**
 * Farbfeld mit nativem Picker. Während des Ziehens im Picker feuern
 * input-Events im Millisekundentakt — die gehen gedrosselt (~90ms) über
 * onLive (transiente Updates ohne History-Spam); erst das Schließen des
 * Pickers (natives change-Event) committet final über onCommit.
 */
function ColorField({
	label,
	value,
	onCommit,
	onLive,
	allowNone,
	hint,
}: {
	label: string;
	value: string | undefined;
	onCommit: (v: string | undefined) => void;
	/** transientes Update während des Farbziehens (ohne Undo-Eintrag) */
	onLive?: (v: string) => void;
	allowNone?: boolean;
	hint?: string;
}) {
	const isNone = value === "none";
	const hex = (value ?? "").replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
	const pickerRef = React.useRef<HTMLInputElement>(null);
	const commitRef = React.useRef(onCommit);
	commitRef.current = onCommit;
	const liveRef = React.useRef(onLive);
	liveRef.current = onLive;
	const lastLive = React.useRef(0);

	React.useEffect(() => {
		const el = pickerRef.current;
		if (!el) return;
		// natives change = Picker geschlossen → finaler Commit (1 Undo-Schritt)
		const onNativeChange = () =>
			commitRef.current(el.value.replace("#", ""));
		el.addEventListener("change", onNativeChange);
		return () => el.removeEventListener("change", onNativeChange);
	}, []);

	return (
		<div className="flex items-center gap-1">
			<FieldLabel label={label} hint={hint} />
			<label
				className="size-6 shrink-0 cursor-pointer border border-border"
				style={{
					backgroundColor:
						hex && !isNone ? `#${hex.padEnd(6, "0")}` : "transparent",
				}}
			>
				<input
					ref={pickerRef}
					type="color"
					className="invisible size-0"
					value={`#${(hex && !isNone ? hex : "ffffff").padEnd(6, "0")}`}
					onChange={(e) => {
						const v = e.target.value.replace("#", "");
						const now = Date.now();
						if (now - lastLive.current < 90) return;
						lastLive.current = now;
						if (liveRef.current) liveRef.current(v);
						else commitRef.current(v);
					}}
				/>
			</label>
			<Input
				className="h-7 text-xs"
				placeholder={allowNone ? "hex / none / leer" : "hex / leer"}
				value={value ?? ""}
				onChange={(e) => {
					const v = e.target.value.trim();
					if (v === "") onCommit(undefined);
					else if (allowNone && v.toLowerCase() === "none") onCommit("none");
					else onCommit(v.replace("#", ""));
				}}
			/>
		</div>
	);
}

/** Bildname + Upload/Replace + Vorschau (Asset landet im lokalen Store und
 *  beim ZIP-Export unter contents/images/<name>.png). */
function ImageField({
	label,
	name,
	onCommit,
	hint,
}: {
	label: string;
	name: string | undefined;
	onCommit: (v: string) => void;
	hint?: string;
}) {
	const fileRef = React.useRef<HTMLInputElement>(null);
	const url = useAssetUrl(name ? `img:${name}` : undefined);

	const upload = async (file: File) => {
		const clean = sanitizeImageName(file.name) || "image";
		await saveAsset(`img:${clean}`, file);
		onCommit(clean);
	};

	return (
		<div className="flex items-center gap-1">
			<FieldLabel label={label} hint={hint} />
			{url ? (
				<img
					src={url}
					alt={name}
					className="size-6 shrink-0 border border-border object-cover"
				/>
			) : (
				<span className="flex size-6 shrink-0 items-center justify-center border border-border border-dashed text-[10px] text-muted-foreground">
					🖼
				</span>
			)}
			<Input
				className="h-7 text-xs"
				placeholder="image_name"
				value={name ?? ""}
				onChange={(e) => onCommit(e.target.value)}
			/>
			<Button
				size="icon-sm"
				variant="outline"
				aria-label={`Upload ${label}`}
				onClick={() => fileRef.current?.click()}
			>
				<FileUp />
			</Button>
			<input
				ref={fileRef}
				type="file"
				accept="image/png,image/jpeg,image/webp"
				className="hidden"
				onChange={(e) => {
					const f = e.target.files?.[0];
					if (f) upload(f);
					e.target.value = "";
				}}
			/>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/* Collapsible-Sektion                                                  */
/* ------------------------------------------------------------------ */

function Section({
	title,
	open,
	onOpenChange,
	children,
	badge,
}: {
	title: string;
	open: boolean;
	onOpenChange: (v: boolean) => void;
	children: React.ReactNode;
	badge?: string;
}) {
	return (
		<Collapsible open={open} onOpenChange={onOpenChange}>
			<CollapsibleTrigger className="flex w-full items-center gap-1 border-border border-b bg-muted/40 px-2 py-1.5 font-medium text-xs hover:bg-muted">
				{open ? (
					<ChevronDown className="size-3" />
				) : (
					<ChevronRight className="size-3" />
				)}
				{title}
				{badge && (
					<span className="ml-auto text-[10px] text-muted-foreground">
						{badge}
					</span>
				)}
			</CollapsibleTrigger>
			<CollapsibleContent className="flex flex-col gap-1.5 border-border border-b p-2">
				{children}
			</CollapsibleContent>
		</Collapsible>
	);
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                              */
/* ------------------------------------------------------------------ */

type SectionKey = "general" | "design" | "actions" | "animation";

export default function Sidebar() {
	const { state, dispatch } = useEditor();
	const { page, selection, tool } = state;
	const selected =
		selection.length === 1 ? findByUid(page.blocks, selection[0]) : null;

	const [tab, setTab] = React.useState<"properties" | "layers">("properties");
	// ziehbare Breite (linke Kante), persistiert
	const [width, setWidth] = React.useState(() => {
		if (typeof window === "undefined") return 288;
		const stored = Number(localStorage.getItem("uui:sidebarWidth"));
		return stored >= 240 && stored <= 560 ? stored : 288;
	});
	const resizeRef = React.useRef<{ startX: number; startW: number } | null>(
		null,
	);
	const [open, setOpen] = React.useState<Record<SectionKey, boolean>>({
		general: true,
		design: true,
		actions: false,
		animation: false,
	});

	// Action-/Animation-Tool klappen die passende Sektion auf
	React.useEffect(() => {
		if (tool === "actions") {
			setTab("properties");
			setOpen((o) => ({ ...o, actions: true }));
		}
		if (tool === "animation") {
			setTab("properties");
			setOpen((o) => ({ ...o, animation: true }));
		}
	}, [tool]);

	const patch = (p: Partial<EditorElement>) => {
		if (!selected) return;
		dispatch({
			type: "set-page",
			page: { ...page, blocks: updateByUid(page.blocks, selected._uid, p) },
		});
	};

	/** Patch für ein beliebiges Element per uid (z.B. Grid-Kinder). */
	const patchByUid = (uid: string, p: Partial<EditorElement>) => {
		dispatch({
			type: "set-page",
			page: { ...page, blocks: updateByUid(page.blocks, uid, p) },
		});
	};

	/** Transientes Update während Color-Drags (kein Undo-Eintrag). */
	const patchLive = (p: Partial<EditorElement>) => {
		if (!selected) return;
		dispatch({ type: "tx-begin" });
		dispatch({
			type: "tx-set-page",
			page: { ...page, blocks: updateByUid(page.blocks, selected._uid, p) },
		});
	};
	/** Finaler Commit: schließt eine Live-Transaktion (1 Undo-Schritt) oder
	 *  verhält sich ohne laufende Transaktion wie patch(). */
	const patchFinal = (p: Partial<EditorElement>) => {
		if (!selected) return;
		if (state.txSnapshot) {
			dispatch({
				type: "tx-set-page",
				page: { ...page, blocks: updateByUid(page.blocks, selected._uid, p) },
			});
			dispatch({ type: "tx-end" });
		} else {
			patch(p);
		}
	};

	return (
		<div
			className="relative flex shrink-0 flex-col border-border border-l bg-background"
			style={{ width }}
			data-testid="uui-sidebar"
		>
			{/* Resize-Griff an der linken Kante */}
			<div
				className="absolute top-0 left-0 z-20 h-full w-1.5 cursor-col-resize transition-colors hover:bg-primary/50"
				role="separator"
				aria-orientation="vertical"
				aria-label="Resize sidebar"
				onPointerDown={(e) => {
					e.preventDefault();
					try {
						e.currentTarget.setPointerCapture(e.pointerId);
					} catch {
						/* synthetische Events */
					}
					resizeRef.current = { startX: e.clientX, startW: width };
				}}
				onPointerMove={(e) => {
					const r = resizeRef.current;
					if (!r) return;
					setWidth(
						Math.min(560, Math.max(240, r.startW + (r.startX - e.clientX))),
					);
				}}
				onPointerUp={(e) => {
					const r = resizeRef.current;
					resizeRef.current = null;
					if (!r) return;
					const w = Math.min(
						560,
						Math.max(240, r.startW + (r.startX - e.clientX)),
					);
					try {
						localStorage.setItem("uui:sidebarWidth", String(w));
					} catch {
						/* Storage blockiert */
					}
				}}
			/>
			<Tabs
				value={tab}
				onValueChange={(v) => setTab(v as typeof tab)}
				className="w-full"
			>
				<TabsList className="w-full rounded-none">
					<TabsTrigger value="properties">Properties</TabsTrigger>
					<TabsTrigger value="layers">Layers</TabsTrigger>
				</TabsList>
			</Tabs>
			<div className="flex-1 overflow-y-auto">
				{tab === "layers" ? (
					<LayersPanel />
				) : !selected ? (
					<p className="p-3 text-muted-foreground text-xs">
						{selection.length > 1
							? `${selection.length} elements selected — properties editing works on a single element.`
							: "Select an element to edit its properties."}
					</p>
				) : (
					<>
						<Section
							title="General"
							open={open.general}
							onOpenChange={(v) => setOpen({ ...open, general: v })}
						>
							<GeneralSection el={selected} patch={patch} />
						</Section>
						<Section
							title="Design"
							open={open.design}
							onOpenChange={(v) => setOpen({ ...open, design: v })}
						>
							<DesignSection
								el={selected}
								patch={patch}
								patchLive={patchLive}
								patchFinal={patchFinal}
								patchByUid={patchByUid}
								page={page}
							/>
						</Section>
						<Section
							title="Actions"
							open={open.actions}
							onOpenChange={(v) => setOpen({ ...open, actions: v })}
							badge={
								selected.actions?.length
									? `${selected.actions.length}`
									: undefined
							}
						>
							<ActionsSection el={selected} patch={patch} />
						</Section>
						<Section
							title="Animation"
							open={open.animation}
							onOpenChange={(v) => setOpen({ ...open, animation: v })}
							badge={animationBadge(selected)}
						>
							<AnimationSection el={selected} />
						</Section>
					</>
				)}
			</div>
		</div>
	);
}

/* ---------------- General ---------------- */

function GeneralSection({
	el,
	patch,
}: {
	el: EditorElement;
	patch: (p: Partial<EditorElement>) => void;
}) {
	return (
		<>
			<TextInput
				label="Name"
				hint="Anzeigename im Editor/Layers-Panel — reine Organisation."
				value={el.name}
				onCommit={(v) => patch({ name: v })}
			/>
			<TextInput
				label="ID"
				hint="Technische Kennung des Elements — wird von API/Skript-Events und Effekten referenziert."
				value={el.id}
				onCommit={(v) => patch({ id: v })}
			/>
			{el.type === "text" && (
				<TextContentField
					value={el.text}
					onCommit={(v) => patch({ text: v })}
				/>
			)}
			<SwitchRow
				label="Visible"
				hint="Blendet das Element aus (Export: visible: false)."
				checked={!el._hidden}
				onChange={(v) => patch({ _hidden: !v })}
			/>
			<SwitchRow
				label="Enabled"
				hint="Aus = Element wird ingame komplett deaktiviert (enabled: false), auch nicht klickbar."
				checked={el.enabled !== false}
				onChange={(v) => patch({ enabled: v ? undefined : false })}
			/>
			<SwitchRow
				label="Locked"
				hint="Gesperrt: nicht per Klick auswähl- oder verschiebbar (Export: locked: true)."
				checked={!!el._locked}
				onChange={(v) => patch({ _locked: v })}
			/>
			<div className="grid grid-cols-2 gap-1">
				<ExprInput
					label="X"
					hint="Horizontale Position in px (Screen 0 = links). Auch Ausdrücke (1920/2) und Placeholder erlaubt."
					value={el.position?.x ?? 0}
					onCommit={(v) => patch({ position: { x: v, y: el.position?.y ?? 0 } })}
				/>
				<ExprInput
					label="Y"
					hint="Vertikale Position in px (0 = oben). Auch Ausdrücke und Placeholder erlaubt."
					value={el.position?.y ?? 0}
					onCommit={(v) => patch({ position: { x: el.position?.x ?? 0, y: v } })}
				/>
				<ExprInput
					label="Width"
					hint="Breite in px. Bei Text-Elementen steuert size die Schriftgröße."
					value={el.size?.width ?? 0}
					onCommit={(v) =>
						patch({
							size: { ...el.size, width: v, height: el.size?.height ?? 0 },
						})
					}
				/>
				<ExprInput
					label="Height"
					hint="Höhe in px. Bei Text-Elementen steuert size die Schriftgröße."
					value={el.size?.height ?? 0}
					onCommit={(v) =>
						patch({
							size: { ...el.size, width: el.size?.width ?? 0, height: v },
						})
					}
				/>
			</div>
			<ExprInput
				label="Rotation"
				hint="Drehung in Grad (im Uhrzeigersinn)."
				value={el.rotation ?? 0}
				onCommit={(v) => patch({ rotation: v === 0 ? undefined : v })}
			/>
			{(el.rotation !== undefined || el.pivot) && (
				<div className="grid grid-cols-2 gap-1">
					<ExprInput
						label="Pivot X"
						hint="Drehpunkt X relativ zum Element (leer = Mitte)."
						value={el.pivot?.x ?? ""}
						onCommit={(v) =>
							patch({
								pivot:
									v === "" && el.pivot?.y === undefined
										? undefined
										: { ...el.pivot, x: v === "" ? undefined : v },
							})
						}
					/>
					<ExprInput
						label="Pivot Y"
						hint="Drehpunkt Y relativ zum Element (leer = Mitte)."
						value={el.pivot?.y ?? ""}
						onCommit={(v) =>
							patch({
								pivot:
									v === "" && el.pivot?.x === undefined
										? undefined
										: { ...el.pivot, y: v === "" ? undefined : v },
							})
						}
					/>
				</div>
			)}
			<ExprInput
				label="Layer"
				hint="Z-Reihenfolge: höhere Werte liegen weiter vorn. Negative Werte erlaubt."
				value={el.layer ?? 0}
				onCommit={(v) => patch({ layer: v })}
			/>
			<SelectRow
				label="Aligned"
				hint="HUD-Verankerung: bei left/right bleibt das Element bei anderen Bildschirm-Seitenverhältnissen an dieser Kante kleben."
				value={el.aligned ?? "default"}
				options={[
					{ value: "default", label: "default" },
					{ value: "left", label: "left (HUD)" },
					{ value: "right", label: "right (HUD)" },
				]}
				onChange={(v) => patch({ aligned: v === "default" ? undefined : v })}
			/>
			<ExprInput
				label="Repeat ×"
				hint="loop: Element wird N-mal erzeugt (max 2048). {counter} im Text/ID wird pro Kopie durch 0,1,2… ersetzt. Ideal in einem Grid: N Kopien ordnen sich automatisch an."
				value={el.loop ?? ""}
				onCommit={(v) => patch({ loop: v === "" ? undefined : v })}
			/>
			<TextInput
				label="Visib. %"
				hint="Placeholder-Bedingung: Element ist nur sichtbar, wenn sie erfüllt ist, z.B. %player_health%=20."
				value={el.visibility?.placeholder}
				placeholder="%player_health%=20"
				onCommit={(v) =>
					patch({
						visibility: v ? { ...el.visibility, placeholder: v } : undefined,
					})
				}
			/>
		</>
	);
}

/** Mehrzeiliges Text-Inhalt-Feld: zeigt NUR den reinen Text (Body) — Farbe,
 *  Font und Formatierung werden über eigene Controls gesteuert und beim
 *  Speichern wieder als Markup vorangestellt. */
function TextContentField({
	value,
	onCommit,
}: {
	value: string | undefined;
	onCommit: (markup: string) => void;
}) {
	const body = React.useMemo(() => parseTextMarkup(value).body, [value]);
	const [draft, setDraft] = React.useState(body);
	React.useEffect(() => setDraft(body), [body]);
	return (
		<div className="flex items-start gap-1">
			<FieldLabel
				label="Text"
				hint="Der reine Textinhalt. Farbe/Fett/usw. stellst du unter Design → Text ein — das Markup (<#hex>, &l …) wird beim Speichern automatisch erzeugt. Placeholder wie %player_name% sind erlaubt."
			/>
			<Textarea
				className="min-h-14 font-mono text-xs"
				placeholder="Hello %player_name%"
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={() => onCommit(patchTextMarkup(value, { body: draft }))}
				onKeyDown={(e) => {
					if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
						e.preventDefault();
						onCommit(patchTextMarkup(value, { body: draft }));
					}
				}}
			/>
		</div>
	);
}

/** Formatierungs-Toggles wie in Word: Fett/Kursiv/Unterstrichen/… */
function TextFormatToggles({
	el,
	patch,
}: {
	el: EditorElement;
	patch: (p: Partial<EditorElement>) => void;
}) {
	const style = parseTextMarkup(el.text);
	const toggle = (key: "bold" | "italic" | "underlined" | "strikethrough" | "obfuscated") =>
		patch({ text: patchTextMarkup(el.text, { [key]: !style[key] }) });

	const buttons: {
		key: "bold" | "italic" | "underlined" | "strikethrough" | "obfuscated";
		label: string;
		title: string;
		className?: string;
	}[] = [
		{ key: "bold", label: "B", title: "Fett (&l)", className: "font-bold" },
		{ key: "italic", label: "I", title: "Kursiv (&o)", className: "italic" },
		{
			key: "underlined",
			label: "U",
			title: "Unterstrichen (&n)",
			className: "underline",
		},
		{
			key: "strikethrough",
			label: "S",
			title: "Durchgestrichen (&m)",
			className: "line-through",
		},
		{ key: "obfuscated", label: "✦", title: "Verwürfelt/Obfuscated (&k)" },
	];

	return (
		<div className="flex items-center gap-1">
			<FieldLabel
				label="Format"
				hint="Minecraft-Formatierung — wird als &-Codes vor den Text geschrieben."
			/>
			<div className="flex gap-0.5">
				{buttons.map((b) => (
					<Button
						key={b.key}
						size="icon-sm"
						variant={style[b.key] ? "secondary" : "outline"}
						aria-pressed={style[b.key]}
						title={b.title}
						className={b.className}
						onClick={() => toggle(b.key)}
					>
						{b.label}
					</Button>
				))}
			</div>
		</div>
	);
}

/* ---------------- Design ---------------- */

/** Effekt-Presets aus dem Plugin (effects/scale.yml, effects/transform.yml)
 *  + alle im aktuellen Projekt referenzierten Effektnamen. */
function collectEffectNames(page: EditorPage): string[] {
	const names = new Set<string>(allEffectNames());
	for (const el of flatten(page.blocks)) {
		if (el.hover?.effect) names.add(el.hover.effect);
		if (el.click?.effect) names.add(el.click.effect);
	}
	if (page.animation?.open?.effect) names.add(page.animation.open.effect);
	if (page.animation?.close?.effect) names.add(page.animation.close.effect);
	return [...names].sort();
}

function EffectSelect({
	label,
	value,
	page,
	onChange,
	hint,
}: {
	label: string;
	value: string | undefined;
	page: EditorPage;
	onChange: (v: string | undefined) => void;
	hint?: string;
}) {
	const [custom, setCustom] = React.useState(false);
	const known = collectEffectNames(page);
	const current = value ?? "none";
	const options = [
		{ value: "none", label: "none" },
		...known.map((n) => ({ value: n, label: n })),
		{ value: "__custom__", label: "custom…" },
	];
	if (value && !known.includes(value))
		options.splice(1, 0, { value, label: value });

	return (
		<>
			<SelectRow
				label={label}
				hint={hint}
				value={custom ? "__custom__" : current}
				options={options}
				onChange={(v) => {
					if (v === "__custom__") {
						setCustom(true);
						return;
					}
					setCustom(false);
					onChange(v === "none" ? undefined : v);
				}}
			/>
			{custom && (
				<TextInput
					label="↳ Name"
					value={value}
					placeholder="my_effect (contents/effects/)"
					onCommit={(v) => {
						onChange(v || undefined);
						setCustom(false);
					}}
				/>
			)}
		</>
	);
}

function DesignSection({
	el,
	patch,
	patchLive,
	patchFinal,
	patchByUid,
	page,
}: {
	el: EditorElement;
	patch: (p: Partial<EditorElement>) => void;
	patchLive: (p: Partial<EditorElement>) => void;
	patchFinal: (p: Partial<EditorElement>) => void;
	patchByUid: (uid: string, p: Partial<EditorElement>) => void;
	page: EditorPage;
}) {
	const { dispatch } = useEditor();
	const isRounded = el.type === "rounded" || el.type === "block_rounded";
	const roundingMode = typeof el.rounding === "string" ? el.rounding : "";
	return (
		<>
			<ColorField
				label="Color"
				hint="Grundfarbe des Elements als Hex ohne # (z.B. ff8800). Bei Text die Textfarbe."
				value={el.color}
				onLive={(v) => patchLive({ color: v })}
				onCommit={(v) => patchFinal({ color: v })}
			/>
			<ExprInput
				label="Opacity"
				hint="Deckkraft 0–255 (255 = voll sichtbar). 0 z.B. für unsichtbare Klick-Anker."
				value={el.opacity ?? 255}
				onCommit={(v) => patch({ opacity: v })}
			/>
			<ColorField
				label="Border"
				hint="Umrandungsfarbe (outline). Leer = keine Umrandung."
				value={el.outline?.color}
				onLive={(v) =>
					patchLive({
						outline: { size: el.outline?.size ?? 1, color: v },
					})
				}
				onCommit={(v) =>
					patchFinal({
						outline: v ? { size: el.outline?.size ?? 1, color: v } : undefined,
					})
				}
			/>
			{el.outline && (
				<ExprInput
					label="Bd. size"
					hint="Dicke der Umrandung in Pixeln."
					value={el.outline.size ?? 1}
					onCommit={(v) =>
						patch({ outline: { ...el.outline, size: Number(v) || 1 } })
					}
				/>
			)}
			{["block", "rounded", "block_rounded"].includes(el.type ?? "") && (
				<TextInput
					label="Unicode"
					hint="Interner Render-Glyph des Blocks (Standard: Plugin-Glyph). Nur relevant, wenn du eigene Resource-Pack-Glyphen nutzt — sonst leer/Standard lassen."
					value={el.unicode}
					placeholder="(Standard-Glyph)"
					onCommit={(v) => patch({ unicode: v || undefined })}
				/>
			)}
			{isRounded && (
				<SelectRow
					label="Rounding"
					hint="Stärke der Eckenrundung. 'default' nutzt die Ecken-Glyphen in der Elementfarbe."
					value={roundingMode || "default"}
					options={[
						{ value: "default", label: "default (Ecken-Unicode)" },
						{ value: "small", label: "small" },
						{ value: "regular", label: "regular" },
						{ value: "medium", label: "medium" },
						{ value: "large", label: "large" },
						{ value: "none", label: "none" },
					]}
					onChange={(v) =>
						patch({ rounding: v === "default" ? undefined : v })
					}
				/>
			)}

			<SubGroup
				title="Hover"
				hint="Was passiert, wenn der Spieler-Cursor über dem Element schwebt."
			>
				<ColorField
					label="Color"
					hint="Farbe beim Drüberfahren. 'none' = ausdrücklich kein Hover-Einfärben (bei klickbaren Elementen sonst automatisch)."
					value={el.hover?.color}
					allowNone
					onLive={(v) => patchLive({ hover: { ...el.hover, color: v } })}
					onCommit={(v) => {
						const hover = { ...el.hover, color: v };
						patchFinal({
							hover: Object.values(hover).some((x) => x !== undefined)
								? hover
								: undefined,
						});
					}}
				/>
				<EffectSelect
					label="Effect"
					hint="Effekt-Preset aus contents/effects/ (z.B. scale = kurz vergrößern), abgespielt solange gehovert wird."
					value={el.hover?.effect}
					page={page}
					onChange={(v) => {
						const hover = { ...el.hover, effect: v };
						patch({
							hover: Object.values(hover).some((x) => x !== undefined)
								? hover
								: undefined,
						});
					}}
				/>
				{(el.type === "image" || el.hover?.image) && (
					<TextInput
						label="Image"
						hint="Austauschbild beim Hovern (Name aus contents/images/), z.B. icon_active."
						value={el.hover?.image}
						placeholder="image_active"
						onCommit={(v) => {
							const hover = { ...el.hover, image: v || undefined };
							patch({
								hover: Object.values(hover).some((x) => x !== undefined)
									? hover
									: undefined,
							});
						}}
					/>
				)}
				<EffectSelect
					label="Click fx"
					hint="Effekt-Preset, das beim Anklicken abgespielt wird."
					value={el.click?.effect}
					page={page}
					onChange={(v) => patch({ click: v ? { effect: v } : undefined })}
				/>
			</SubGroup>

			<SubGroup
				title="Hitbox"
				hint="Der klickbare Bereich des Elements im Spiel."
			>
				<SwitchRow
					label="Clickable"
					hint="Aus = Element ignoriert den Cursor komplett (disable-hitbox), Klicks gehen durch."
					checked={!el["disable-hitbox"]}
					onChange={(v) => patch({ "disable-hitbox": v ? undefined : true })}
				/>
				<div className="grid grid-cols-2 gap-1">
					<ExprInput
						label="Off. X"
						hint="Verschiebt die Hitbox horizontal relativ zum Element (px)."
						value={el.hitbox?.x ?? ""}
						onCommit={(v) =>
							patch({
								hitbox:
									v === "" && el.hitbox?.y === undefined
										? undefined
										: { ...el.hitbox, x: v === "" ? undefined : v },
							})
						}
					/>
					<ExprInput
						label="Off. Y"
						hint="Verschiebt die Hitbox vertikal relativ zum Element (px)."
						value={el.hitbox?.y ?? ""}
						onCommit={(v) =>
							patch({
								hitbox:
									v === "" && el.hitbox?.x === undefined
										? undefined
										: { ...el.hitbox, y: v === "" ? undefined : v },
							})
						}
					/>
				</div>
			</SubGroup>

			{el.type === "text" && (
				<TextDesignGroup
					el={el}
					patch={patch}
					patchLive={patchLive}
					patchFinal={patchFinal}
				/>
			)}
			{(el.item || el.type === "item") && (
				<SubGroup title="Item">
					<TextInput
						label="Material"
						hint="Minecraft-Material (DIAMOND), Spielerkopf (PLAYER_HEAD:%player%) oder Custom-Items via ia:/nexo:/oraxen:/ce:-Präfix."
						value={el.item?.material}
						placeholder="PLAYER_HEAD:%player%"
						onCommit={(v) => patch({ item: { ...el.item, material: v } })}
					/>
					<ExprInput
						label="Model data"
						hint="Custom Model Data: Zahl, die ein eigenes Item-Modell aus dem Resource-Pack auswählt (custom_model_data). Leer = Standard-Modell."
						value={el.item?.custom_model_data ?? ""}
						onCommit={(v) =>
							patch({
								item: {
									...el.item,
									custom_model_data: v === "" ? undefined : Number(v),
								},
							})
						}
					/>
					<SwitchRow
						label="Glowing"
						hint="Verzauberungs-Glitzern auf dem Item (glint)."
						checked={!!el.item?.glowing}
						onChange={(v) =>
							patch({ item: { ...el.item, glowing: v || undefined } })
						}
					/>
					<TextInput
						label="Enchants"
						hint="Verzauberungen, kommagetrennt (z.B. sharpness, unbreaking) — rein optisch fürs Item-Display."
						value={el.item?.enchants?.join(", ")}
						placeholder="sharpness, unbreaking"
						onCommit={(v) => {
							const list = v
								.split(",")
								.map((s) => s.trim())
								.filter(Boolean);
							patch({
								item: {
									...el.item,
									enchants: list.length ? list : undefined,
								},
							});
						}}
					/>
					<ExprInput
						label="Depth"
						hint="3D-Tiefe des Item-Displays (size.depth). Leer = Standard."
						value={el.size?.depth ?? ""}
						onCommit={(v) =>
							patch({
								size: {
									width: el.size?.width ?? 0,
									height: el.size?.height ?? 0,
									depth: v === "" ? undefined : v,
								},
							})
						}
					/>
				</SubGroup>
			)}
			{el.type === "grid_block" && (
				<SubGroup
					title="Grid"
					hint="Layout-Container: ordnet seine Kinder automatisch an, rendert selbst nichts."
				>
					<SelectRow
						label="Direction"
						hint="Anordnung der Kinder: nebeneinander (row) oder untereinander (column)."
						value={el.direction ?? "row"}
						options={[
							{ value: "row", label: "row" },
							{ value: "column", label: "column" },
						]}
						onChange={(v) =>
							patch({ direction: v as EditorElement["direction"] })
						}
					/>
					<ExprInput
						label="Gap"
						hint="Abstand zwischen den Kindern in px."
						value={el.gap ?? 0}
						onCommit={(v) => patch({ gap: v })}
					/>
					<ExprInput
						label="Elem. h"
						hint="Feste Höhe pro Kind-Element (element_h). Leer = automatisch."
						value={el.element_h ?? ""}
						onCommit={(v) => patch({ element_h: v === "" ? undefined : v })}
					/>
					<ExprInput
						label="Row size"
						hint="Umbruch nach N Elementen (row_size): neue Zeile (row) bzw. Spalte (column). Leer = kein Umbruch."
						value={el.row_size ?? ""}
						onCommit={(v) => patch({ row_size: v === "" ? undefined : v })}
					/>
					<ExprInput
						label="Repeat"
						hint="Wie oft das eingehängte Element wiederholt wird (loop, max 2048). {counter} wird pro Kopie zu 0,1,2… Leer = 1×. Wirkt auf das erste eingehängte Element."
						value={el.children?.[0]?.loop ?? ""}
						onCommit={(v) => {
							const first = el.children?.[0];
							if (first)
								patchByUid(first._uid, {
									loop: v === "" ? undefined : v,
								});
						}}
					/>
					<Button
						size="sm"
						variant="outline"
						onClick={() =>
							dispatch({
								type: "set-picking",
								picking: { containerUid: el._uid },
							})
						}
					>
						<MousePointerClick /> Pick element…
					</Button>
					<p className="text-[10px] text-muted-foreground">
						{(el.children?.length ?? 0) === 0
							? "Noch kein Element im Grid — per Pick, Drag&Drop im Layers-Panel oder dort übers ⋯-Menü einhängen."
							: "Kind-Positionen bestimmt das Grid automatisch."}
					</p>
				</SubGroup>
			)}
			{el.component !== undefined && (
				<SubGroup
					title="Component"
					hint="Referenz auf ein Template aus contents/components/<name>.yml. Exportiert wird nur {component, params} — Position/Größe hier sind reine Editor-Platzhalter."
				>
					<TextInput
						label="Name"
						hint="Dateiname des Components (ohne .yml) in contents/components/."
						value={el.component}
						placeholder="editor_button"
						onCommit={(v) => patch({ component: v })}
					/>
					<div className="flex items-start gap-1">
						<FieldLabel
							label="Params"
							hint="Ein Parameter pro Zeile als key: value — wird als params-Map exportiert und füllt die ${platzhalter} des Components."
						/>
						<Textarea
							className="min-h-14 font-mono text-xs"
							placeholder={"text_1: Hello\nactive: false"}
							defaultValue={Object.entries(el.params ?? {})
								.map(([k, v]) => `${k}: ${v}`)
								.join("\n")}
							onBlur={(e) => {
								const params: Record<string, unknown> = {};
								for (const line of e.target.value.split("\n")) {
									const idx = line.indexOf(":");
									if (idx <= 0) continue;
									const key = line.slice(0, idx).trim();
									const raw = line.slice(idx + 1).trim();
									if (!key) continue;
									const num = Number(raw);
									params[key] =
										raw === "true"
											? true
											: raw === "false"
												? false
												: raw !== "" && !Number.isNaN(num)
													? num
													: raw;
								}
								patch({
									params: Object.keys(params).length ? params : undefined,
								});
							}}
						/>
					</div>
				</SubGroup>
			)}
			{el.type === "image" && (
				<SubGroup
					title="Image"
					hint="PNG aus contents/images/ — das Plugin macht daraus automatisch Resource-Pack-Glyphen."
				>
					<ImageField
						label="Image"
						hint="Bildname = Dateiname ohne .png in contents/images/. Upload legt das Bild im Editor ab; der ZIP-Export bündelt es."
						name={el.image}
						onCommit={(v) => patch({ image: v })}
					/>
					<ImageField
						label="Hover img"
						hint="Austauschbild beim Hovern (hover.image), z.B. eine hellere Variante."
						name={el.hover?.image}
						onCommit={(v) => {
							const hover = { ...el.hover, image: v || undefined };
							patch({
								hover: Object.values(hover).some((x) => x !== undefined)
									? hover
									: undefined,
							});
						}}
					/>
					<p className="text-[10px] text-muted-foreground">
						Auf dem Server: gleiche PNG nach
						plugins/UltimateUI/contents/images/ — der ZIP-Export legt sie
						automatisch bei.
					</p>
				</SubGroup>
			)}
		</>
	);
}

/** Text-Design: Farbe + Format-Toggles + Align/Font/Wrap. Farbe und Font
 *  berücksichtigen Inline-Markup: existiert ein <#hex>/<font:>-Präfix im
 *  Text, wird dieses aktualisiert, sonst das YAML-Feld (color:/font:). */
function TextDesignGroup({
	el,
	patch,
	patchLive,
	patchFinal,
}: {
	el: EditorElement;
	patch: (p: Partial<EditorElement>) => void;
	patchLive: (p: Partial<EditorElement>) => void;
	patchFinal: (p: Partial<EditorElement>) => void;
}) {
	const style = parseTextMarkup(el.text);
	const effectiveColor = style.color ?? el.color;
	const effectiveFont = style.font ?? el.font;

	const colorPatch = (v: string | undefined): Partial<EditorElement> =>
		style.color !== undefined || v === undefined
			? { text: patchTextMarkup(el.text, { color: v }) }
			: { color: v };

	return (
		<SubGroup title="Text">
			<ColorField
				label="Color"
				hint="Textfarbe. Aktualisiert das Inline-Markup (<#hex>), falls vorhanden, sonst das color-Feld."
				value={effectiveColor}
				onLive={(v) => patchLive(colorPatch(v))}
				onCommit={(v) => patchFinal(colorPatch(v))}
			/>
			<TextFormatToggles el={el} patch={patch} />
			<SelectRow
				label="Align"
				hint="Ausrichtung des Texts relativ zu seiner X-Position."
				value={el.align ?? "left"}
				options={[
					{ value: "left", label: "left" },
					{ value: "center", label: "center" },
					{ value: "right", label: "right" },
				]}
				onChange={(v) => patch({ align: v as EditorElement["align"] })}
			/>
			<TextInput
				label="Font"
				hint="Font-Key aus dem Resource-Pack. 'default' = Minecraft-Standard. Aktualisiert das <font:>-Tag, falls vorhanden."
				value={effectiveFont}
				placeholder="default"
				onCommit={(v) => {
					if (style.font !== undefined) {
						patch({ text: patchTextMarkup(el.text, { font: v || undefined }) });
					} else {
						patch({ font: v || undefined });
					}
				}}
			/>
			<ExprInput
				label="Wrap"
				hint="Maximale Textbreite in px, danach wird umgebrochen (text-wrap). Leer = 200."
				value={el["text-wrap"] ?? ""}
				onCommit={(v) =>
					patch({ "text-wrap": v === "" ? undefined : Number(v) })
				}
			/>
		</SubGroup>
	);
}

/* ---------------- Actions ---------------- */

const ACTION_TYPES: {
	type: UuiActionType;
	defaultValue: string;
	placeholder: string;
}[] = [
	{ type: "command", defaultValue: "---", placeholder: "/say Hello" },
	{
		type: "console",
		defaultValue: "say Hello",
		placeholder: "say Hello from console",
	},
	{ type: "message", defaultValue: "---", placeholder: "<green>Hello" },
	{ type: "redirect", defaultValue: "---", placeholder: "example_page" },
	{ type: "teleport", defaultValue: "0 64 0", placeholder: "5 2 1" },
	{
		type: "sound",
		defaultValue: "ENTITY_PLAYER_LEVELUP 1,2",
		placeholder: "ENTITY_PLAYER_LEVELUP 1,2",
	},
	{ type: "delay", defaultValue: "1000ms", placeholder: "1000ms" },
	{ type: "close", defaultValue: "Close", placeholder: "" },
	{ type: "animation", defaultValue: "---", placeholder: "fade_in" },
];

function ActionsSection({
	el,
	patch,
}: {
	el: EditorElement;
	patch: (p: Partial<EditorElement>) => void;
}) {
	const actions = el.actions ?? [];
	const setActions = (next: UuiAction[]) =>
		patch({ actions: next.length ? next : undefined });

	return (
		<>
			{actions.length === 0 && (
				<p className="text-muted-foreground text-xs">
					Actions run top-to-bottom when the element is clicked in game.
				</p>
			)}
			<ul className="flex flex-col gap-1">
				{actions.map((a, i) => (
					<li key={i} className="flex flex-col gap-1 border border-border p-1.5">
						<div className="flex items-center gap-1">
							<Select
								value={a.type}
								onValueChange={(v) => {
									const spec = ACTION_TYPES.find((t) => t.type === v);
									const next = [...actions];
									next[i] = {
										type: v as UuiActionType,
										value: spec?.defaultValue ?? "---",
									};
									setActions(next);
								}}
							>
								<SelectTrigger className="h-7 w-28 text-xs">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{ACTION_TYPES.map((t) => (
										<SelectItem key={t.type} value={t.type}>
											{t.type}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<span className="text-[10px] text-muted-foreground">
								#{i + 1}
							</span>
							<span className="ml-auto flex">
								<Button
									size="icon-xs"
									variant="ghost"
									aria-label="Move action up"
									disabled={i === 0}
									onClick={() => {
										const next = [...actions];
										[next[i - 1], next[i]] = [next[i], next[i - 1]];
										setActions(next);
									}}
								>
									<ArrowUp />
								</Button>
								<Button
									size="icon-xs"
									variant="ghost"
									aria-label="Move action down"
									disabled={i === actions.length - 1}
									onClick={() => {
										const next = [...actions];
										[next[i], next[i + 1]] = [next[i + 1], next[i]];
										setActions(next);
									}}
								>
									<ArrowDown />
								</Button>
								<Button
									size="icon-xs"
									variant="ghost"
									aria-label="Delete action"
									onClick={() => setActions(actions.filter((_, j) => j !== i))}
								>
									<Trash2 />
								</Button>
							</span>
						</div>
						{a.type !== "close" && (
							<Input
								className="h-7 text-xs"
								placeholder={
									ACTION_TYPES.find((t) => t.type === a.type)?.placeholder ??
									"value"
								}
								value={a.value ?? ""}
								onChange={(e) => {
									const next = [...actions];
									next[i] = { ...a, value: e.target.value };
									setActions(next);
								}}
							/>
						)}
					</li>
				))}
			</ul>
			<Button
				size="sm"
				variant="outline"
				onClick={() => setActions([...actions, { type: "command", value: "---" }])}
			>
				<Plus /> Add action
			</Button>
		</>
	);
}

/* ---------------- Animation ---------------- */

function animationBadge(el: EditorElement): string | undefined {
	const kf = el.editor_animation?.keyframes;
	if (!kf) return undefined;
	const count = Object.values(kf).reduce(
		(sum, track) => sum + Object.keys(track ?? {}).length,
		0,
	);
	return count > 0 ? `${count} kf` : undefined;
}

function AnimationSection({ el }: { el: EditorElement }) {
	const { state, dispatch } = useEditor();
	const kf = el.editor_animation?.keyframes ?? {};
	const rows = (["position", "rotation", "scale", "opacity"] as const).map(
		(row) => ({ row, count: Object.keys(kf[row] ?? {}).length }),
	);
	return (
		<>
			{rows.every((r) => r.count === 0) ? (
				<p className="text-muted-foreground text-xs">
					No keyframes yet. Open the timeline to animate this element.
				</p>
			) : (
				<ul className="flex flex-col gap-0.5">
					{rows
						.filter((r) => r.count > 0)
						.map((r) => (
							<li
								key={r.row}
								className="flex justify-between text-muted-foreground text-xs"
							>
								<span>{r.row}</span>
								<span>{r.count} keyframes</span>
							</li>
						))}
				</ul>
			)}
			{el.editor_animation?.delay !== undefined && (
				<p className="text-muted-foreground text-xs">
					delay: {el.editor_animation.delay} ticks
				</p>
			)}
			<Button
				size="sm"
				variant="outline"
				onClick={() => {
					dispatch({ type: "set-tool", tool: "animation" });
					dispatch({ type: "toggle-timeline", show: true });
				}}
			>
				{state.showTimeline ? "Timeline is open below" : "Open timeline"}
			</Button>
		</>
	);
}

/* ---------------- Layers (mit Gruppen) ---------------- */

function LayersPanel() {
	const { state, dispatch } = useEditor();
	const { page, selection } = state;
	const groups = page._groups ?? [];
	const [renaming, setRenaming] = React.useState<string | null>(null);
	const [renameDraft, setRenameDraft] = React.useState("");
	/** uid des Grid-/Gruppen-Ziels, über dem gerade ein Element schwebt */
	const [dragOver, setDragOver] = React.useState<string | null>(null);

	const setPage = (next: EditorPage) =>
		dispatch({ type: "set-page", page: next });

	const createGroup = (assignSelection: boolean) => {
		const group: EditorGroup = {
			id: newUid(),
			name: `Group ${groups.length + 1}`,
		};
		let blocks = page.blocks;
		if (assignSelection) {
			for (const uid of selection)
				blocks = updateByUid(blocks, uid, { _group: group.id });
		}
		setPage({ ...page, blocks, _groups: [...groups, group] });
	};

	const patchGroup = (id: string, p: Partial<EditorGroup>) =>
		setPage({
			...page,
			_groups: groups.map((g) => (g.id === id ? { ...g, ...p } : g)),
		});

	const deleteGroup = (id: string) => {
		let blocks = page.blocks;
		for (const el of page.blocks)
			if (el._group === id)
				blocks = updateByUid(blocks, el._uid, { _group: undefined });
		setPage({
			...page,
			blocks,
			_groups: groups.filter((g) => g.id !== id),
		});
	};

	const setGroupHidden = (id: string, hidden: boolean) => {
		let blocks = page.blocks;
		for (const el of page.blocks)
			if (el._group === id)
				blocks = updateByUid(blocks, el._uid, { _hidden: hidden });
		setPage({ ...page, blocks });
	};

	const moveToGroup = (uid: string, groupId: string | undefined) =>
		setPage({
			...page,
			blocks: updateByUid(page.blocks, uid, { _group: groupId }),
		});

	const row = (el: EditorElement, depth: number): React.ReactNode => (
		<React.Fragment key={el._uid}>
			<div
				className={cn(
					"group flex cursor-pointer items-center gap-1 px-1 py-0.5 text-xs hover:bg-muted",
					selection.includes(el._uid) && "bg-muted",
					dragOver === el._uid && "bg-primary/20 ring-1 ring-primary",
				)}
				style={{ paddingLeft: 4 + depth * 12 }}
				onClick={() => dispatch({ type: "select", uids: [el._uid] })}
				draggable
				onDragStart={(e) => {
					e.dataTransfer.setData("text/uui-uid", el._uid);
					e.dataTransfer.effectAllowed = "move";
				}}
				onDragOver={
					el.type === "grid_block"
						? (e) => {
								e.preventDefault();
								setDragOver(el._uid);
							}
						: undefined
				}
				onDragLeave={
					el.type === "grid_block" ? () => setDragOver(null) : undefined
				}
				onDrop={
					el.type === "grid_block"
						? (e) => {
								e.preventDefault();
								setDragOver(null);
								const uid = e.dataTransfer.getData("text/uui-uid");
								if (uid && uid !== el._uid)
									setPage({
										...page,
										blocks: nestInto(page.blocks, uid, el._uid),
									});
							}
						: undefined
				}
			>
				<span className="truncate">
					{el.name || el.id || el.type}
					<span className="ml-1 text-muted-foreground">
						({evalNumExpr(el.layer)})
					</span>
				</span>
				<span className="ml-auto flex shrink-0 items-center opacity-0 group-hover:opacity-100">
					<Button
						size="icon-xs"
						variant="ghost"
						aria-label="Move up"
						onClick={(e) => {
							e.stopPropagation();
							setPage({
								...page,
								blocks: moveInSiblings(page.blocks, el._uid, 1),
							});
						}}
					>
						<ArrowUp />
					</Button>
					<Button
						size="icon-xs"
						variant="ghost"
						aria-label="Move down"
						onClick={(e) => {
							e.stopPropagation();
							setPage({
								...page,
								blocks: moveInSiblings(page.blocks, el._uid, -1),
							});
						}}
					>
						<ArrowDown />
					</Button>
					<Button
						size="icon-xs"
						variant="ghost"
						aria-label={el._hidden ? "Unhide" : "Hide"}
						onClick={(e) => {
							e.stopPropagation();
							setPage({
								...page,
								blocks: updateByUid(page.blocks, el._uid, {
									_hidden: !el._hidden,
								}),
							});
						}}
					>
						{el._hidden ? <EyeOff /> : <Eye />}
					</Button>
					<Button
						size="icon-xs"
						variant="ghost"
						aria-label={el._locked ? "Unlock" : "Lock"}
						onClick={(e) => {
							e.stopPropagation();
							setPage({
								...page,
								blocks: updateByUid(page.blocks, el._uid, {
									_locked: !el._locked,
								}),
							});
						}}
					>
						{el._locked ? <Lock /> : <LockOpen />}
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								size="icon-xs"
								variant="ghost"
								aria-label="More"
								onClick={(e) => e.stopPropagation()}
							>
								<MoreHorizontal />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{depth === 0 && (
								<>
									{groups.map((g) => (
										<DropdownMenuItem
											key={g.id}
											onClick={() => moveToGroup(el._uid, g.id)}
										>
											Move to {g.name}
										</DropdownMenuItem>
									))}
									{groups.length > 0 && <DropdownMenuSeparator />}
									<DropdownMenuItem
										disabled={!el._group}
										onClick={() => moveToGroup(el._uid, undefined)}
									>
										Remove from group
									</DropdownMenuItem>
									<DropdownMenuSeparator />
								</>
							)}
							{flatten(page.blocks)
								.filter(
									(g) => g.type === "grid_block" && g._uid !== el._uid,
								)
								.map((g) => (
									<DropdownMenuItem
										key={g._uid}
										onClick={() =>
											setPage({
												...page,
												blocks: nestInto(page.blocks, el._uid, g._uid),
											})
										}
									>
										Nest into 📐 {g.name || g.id || "grid"}
									</DropdownMenuItem>
								))}
							{depth > 0 && (
								<DropdownMenuItem
									onClick={() => {
										const abs = absolutePosition(
											page,
											el._uid,
											(v) => evalNumExpr(v as never),
										);
										setPage({
											...page,
											blocks: unnest(
												page.blocks,
												el._uid,
												abs ?? undefined,
											),
										});
									}}
								>
									Un-nest to top level
								</DropdownMenuItem>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				</span>
			</div>
			{el.children?.map((c) => row(c, depth + 1))}
		</React.Fragment>
	);

	const sortByLayer = (els: EditorElement[]) =>
		[...els].sort((a, b) => evalNumExpr(b.layer) - evalNumExpr(a.layer));

	const grouped = new Map<string, EditorElement[]>();
	const ungrouped: EditorElement[] = [];
	for (const el of page.blocks) {
		if (el._group && groups.some((g) => g.id === el._group)) {
			const list = grouped.get(el._group) ?? [];
			list.push(el);
			grouped.set(el._group, list);
		} else ungrouped.push(el);
	}

	return (
		<div className="flex flex-col">
			<div className="flex items-center gap-1 border-border border-b p-1">
				<Button size="xs" variant="outline" onClick={() => createGroup(false)}>
					<FolderPlus /> New group
				</Button>
				<Button
					size="xs"
					variant="outline"
					disabled={selection.length === 0}
					onClick={() => createGroup(true)}
				>
					Group selection
				</Button>
			</div>
			{page.blocks.length === 0 && (
				<p className="p-2 text-muted-foreground text-xs">
					No elements yet — right-click the canvas to add one.
				</p>
			)}
			{groups.map((g) => {
				const members = sortByLayer(grouped.get(g.id) ?? []);
				const allHidden =
					members.length > 0 && members.every((m) => m._hidden);
				return (
					<div key={g.id}>
						<div
							className={cn(
								"flex cursor-pointer items-center gap-1 bg-muted/50 px-1 py-1 font-medium text-xs hover:bg-muted",
								dragOver === g.id && "bg-primary/20 ring-1 ring-primary",
							)}
							onClick={() =>
								dispatch({
									type: "select",
									uids: members.map((m) => m._uid),
								})
							}
							onDragOver={(e) => {
								e.preventDefault();
								setDragOver(g.id);
							}}
							onDragLeave={() => setDragOver(null)}
							onDrop={(e) => {
								e.preventDefault();
								setDragOver(null);
								const uid = e.dataTransfer.getData("text/uui-uid");
								if (uid) moveToGroup(uid, g.id);
							}}
						>
							<button
								type="button"
								aria-label={g.collapsed ? "Expand group" : "Collapse group"}
								onClick={(e) => {
									e.stopPropagation();
									patchGroup(g.id, { collapsed: !g.collapsed });
								}}
							>
								{g.collapsed ? (
									<ChevronRight className="size-3" />
								) : (
									<ChevronDown className="size-3" />
								)}
							</button>
							{renaming === g.id ? (
								<Input
									autoFocus
									className="h-5 w-32 text-xs"
									value={renameDraft}
									onChange={(e) => setRenameDraft(e.target.value)}
									onClick={(e) => e.stopPropagation()}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											patchGroup(g.id, { name: renameDraft || g.name });
											setRenaming(null);
										}
										if (e.key === "Escape") setRenaming(null);
									}}
									onBlur={() => {
										patchGroup(g.id, { name: renameDraft || g.name });
										setRenaming(null);
									}}
								/>
							) : (
								<span
									onDoubleClick={(e) => {
										e.stopPropagation();
										setRenaming(g.id);
										setRenameDraft(g.name);
									}}
								>
									📁 {g.name}
								</span>
							)}
							<span className="text-[10px] text-muted-foreground">
								({members.length})
							</span>
							<span className="ml-auto flex items-center">
								<Button
									size="icon-xs"
									variant="ghost"
									aria-label={allHidden ? "Show group" : "Hide group"}
									onClick={(e) => {
										e.stopPropagation();
										setGroupHidden(g.id, !allHidden);
									}}
								>
									{allHidden ? <EyeOff /> : <Eye />}
								</Button>
								<Button
									size="icon-xs"
									variant="ghost"
									aria-label="Dissolve group"
									onClick={(e) => {
										e.stopPropagation();
										deleteGroup(g.id);
									}}
								>
									<Trash2 />
								</Button>
							</span>
						</div>
						{!g.collapsed && members.map((el) => row(el, 1))}
					</div>
				);
			})}
			{sortByLayer(ungrouped).map((el) => row(el, 0))}
			<p className="border-border border-t p-2 text-[10px] text-muted-foreground">
				Groups are editor-only — the exported .yml stays exactly what the
				plugin expects.
			</p>
		</div>
	);
}
