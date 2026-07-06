"use client";

import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { EditorTool } from "@/lib/uui/types";
import {
	AlignCenterHorizontal,
	Clapperboard,
	MousePointer2,
	PaintBucket,
	Pipette,
	Scaling,
	Type,
	Zap,
	ZoomIn,
} from "lucide-react";
import { useEditor } from "./store";

/** Die 9 Tools des Ingame-Editors (Enum EditorTool im Plugin). */
const TOOLS: { id: EditorTool; label: string; icon: React.ReactNode }[] = [
	{ id: "move", label: "Move tool", icon: <MousePointer2 /> },
	{ id: "scale", label: "Scale tool", icon: <Scaling /> },
	{ id: "align", label: "Align tool", icon: <AlignCenterHorizontal /> },
	{ id: "fill", label: "Fill tool", icon: <PaintBucket /> },
	{ id: "picker", label: "Picker tool", icon: <Pipette /> },
	{ id: "zoom", label: "Zoom tool", icon: <ZoomIn /> },
	{ id: "text", label: "Text tool", icon: <Type /> },
	{ id: "actions", label: "Action tool", icon: <Zap /> },
	{ id: "animation", label: "Animation tool", icon: <Clapperboard /> },
];

export default function Toolbar() {
	const { state, dispatch } = useEditor();

	return (
		<div className="flex flex-col gap-1 border-border border-r bg-background p-1">
			{TOOLS.map((t) => (
				<Tooltip key={t.id}>
					<TooltipTrigger asChild>
						<Button
							size="icon"
							variant={state.tool === t.id ? "secondary" : "ghost"}
							aria-label={t.label}
							aria-pressed={state.tool === t.id}
							onClick={() => {
								dispatch({ type: "set-tool", tool: t.id });
								if (t.id === "actions")
									dispatch({ type: "set-tab", tab: "properties" });
							}}
						>
							{t.icon}
						</Button>
					</TooltipTrigger>
					<TooltipContent side="right">{t.label}</TooltipContent>
				</Tooltip>
			))}
			{/* Aktuelle Farbe (wie ingame unten links beim Picker) */}
			<div className="mt-auto flex flex-col items-center gap-1 pb-1">
				<label
					className="size-6 cursor-pointer border border-border"
					style={{ backgroundColor: `#${state.fillColor}` }}
					title={`Current color #${state.fillColor}`}
				>
					<input
						type="color"
						className="invisible size-0"
						value={`#${state.fillColor}`}
						onChange={(e) =>
							dispatch({
								type: "set-fill-color",
								color: e.target.value.replace("#", ""),
							})
						}
					/>
				</label>
			</div>
		</div>
	);
}
