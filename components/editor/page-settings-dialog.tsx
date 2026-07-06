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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SCREEN_READ_DEFAULTS } from "@/lib/uui/defaults";
import type { EditorPage } from "@/lib/uui/types";
import React from "react";
import { useEditor } from "./store";

/**
 * Alle Page-Level-Optionen des Plugins an einem Ort. Der Ingame-Editor hat
 * dafür keine UI (nur manuelles YAML-Editing) — der Web-Editor schon.
 * Felder, die leer/Default bleiben, werden NICHT exportiert (Pass-Through-
 * Semantik wie beim Plugin).
 */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex items-center gap-2">
			<Label className="w-32 shrink-0 text-muted-foreground text-xs">
				{label}
			</Label>
			{children}
		</div>
	);
}

function SwitchField({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<div className="flex items-center justify-between">
			<Label className="text-muted-foreground text-xs">{label}</Label>
			<Switch checked={checked} onCheckedChange={onChange} />
		</div>
	);
}

export default function PageSettingsDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
}) {
	const { state, dispatch } = useEditor();
	const [draft, setDraft] = React.useState<EditorPage>(state.page);

	React.useEffect(() => {
		if (open) setDraft(state.page);
	}, [open, state.page]);

	const set = (p: Partial<EditorPage>) => setDraft((d) => ({ ...d, ...p }));

	const apply = () => {
		dispatch({ type: "set-page", page: draft });
		onOpenChange(false);
	};

	const behavior = draft.behavior ?? {};
	const anim = draft.animation ?? {};
	const ooj = draft["open-on-join"] ?? {};
	const screen = draft.screen;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Page settings</DialogTitle>
					<DialogDescription>
						Everything the plugin reads at page level. Empty fields are not
						written to the exported .yml.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-2">
					<p className="font-medium text-muted-foreground text-xs uppercase">
						Meta
					</p>
					<Row label="Description">
						<Input
							className="h-7 text-xs"
							value={draft.desc ?? ""}
							onChange={(e) => set({ desc: e.target.value || undefined })}
						/>
					</Row>
					<Row label="Open command">
						<Input
							className="h-7 text-xs"
							placeholder="shop (ohne /)"
							value={draft.command ?? ""}
							onChange={(e) =>
								set({
									command:
										e.target.value
											.replace(/^\//, "")
											.split(/\s+/)[0]
											.toLowerCase()
											.replace(/[^a-z0-9_:-]/g, "") || undefined,
								})
							}
						/>
					</Row>
					<Row label="Permission">
						<Input
							className="h-7 text-xs"
							placeholder="myserver.ui.shop"
							value={draft.permission ?? ""}
							onChange={(e) => set({ permission: e.target.value || undefined })}
						/>
					</Row>
					<SwitchField
						label="Page hidden (im Ingame-Editor versteckt)"
						checked={!!draft["page-hidden"]}
						onChange={(v) => set({ "page-hidden": v || undefined })}
					/>

					<p className="mt-2 font-medium text-muted-foreground text-xs uppercase">
						Behavior
					</p>
					<SwitchField
						label="Keep open"
						checked={!!behavior["keep-open"]}
						onChange={(v) =>
							set({ behavior: { ...behavior, "keep-open": v || undefined } })
						}
					/>
					<SwitchField
						label="Reopen"
						checked={!!behavior.reopen}
						onChange={(v) =>
							set({ behavior: { ...behavior, reopen: v || undefined } })
						}
					/>
					<SwitchField
						label="Close on death"
						checked={!!behavior["close-on-death"]}
						onChange={(v) =>
							set({
								behavior: { ...behavior, "close-on-death": v || undefined },
							})
						}
					/>
					<SwitchField
						label="Close on damage"
						checked={!!behavior["close-on-damage"]}
						onChange={(v) =>
							set({
								behavior: { ...behavior, "close-on-damage": v || undefined },
							})
						}
					/>

					<p className="mt-2 font-medium text-muted-foreground text-xs uppercase">
						Open/Close animation
					</p>
					<Row label="Open effect">
						<Input
							className="h-7 text-xs"
							placeholder="profile_animation"
							value={anim.open?.effect ?? ""}
							onChange={(e) =>
								set({
									animation: {
										...anim,
										open: e.target.value
											? { effect: e.target.value }
											: undefined,
									},
								})
							}
						/>
					</Row>
					<Row label="Close effect">
						<Input
							className="h-7 text-xs"
							value={anim.close?.effect ?? ""}
							onChange={(e) =>
								set({
									animation: {
										...anim,
										close: e.target.value
											? { ...anim.close, effect: e.target.value }
											: undefined,
									},
								})
							}
						/>
					</Row>
					{anim.close?.effect && (
						<SwitchField
							label="Close: use HUD"
							checked={!!anim.close?.usehud}
							onChange={(v) =>
								set({
									animation: {
										...anim,
										close: { ...anim.close, usehud: v || undefined },
									},
								})
							}
						/>
					)}
					<SwitchField
						label="Loop element animations"
						checked={!!draft["animation-loop"]}
						onChange={(v) => set({ "animation-loop": v || undefined })}
					/>

					<p className="mt-2 font-medium text-muted-foreground text-xs uppercase">
						Open on join
					</p>
					<SwitchField
						label="Enabled"
						checked={!!ooj.enabled}
						onChange={(v) =>
							set({
								"open-on-join": v
									? { ...ooj, enabled: true }
									: undefined,
							})
						}
					/>
					{ooj.enabled && (
						<>
							<Row label="Type">
								<Select
									value={ooj.type ?? "gui"}
									onValueChange={(v) =>
										set({
											"open-on-join": {
												...ooj,
												type: v as "hud" | "gui",
											},
										})
									}
								>
									<SelectTrigger className="h-7 w-full text-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="gui">gui (mit Cursor)</SelectItem>
										<SelectItem value="hud">hud (Overlay)</SelectItem>
									</SelectContent>
								</Select>
							</Row>
							<Row label="Delay (ticks)">
								<Input
									className="h-7 text-xs"
									value={ooj.delay ?? ""}
									onChange={(e) =>
										set({
											"open-on-join": {
												...ooj,
												delay:
													e.target.value === ""
														? undefined
														: Number(e.target.value) || 0,
											},
										})
									}
								/>
							</Row>
						</>
					)}

					<p className="mt-2 font-medium text-muted-foreground text-xs uppercase">
						Screen (Plugin-Defaults: {SCREEN_READ_DEFAULTS.width}×
						{SCREEN_READ_DEFAULTS.height})
					</p>
					<div className="grid grid-cols-2 gap-2">
						{(
							[
								["Width", "width"],
								["Height", "height"],
								["Offset X", "offsetX"],
								["Offset Y", "offsetY"],
								["Hitbox off. X", "hitboxOffsetX"],
								["Hitbox off. Y", "hitboxOffsetY"],
								["Cursor size", "cursorSize"],
								["Cursor speed", "cursorSpeed"],
								["Cursor layer", "cursorLayer"],
							] as const
						).map(([label, key]) => (
							<Row key={key} label={label}>
								<Input
									className="h-7 text-xs"
									value={screen[key] ?? ""}
									onChange={(e) =>
										set({
											screen: {
												...screen,
												[key]:
													e.target.value === ""
														? undefined
														: Number(e.target.value),
											},
										})
									}
								/>
							</Row>
						))}
					</div>
					<Row label="Cursor glyph">
						<Input
							className="h-7 text-xs"
							placeholder="(Standard-Cursor)"
							value={screen.cursorUnicode ?? ""}
							onChange={(e) =>
								set({
									screen: {
										...screen,
										cursorUnicode: e.target.value || undefined,
									},
								})
							}
						/>
					</Row>
					<p className="text-[10px] text-muted-foreground">
						Screen wird nur exportiert, wenn es von den Plugin-Defaults
						abweicht (der Ingame-Editor schreibt es nie).
					</p>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={apply}>Apply</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
