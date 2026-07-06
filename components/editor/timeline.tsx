"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { evalNumExpr } from "@/lib/uui/expr";
import { findByUid, updateByUid } from "@/lib/uui/tree";
import type {
	EditorElement,
	UuiElementAnimation,
	UuiInterpolation,
	UuiKeyframe,
} from "@/lib/uui/types";
import { cn } from "@/lib/utils";
import { Diamond, Plus, Trash2, X } from "lucide-react";
import React from "react";
import { useEditor } from "./store";

const ROWS = ["position", "rotation", "scale", "opacity"] as const;
type Row = (typeof ROWS)[number];

/** Interpolationen wie AnimationTimelineOperationsManagerBase (linear = Default) */
const INTERPOLATIONS: UuiInterpolation[] = [
	"linear",
	"smooth",
	"smooth-in",
	"smooth-out",
	"ease-in",
	"ease-out",
	"bezier",
	"back",
	"back-in",
	"back-out",
	"bounce",
	"bounce-in",
	"bounce-out",
];

const TICKS = 100;

export default function Timeline() {
	const { state, dispatch } = useEditor();
	const { page, selection, timelineTick } = state;
	const el =
		selection.length === 1 ? findByUid(page.blocks, selection[0]) : null;
	const [selectedKf, setSelectedKf] = React.useState<{
		row: Row;
		tick: string;
	} | null>(null);

	const anim: UuiElementAnimation = el?.editor_animation ?? { keyframes: {} };

	const patchAnim = (next: UuiElementAnimation | undefined) => {
		if (!el) return;
		dispatch({
			type: "set-page",
			page: {
				...page,
				blocks: updateByUid(page.blocks, el._uid, {
					editor_animation: next,
				}),
			},
		});
	};

	/** Keyframe an aktueller Tick-Position mit aktuellen Element-Werten anlegen
	 *  (wie das "+"-Verhalten des Ingame-Editors). */
	const addKeyframe = (row: Row) => {
		if (!el) return;
		let value: UuiKeyframe;
		switch (row) {
			case "position":
				value = {
					x: evalNumExpr(el.position?.x),
					y: evalNumExpr(el.position?.y),
				};
				break;
			case "rotation":
				value = evalNumExpr(el.rotation, 0);
				break;
			case "scale":
				value = {
					offsetX: 0,
					offsetY: 0,
					x: 0,
					y: 0,
					width: evalNumExpr(el.size?.width, 0),
					height: evalNumExpr(el.size?.height, 0),
				};
				break;
			default:
				value = evalNumExpr(el.opacity ?? 255, 255);
		}
		const track = { ...(anim.keyframes[row] ?? {}) };
		track[String(timelineTick)] = value;
		patchAnim({ ...anim, keyframes: { ...anim.keyframes, [row]: track } });
		setSelectedKf({ row, tick: String(timelineTick) });
	};

	const removeKeyframe = (row: Row, tick: string) => {
		const track = { ...(anim.keyframes[row] ?? {}) };
		delete track[tick];
		const keyframes = { ...anim.keyframes, [row]: track };
		if (Object.keys(track).length === 0)
			delete (keyframes as Record<string, unknown>)[row];
		const hasAny = Object.keys(keyframes).length > 0;
		patchAnim(hasAny ? { ...anim, keyframes } : undefined);
		setSelectedKf(null);
	};

	const patchKeyframe = (row: Row, tick: string, value: UuiKeyframe) => {
		const track = { ...(anim.keyframes[row] ?? {}) };
		track[tick] = value;
		patchAnim({ ...anim, keyframes: { ...anim.keyframes, [row]: track } });
	};

	if (!el)
		return (
			<div className="border-border border-t bg-background p-3 text-muted-foreground text-xs">
				Animation timeline: select an element to edit its keyframes.
			</div>
		);

	const kfValue: UuiKeyframe | undefined = selectedKf
		? anim.keyframes[selectedKf.row]?.[selectedKf.tick]
		: undefined;

	return (
		<div className="flex flex-col border-border border-t bg-background">
			<div className="flex items-center gap-2 border-border border-b px-2 py-1">
				<span className="font-medium text-xs">
					Timeline — {el.name || el.id || el.type}
				</span>
				<span className="text-muted-foreground text-xs">
					tick {timelineTick}
				</span>
				<div className="ml-auto flex items-center gap-1">
					<span className="text-muted-foreground text-xs">delay</span>
					<Input
						className="h-6 w-16 text-xs"
						value={anim.delay ?? ""}
						placeholder="0"
						onChange={(e) => {
							const v = e.target.value.trim();
							patchAnim({
								...anim,
								delay: v === "" ? undefined : Number(v) || 0,
							});
						}}
					/>
					<Button
						size="icon-xs"
						variant="ghost"
						aria-label="Close timeline"
						onClick={() => dispatch({ type: "toggle-timeline", show: false })}
					>
						<X />
					</Button>
				</div>
			</div>

			<div className="overflow-x-auto">
				<div className="min-w-max">
					{/* Tick-Lineal */}
					<div className="flex">
						<div className="w-20 shrink-0" />
						{Array.from({ length: TICKS + 1 }, (_, t) => (
							<button
								key={t}
								type="button"
								className={cn(
									"h-4 w-3 shrink-0 border-border/40 border-r text-[8px] text-muted-foreground",
									t === timelineTick && "bg-primary/40",
									t % 10 === 0 && "border-border",
								)}
								onClick={() =>
									dispatch({ type: "set-timeline-tick", tick: t })
								}
								title={`Tick ${t}`}
							>
								{t % 10 === 0 ? t : ""}
							</button>
						))}
					</div>
					{/* Tracks */}
					{ROWS.map((row) => {
						const track = anim.keyframes[row] ?? {};
						return (
							<div key={row} className="flex items-center">
								<div className="flex w-20 shrink-0 items-center gap-1 px-1">
									<Button
										size="icon-xs"
										variant="ghost"
										aria-label={`Add ${row} keyframe`}
										onClick={() => addKeyframe(row)}
									>
										<Plus />
									</Button>
									<span className="text-muted-foreground text-xs">{row}</span>
								</div>
								{Array.from({ length: TICKS + 1 }, (_, t) => {
									const has = track[String(t)] !== undefined;
									const isSel =
										selectedKf?.row === row &&
										selectedKf?.tick === String(t);
									return (
										<button
											key={t}
											type="button"
											className={cn(
												"flex h-6 w-3 shrink-0 items-center justify-center border-border/30 border-r",
												t === timelineTick && "bg-primary/15",
											)}
											onClick={() => {
												dispatch({ type: "set-timeline-tick", tick: t });
												if (has) setSelectedKf({ row, tick: String(t) });
											}}
										>
											{has && (
												<Diamond
													className={cn(
														"size-2.5",
														isSel
															? "fill-amber-400 text-amber-400"
															: "fill-primary text-primary",
													)}
												/>
											)}
										</button>
									);
								})}
							</div>
						);
					})}
				</div>
			</div>

			{/* Keyframe-Editor */}
			{selectedKf && kfValue !== undefined && (
				<KeyframeEditor
					row={selectedKf.row}
					tick={selectedKf.tick}
					value={kfValue}
					onChange={(v) => patchKeyframe(selectedKf.row, selectedKf.tick, v)}
					onDelete={() => removeKeyframe(selectedKf.row, selectedKf.tick)}
				/>
			)}
		</div>
	);
}

function KeyframeEditor({
	row,
	tick,
	value,
	onChange,
	onDelete,
}: {
	row: Row;
	tick: string;
	value: UuiKeyframe;
	onChange: (v: UuiKeyframe) => void;
	onDelete: () => void;
}) {
	const obj = typeof value === "number" ? null : value;
	const interpolation = obj?.interpolation ?? "linear";

	const setInterpolation = (interp: UuiInterpolation) => {
		if (row === "rotation" || row === "opacity") {
			const num = typeof value === "number" ? value : (obj?.value ?? 0);
			// linear → reine Zahl (wie das Plugin schreibt), sonst {value, interpolation}
			onChange(interp === "linear" ? num : { value: num, interpolation: interp });
		} else {
			const base = obj ?? {};
			const next = { ...base } as Exclude<UuiKeyframe, number>;
			if (interp === "linear") delete next.interpolation;
			else next.interpolation = interp;
			onChange(next);
		}
	};

	const numField = (label: string, key: string, current: number) => (
		<div key={key} className="flex items-center gap-1">
			<span className="text-muted-foreground text-xs">{label}</span>
			<Input
				className="h-6 w-16 text-xs"
				value={String(current)}
				onChange={(e) => {
					const n = Number(e.target.value) || 0;
					if (row === "rotation" || row === "opacity") {
						if (interpolation === "linear") onChange(n);
						else onChange({ value: n, interpolation });
					} else {
						onChange({
							...(obj ?? {}),
							[key]: n,
						} as UuiKeyframe);
					}
				}}
			/>
		</div>
	);

	return (
		<div className="flex flex-wrap items-center gap-2 border-border border-t px-2 py-1">
			<span className="font-medium text-xs">
				{row} @ tick {tick}
			</span>
			{row === "position" && (
				<>
					{numField("x", "x", Number(obj?.x ?? 0))}
					{numField("y", "y", Number(obj?.y ?? 0))}
				</>
			)}
			{row === "scale" && (
				<>
					{numField("w", "width", Number(obj?.width ?? 0))}
					{numField("h", "height", Number(obj?.height ?? 0))}
					{numField("offX", "offsetX", Number(obj?.offsetX ?? 0))}
					{numField("offY", "offsetY", Number(obj?.offsetY ?? 0))}
				</>
			)}
			{(row === "rotation" || row === "opacity") &&
				numField(
					row === "rotation" ? "deg" : "value",
					"value",
					typeof value === "number" ? value : Number(obj?.value ?? 0),
				)}
			<Select
				value={interpolation}
				onValueChange={(v) => setInterpolation(v as UuiInterpolation)}
			>
				<SelectTrigger className="h-6 w-28 text-xs">
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
			<Button
				size="icon-xs"
				variant="ghost"
				aria-label="Delete keyframe"
				onClick={onDelete}
			>
				<Trash2 />
			</Button>
		</div>
	);
}
