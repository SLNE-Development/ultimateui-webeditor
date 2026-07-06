"use client";

import { Button } from "@/components/ui/button";
import { newPage } from "@/lib/uui/defaults";
import { loadPage, savePage } from "@/lib/uui/storage";
import type { EditorPage } from "@/lib/uui/types";
import { X } from "lucide-react";
import React from "react";
import Canvas from "./canvas";
import Navbar, { BackgroundMenu, ScreenSimMenu } from "./navbar";
import Sidebar from "./sidebar";
import Toolbar from "./toolbar";
import {
	EditorCtx,
	editorReducer,
	initialEditorState,
} from "./store";
import Timeline from "./timeline";

export default function EditorApp({
	pageName,
	initialPreview,
}: {
	pageName: string;
	initialPreview: boolean;
}) {
	// Seite aus localStorage laden oder neu anlegen (nur client-seitig möglich)
	const [initialPage, setInitialPage] = React.useState<EditorPage | null>(
		null,
	);
	React.useEffect(() => {
		const existing = loadPage(pageName);
		if (existing) {
			setInitialPage(existing);
		} else {
			const fresh = newPage(pageName);
			savePage(fresh);
			setInitialPage(fresh);
		}
	}, [pageName]);

	if (!initialPage) {
		return (
			<div className="flex h-screen items-center justify-center text-muted-foreground text-sm">
				Loading editor…
			</div>
		);
	}
	return <EditorInner page={initialPage} initialPreview={initialPreview} />;
}

function EditorInner({
	page,
	initialPreview,
}: {
	page: EditorPage;
	initialPreview: boolean;
}) {
	const [state, dispatch] = React.useReducer(
		editorReducer,
		undefined,
		() => initialEditorState(page, initialPreview),
	);
	const ctx = React.useMemo(() => ({ state, dispatch }), [state]);

	// Autosave (config.yml: editor.autosave) — hier alle 60s wenn dirty
	React.useEffect(() => {
		const t = setInterval(() => {
			if (state.dirty) {
				savePage(state.page);
				dispatch({ type: "mark-saved" });
			}
		}, 60_000);
		return () => clearInterval(t);
	}, [state.dirty, state.page]);

	// Warnung beim Verlassen mit ungespeicherten Änderungen
	React.useEffect(() => {
		const onBeforeUnload = (e: BeforeUnloadEvent) => {
			if (state.dirty) e.preventDefault();
		};
		window.addEventListener("beforeunload", onBeforeUnload);
		return () => window.removeEventListener("beforeunload", onBeforeUnload);
	}, [state.dirty]);

	return (
		<EditorCtx.Provider value={ctx}>
			<div className="flex h-screen w-screen flex-col overflow-hidden">
				{!state.preview && <Navbar />}
				<div className="flex min-h-0 flex-1">
					{!state.preview && <Toolbar />}
					<div className="flex min-w-0 flex-1 flex-col">
						<Canvas />
						{!state.preview && state.showTimeline && <Timeline />}
					</div>
					{!state.preview && <Sidebar />}
				</div>
				{state.preview && (
					<div className="absolute top-3 right-3 z-50 flex items-center gap-1">
						<ScreenSimMenu />
						<BackgroundMenu />
						<Button
							size="icon"
							variant="secondary"
							aria-label="Exit preview"
							onClick={() =>
								dispatch({ type: "set-preview", preview: false })
							}
						>
							<X />
						</Button>
					</div>
				)}
			</div>
		</EditorCtx.Provider>
	);
}

