"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	BUILTIN_EFFECTS,
	deleteEffect,
	listCustomEffects,
	saveEffect,
	type UuiEffect,
} from "@/lib/uui/effects";
import { Copy, Plus, Trash2 } from "lucide-react";
import React from "react";
import { toast } from "sonner";

/**
 * Verwaltung von Effekt-Presets (contents/effects/<name>.yml): Hover-/Klick-/
 * Open-/Close-Effekte. Eigene Presets landen beim ZIP-Export automatisch mit
 * im Paket, wenn die Page sie referenziert.
 */

const INTERPOLATIONS = [
	"linear",
	"smooth",
	"ease-in",
	"ease-out",
	"ease-in-out",
	"bezier",
	"back-in",
	"back-out",
	"bounce",
];

function emptyEffect(): UuiEffect {
	return {
		id: "",
		name: "",
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
	};
}

export default function EffectsDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
}) {
	const [custom, setCustom] = React.useState<Record<string, UuiEffect>>({});
	const [draft, setDraft] = React.useState<UuiEffect | null>(null);

	React.useEffect(() => {
		if (open) setCustom(listCustomEffects());
	}, [open]);

	const refresh = () => setCustom(listCustomEffects());

	const startEdit = (effect: UuiEffect) => setDraft({ ...effect });

	const save = () => {
		if (!draft) return;
		const id = draft.id
			.trim()
			.toLowerCase()
			.replace(/\s+/g, "_")
			.replace(/[^a-z0-9_-]/g, "");
		if (!id) {
			toast.error("Effect braucht eine ID (Dateiname).");
			return;
		}
		saveEffect({ ...draft, id, name: draft.name || id });
		refresh();
		setDraft(null);
		toast.success(`Effect "${id}" gespeichert`);
	};

	const set = (p: Partial<UuiEffect>) =>
		setDraft((d) => (d ? { ...d, ...p } : d));

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Effects</DialogTitle>
					<DialogDescription>
						Presets für Hover-/Klick-/Open-/Close-Effekte
						(contents/effects/&lt;id&gt;.yml). Eigene Effekte landen beim
						ZIP-Export automatisch mit im Paket.
					</DialogDescription>
				</DialogHeader>

				{!draft ? (
					<>
						<p className="font-medium text-muted-foreground text-xs uppercase">
							Plugin-Presets (immer verfügbar)
						</p>
						<ul className="flex flex-col gap-1">
							{Object.values(BUILTIN_EFFECTS).map((e) => (
								<li
									key={e.id}
									className="flex items-center gap-2 border border-border p-1.5 text-xs"
								>
									<span className="font-medium">{e.id}</span>
									<span className="text-muted-foreground">
										{e.type}, {e["duration-ms"]}ms, {e.interpolation}
									</span>
									<Button
										size="icon-xs"
										variant="ghost"
										className="ml-auto"
										aria-label={`Clone ${e.id}`}
										title="Als Vorlage für eigenen Effekt nutzen"
										onClick={() =>
											startEdit({ ...e, id: `${e.id}_custom`, name: "" })
										}
									>
										<Copy />
									</Button>
								</li>
							))}
						</ul>
						<p className="mt-1 font-medium text-muted-foreground text-xs uppercase">
							Eigene Effekte
						</p>
						{Object.keys(custom).length === 0 && (
							<p className="text-muted-foreground text-xs">
								Noch keine eigenen Effekte.
							</p>
						)}
						<ul className="flex flex-col gap-1">
							{Object.values(custom).map((e) => (
								<li
									key={e.id}
									className="flex items-center gap-2 border border-border p-1.5 text-xs"
								>
									<button
										type="button"
										className="font-medium hover:underline"
										onClick={() => startEdit(e)}
									>
										{e.id}
									</button>
									<span className="text-muted-foreground">
										{e.type}, {e["duration-ms"]}ms
									</span>
									<Button
										size="icon-xs"
										variant="ghost"
										className="ml-auto"
										aria-label={`Delete ${e.id}`}
										onClick={() => {
											deleteEffect(e.id);
											refresh();
										}}
									>
										<Trash2 />
									</Button>
								</li>
							))}
						</ul>
						<Button size="sm" variant="outline" onClick={() => startEdit(emptyEffect())}>
							<Plus /> New effect
						</Button>
					</>
				) : (
					<div className="flex flex-col gap-2">
						{(
							[
								["ID (Dateiname)", "id", "text"],
								["Name", "name", "text"],
							] as const
						).map(([label, key]) => (
							<div key={key} className="flex items-center gap-2">
								<Label className="w-32 shrink-0 text-muted-foreground text-xs">
									{label}
								</Label>
								<Input
									className="h-7 text-xs"
									value={(draft[key] as string) ?? ""}
									onChange={(e) => set({ [key]: e.target.value })}
								/>
							</div>
						))}
						<div className="flex items-center gap-2">
							<Label className="w-32 shrink-0 text-muted-foreground text-xs">
								Type
							</Label>
							<Select
								value={draft.type}
								onValueChange={(v) => set({ type: v as UuiEffect["type"] })}
							>
								<SelectTrigger className="h-7 w-full text-xs">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="scale">scale (vergrößern)</SelectItem>
									<SelectItem value="transform">
										transform (bewegen + skalieren)
									</SelectItem>
									<SelectItem value="move">move (nur bewegen)</SelectItem>
								</SelectContent>
							</Select>
						</div>
						{(
							[
								["Amount %", "amount-percent"],
								["Scale X (z.B. 5%)", "scale-x"],
								["Scale Y", "scale-y"],
								["Move X", "move-x"],
								["Move Y", "move-y"],
								["Opacity Δ", "opacity-delta"],
								["Rotation °", "rotation-deg"],
								["Duration ms", "duration-ms"],
							] as const
						).map(([label, key]) => (
							<div key={key} className="flex items-center gap-2">
								<Label className="w-32 shrink-0 text-muted-foreground text-xs">
									{label}
								</Label>
								<Input
									className="h-7 text-xs"
									value={String(draft[key] ?? "")}
									onChange={(e) => {
										const raw = e.target.value.trim();
										const num = Number(raw);
										set({
											[key]:
												raw === ""
													? undefined
													: raw.endsWith("%") || Number.isNaN(num)
														? raw
														: num,
										});
									}}
								/>
							</div>
						))}
						<div className="flex items-center gap-2">
							<Label className="w-32 shrink-0 text-muted-foreground text-xs">
								Interpolation
							</Label>
							<Select
								value={draft.interpolation ?? "ease-in-out"}
								onValueChange={(v) => set({ interpolation: v })}
							>
								<SelectTrigger className="h-7 w-full text-xs">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{INTERPOLATIONS.map((i) => (
										<SelectItem key={i} value={i}>
											{i}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex justify-end gap-1">
							<Button size="sm" variant="outline" onClick={() => setDraft(null)}>
								Back
							</Button>
							<Button size="sm" onClick={save}>
								Save effect
							</Button>
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
