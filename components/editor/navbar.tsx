"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Menubar,
	MenubarContent,
	MenubarItem,
	MenubarMenu,
	MenubarSeparator,
	MenubarShortcut,
	MenubarTrigger,
} from "@/components/ui/menubar";
import { type CreateKind, newElement } from "@/lib/uui/defaults";
import { exportYml, exportZip } from "@/lib/uui/export";
import { savePage } from "@/lib/uui/storage";
import {
	cloneWithNewUids,
	findByUid,
	flatten,
	moveInSiblings,
	removeByUids,
	updateByUid,
} from "@/lib/uui/tree";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	listAssetKeys,
	sanitizeImageName,
	saveAsset,
} from "@/lib/uui/assets";
import {
	Eye,
	House,
	Magnet,
	Monitor,
	Redo2,
	Undo2,
	Wallpaper,
} from "lucide-react";
import Link from "next/link";
import React from "react";
import { toast } from "sonner";
import EffectsDialog from "./effects-dialog";
import PageSettingsDialog from "./page-settings-dialog";
import { useEditor } from "./store";

export default function Navbar() {
	const { state, dispatch } = useEditor();
	const { page, selection } = state;
	const [saveAsOpen, setSaveAsOpen] = React.useState(false);
	const [settingsOpen, setSettingsOpen] = React.useState(false);
	const [effectsOpen, setEffectsOpen] = React.useState(false);

	/* ---------------- Aktionen ---------------- */

	const doSave = React.useCallback(() => {
		savePage(state.page);
		dispatch({ type: "mark-saved" });
		toast.success(`Saved "${state.page.name}"`);
	}, [state.page, dispatch]);

	const copySelection = React.useCallback(() => {
		const els = selection
			.map((uid) => findByUid(page.blocks, uid))
			.filter((x) => x !== null);
		if (els.length) dispatch({ type: "set-clipboard", elements: els });
		return els.length;
	}, [selection, page.blocks, dispatch]);

	const deleteSelection = React.useCallback(() => {
		if (!selection.length) return;
		dispatch({
			type: "set-page",
			page: {
				...page,
				blocks: removeByUids(page.blocks, new Set(selection)),
			},
		});
		dispatch({ type: "select", uids: [] });
	}, [selection, page, dispatch]);

	const pasteCenter = React.useCallback(() => {
		if (!state.clipboard.length) return;
		const clones = cloneWithNewUids(state.clipboard);
		dispatch({
			type: "set-page",
			page: { ...page, blocks: [...page.blocks, ...clones] },
		});
		dispatch({ type: "select", uids: clones.map((c) => c._uid) });
	}, [state.clipboard, page, dispatch]);

	const addElement = (kind: CreateKind) => {
		const el = newElement(page, kind);
		dispatch({
			type: "set-page",
			page: { ...page, blocks: [...page.blocks, el] },
		});
		dispatch({ type: "select", uids: [el._uid] });
	};

	const setHiddenAll = (uids: string[], hidden: boolean) => {
		let blocks = page.blocks;
		for (const uid of uids)
			blocks = updateByUid(blocks, uid, { _hidden: hidden });
		dispatch({ type: "set-page", page: { ...page, blocks } });
	};
	const setLockedAll = (uids: string[], locked: boolean) => {
		let blocks = page.blocks;
		for (const uid of uids)
			blocks = updateByUid(blocks, uid, { _locked: locked });
		dispatch({ type: "set-page", page: { ...page, blocks } });
	};

	/* ---------------- Shortcuts ---------------- */

	React.useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement;
			if (
				target.tagName === "INPUT" ||
				target.tagName === "TEXTAREA" ||
				target.isContentEditable
			)
				return;
			const mod = e.ctrlKey || e.metaKey;
			if (mod && e.key === "z" && !e.shiftKey) {
				e.preventDefault();
				dispatch({ type: "undo" });
			} else if (mod && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
				e.preventDefault();
				dispatch({ type: "redo" });
			} else if (mod && e.key === "s") {
				e.preventDefault();
				doSave();
			} else if (mod && e.key === "c") {
				copySelection();
			} else if (mod && e.key === "x") {
				if (copySelection()) deleteSelection();
			} else if (mod && e.key === "v") {
				pasteCenter();
			} else if (mod && e.key === "a") {
				e.preventDefault();
				dispatch({
					type: "select",
					uids: flatten(page.blocks).map((el) => el._uid),
				});
			} else if (e.key === "Delete" || e.key === "Backspace") {
				deleteSelection();
			} else if (e.key === "Escape") {
				dispatch({ type: "select", uids: [] });
			} else if (
				["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key) &&
				selection.length > 0
			) {
				// Pfeiltasten: Selektion um 1px verschieben (Shift = 10px)
				e.preventDefault();
				const step = e.shiftKey ? 10 : 1;
				const dx =
					e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
				const dy =
					e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
				let blocks = page.blocks;
				for (const uid of selection) {
					const el = findByUid(blocks, uid);
					if (!el || el._locked) continue;
					const x = Number(el.position?.x) || 0;
					const y = Number(el.position?.y) || 0;
					blocks = updateByUid(blocks, uid, {
						position: { x: x + dx, y: y + dy },
					});
				}
				dispatch({ type: "set-page", page: { ...page, blocks } });
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [dispatch, doSave, copySelection, deleteSelection, pasteCenter, page, selection]);

	/* ---------------- Render ---------------- */

	return (
		<div className="flex items-center gap-1 border-border border-b bg-background px-1 py-0.5">
			<Button size="icon-sm" variant="ghost" asChild aria-label="Home">
				<Link href="/">
					<House />
				</Link>
			</Button>
			<Menubar className="border-none bg-transparent">
				<MenubarMenu>
					<MenubarTrigger>File</MenubarTrigger>
					<MenubarContent>
						<MenubarItem onClick={doSave}>
							Save <MenubarShortcut>Ctrl+S</MenubarShortcut>
						</MenubarItem>
						<MenubarItem onClick={() => setSaveAsOpen(true)}>
							Save as…
						</MenubarItem>
						<MenubarItem onClick={() => setSettingsOpen(true)}>
							Page settings…
						</MenubarItem>
						<MenubarSeparator />
						<MenubarItem onClick={() => exportYml(state.page)}>
							Export .yml
						</MenubarItem>
						<MenubarItem
							onClick={() =>
								exportZip(state.page).catch(() =>
									toast.error("ZIP export failed"),
								)
							}
						>
							Export server ZIP
						</MenubarItem>
						<MenubarSeparator />
						<MenubarItem asChild>
							<Link href="/">Close</Link>
						</MenubarItem>
					</MenubarContent>
				</MenubarMenu>
				<MenubarMenu>
					<MenubarTrigger>Edit</MenubarTrigger>
					<MenubarContent>
						<MenubarItem
							disabled={state.past.length === 0}
							onClick={() => dispatch({ type: "undo" })}
						>
							Undo <MenubarShortcut>Ctrl+Z</MenubarShortcut>
						</MenubarItem>
						<MenubarItem
							disabled={state.future.length === 0}
							onClick={() => dispatch({ type: "redo" })}
						>
							Redo <MenubarShortcut>Ctrl+Y</MenubarShortcut>
						</MenubarItem>
						<MenubarSeparator />
						<MenubarItem
							disabled={!selection.length}
							onClick={() => {
								if (copySelection()) deleteSelection();
							}}
						>
							Cut <MenubarShortcut>Ctrl+X</MenubarShortcut>
						</MenubarItem>
						<MenubarItem disabled={!selection.length} onClick={copySelection}>
							Copy <MenubarShortcut>Ctrl+C</MenubarShortcut>
						</MenubarItem>
						<MenubarItem
							disabled={!state.clipboard.length}
							onClick={pasteCenter}
						>
							Paste <MenubarShortcut>Ctrl+V</MenubarShortcut>
						</MenubarItem>
					</MenubarContent>
				</MenubarMenu>
				<MenubarMenu>
					<MenubarTrigger>Selection</MenubarTrigger>
					<MenubarContent>
						<MenubarItem
							onClick={() =>
								dispatch({
									type: "select",
									uids: flatten(page.blocks).map((el) => el._uid),
								})
							}
						>
							All <MenubarShortcut>Ctrl+A</MenubarShortcut>
						</MenubarItem>
						<MenubarItem onClick={() => dispatch({ type: "select", uids: [] })}>
							None
						</MenubarItem>
						<MenubarItem
							onClick={() =>
								dispatch({
									type: "select",
									uids: flatten(page.blocks)
										.map((el) => el._uid)
										.filter((uid) => !selection.includes(uid)),
								})
							}
						>
							Reverse
						</MenubarItem>
						<MenubarSeparator />
						<MenubarItem
							disabled={!selection.length}
							onClick={() => setHiddenAll(selection, true)}
						>
							Hide
						</MenubarItem>
						<MenubarItem
							disabled={!selection.length}
							onClick={() => setHiddenAll(selection, false)}
						>
							Unhide
						</MenubarItem>
						<MenubarItem
							disabled={!selection.length}
							onClick={() => setLockedAll(selection, true)}
						>
							Block
						</MenubarItem>
						<MenubarItem
							disabled={!selection.length}
							onClick={() => setLockedAll(selection, false)}
						>
							Unblock
						</MenubarItem>
					</MenubarContent>
				</MenubarMenu>
				<MenubarMenu>
					<MenubarTrigger>Layer</MenubarTrigger>
					<MenubarContent>
						<MenubarItem onClick={() => addElement("block")}>
							New Block
						</MenubarItem>
						<MenubarItem onClick={() => addElement("text")}>
							New Text
						</MenubarItem>
						<MenubarItem onClick={() => addElement("item")}>
							New Item
						</MenubarItem>
						<MenubarItem onClick={() => addElement("image")}>
							New Image
						</MenubarItem>
						<MenubarSeparator />
						<MenubarItem
							disabled={selection.length !== 1}
							onClick={() =>
								dispatch({
									type: "set-page",
									page: {
										...page,
										blocks: moveInSiblings(page.blocks, selection[0], 1),
									},
								})
							}
						>
							Move up
						</MenubarItem>
						<MenubarItem
							disabled={selection.length !== 1}
							onClick={() =>
								dispatch({
									type: "set-page",
									page: {
										...page,
										blocks: moveInSiblings(page.blocks, selection[0], -1),
									},
								})
							}
						>
							Move down
						</MenubarItem>
						<MenubarSeparator />
						<MenubarItem disabled={!selection.length} onClick={deleteSelection}>
							Delete <MenubarShortcut>Del</MenubarShortcut>
						</MenubarItem>
					</MenubarContent>
				</MenubarMenu>
				<MenubarMenu>
					<MenubarTrigger>Window</MenubarTrigger>
					<MenubarContent>
						<MenubarItem
							onClick={() => dispatch({ type: "toggle-timeline" })}
						>
							{state.showTimeline ? "Hide" : "Show"} timeline
						</MenubarItem>
						<MenubarItem onClick={() => setEffectsOpen(true)}>
							Effects…
						</MenubarItem>
					</MenubarContent>
				</MenubarMenu>
			</Menubar>

			<div className="mx-2 flex items-center gap-0.5">
				<Button
					size="icon-sm"
					variant="ghost"
					aria-label="Undo"
					disabled={state.past.length === 0}
					onClick={() => dispatch({ type: "undo" })}
				>
					<Undo2 />
				</Button>
				<Button
					size="icon-sm"
					variant="ghost"
					aria-label="Redo"
					disabled={state.future.length === 0}
					onClick={() => dispatch({ type: "redo" })}
				>
					<Redo2 />
				</Button>
			</div>

			<span className="ml-2 truncate text-muted-foreground text-xs">
				{page.name}
				{state.dirty ? " •" : ""}
			</span>

			<div className="ml-auto flex items-center gap-1">
				<Button
					size="sm"
					variant={state.snapping ? "secondary" : "ghost"}
					aria-label="Toggle snapping"
					aria-pressed={state.snapping}
					title="Snapping: Smart Guides an Kanten/Mitten anderer Elemente (Alt hält beim Ziehen temporär aus)"
					onClick={() => dispatch({ type: "toggle-snapping" })}
				>
					<Magnet />
				</Button>
				<ScreenSimMenu />
				<BackgroundMenu />
				<Button
					size="sm"
					variant={state.preview ? "secondary" : "ghost"}
					onClick={() =>
						dispatch({ type: "set-preview", preview: !state.preview })
					}
				>
					<Eye /> Preview
				</Button>
				<Button size="sm" onClick={doSave}>
					Save
				</Button>
			</div>

			{/* Save-As-Popup (Name/Beschreibung/Command — wie ingame) */}
			<SaveAsDialog open={saveAsOpen} onOpenChange={setSaveAsOpen} />
			<PageSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
			<EffectsDialog open={effectsOpen} onOpenChange={setEffectsOpen} />
		</div>
	);
}

/** HUD-Anker-Vorschau: simuliert andere Seitenverhältnisse. Elemente mit
 *  aligned: left/right kleben an der jeweiligen Kante, der Rest zentriert —
 *  wie ingame bei anderen Monitor-Formaten. Reine Ansicht, ändert keine Daten. */
export function ScreenSimMenu() {
	const { state, dispatch } = useEditor();
	const OPTIONS: [number, string][] = [
		[1920, "16:9 — 1920 (Design)"],
		[1440, "4:3 — 1440"],
		[1728, "16:10 — 1728"],
		[2520, "21:9 — 2520"],
		[3840, "32:9 — 3840"],
	];
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					size="sm"
					variant={state.simWidth !== 1920 ? "secondary" : "ghost"}
					aria-label="Simulate screen aspect ratio"
					title="HUD-Anker-Vorschau: anderes Seitenverhältnis simulieren"
				>
					<Monitor />
					{state.simWidth !== 1920 && (
						<span className="text-xs">{state.simWidth}</span>
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{OPTIONS.map(([w, label]) => (
					<DropdownMenuItem
						key={w}
						onClick={() => dispatch({ type: "set-sim-width", width: w })}
					>
						{state.simWidth === w ? "✓ " : ""}
						{label}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** Hintergrund-Auswahl: Presets + eigene Screenshots (IndexedDB). */
export function BackgroundMenu() {
	const { state, dispatch } = useEditor();
	const [customBgs, setCustomBgs] = React.useState<string[]>([]);
	const fileRef = React.useRef<HTMLInputElement>(null);

	const refresh = React.useCallback(() => {
		listAssetKeys("bg:").then(setCustomBgs);
	}, []);
	React.useEffect(refresh, [refresh]);

	const setBg = (bg: string) => dispatch({ type: "set-canvas-bg", bg });

	const uploadBg = async (file: File) => {
		const name = sanitizeImageName(file.name) || "screenshot";
		const key = `bg:${name}`;
		await saveAsset(key, file);
		refresh();
		setBg(`asset:${key}`);
	};

	const PRESETS: [string, string][] = [
		["dark", "Dark (default)"],
		["black", "Black"],
		["white", "White"],
		["checker", "Checker"],
		["sky", "Plains sky"],
	];

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button size="sm" variant="ghost" aria-label="Canvas background">
						<Wallpaper />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					{PRESETS.map(([value, label]) => (
						<DropdownMenuItem key={value} onClick={() => setBg(value)}>
							{state.canvasBg === value ? "✓ " : ""}
							{label}
						</DropdownMenuItem>
					))}
					{customBgs.length > 0 && <DropdownMenuSeparator />}
					{customBgs.map((key) => (
						<DropdownMenuItem key={key} onClick={() => setBg(`asset:${key}`)}>
							{state.canvasBg === `asset:${key}` ? "✓ " : ""}
							🖼 {key.slice(3)}
						</DropdownMenuItem>
					))}
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={() => fileRef.current?.click()}>
						Upload screenshot…
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<input
				ref={fileRef}
				type="file"
				accept="image/*"
				className="hidden"
				onChange={(e) => {
					const f = e.target.files?.[0];
					if (f) uploadBg(f);
					e.target.value = "";
				}}
			/>
		</>
	);
}

function SaveAsDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
}) {
	const { state, dispatch } = useEditor();
	const [name, setName] = React.useState(state.page.name);
	const [description, setDescription] = React.useState(
		state.page.desc ?? "",
	);
	const [command, setCommand] = React.useState(state.page.command ?? "");

	React.useEffect(() => {
		if (open) {
			setName(state.page.name);
			setDescription(state.page.desc ?? "");
			setCommand(state.page.command ?? "");
		}
	}, [open, state.page]);

	const confirm = () => {
		// normalizePageKey-Äquivalent (Dateiname)
		const clean = name
			.trim()
			.replace(/\.yml$/i, "")
			.replace(/[\\/]/g, "_")
			.replace(/\s+/g, "_")
			.replace(/[^a-zA-Z0-9_-]/g, "")
			.replace(/_+/g, "_")
			.replace(/^-+|-+$/g, "")
			.toLowerCase();
		if (!clean) return;
		// normalizeCustomCommandToken-Äquivalent: ohne Slash, 1. Wort, [a-z0-9_:-]
		const cleanCmd = command
			.trim()
			.replace(/^\//, "")
			.split(/\s+/)[0]
			.toLowerCase()
			.replace(/[^a-z0-9_:-]/g, "");
		const next = {
			...state.page,
			name: clean,
			desc: description || undefined,
			command: cleanCmd || undefined,
		};
		dispatch({ type: "set-page", page: next });
		savePage(next);
		dispatch({ type: "mark-saved" });
		toast.success(`Saved as "${clean}"`);
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Save as</DialogTitle>
					<DialogDescription>
						Like in game: choose a name, an optional description and an
						optional custom open command.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-2">
					<div className="flex items-center gap-2">
						<Label className="w-24 text-xs">Name</Label>
						<Input value={name} onChange={(e) => setName(e.target.value)} />
					</div>
					<div className="flex items-center gap-2">
						<Label className="w-24 text-xs">Description</Label>
						<Input
							value={description}
							onChange={(e) => setDescription(e.target.value)}
						/>
					</div>
					<div className="flex items-center gap-2">
						<Label className="w-24 text-xs">Command</Label>
						<Input
							placeholder="/shop"
							value={command}
							onChange={(e) => setCommand(e.target.value)}
						/>
					</div>
				</div>
				<DialogFooter>
					<Button onClick={confirm}>Confirm</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
