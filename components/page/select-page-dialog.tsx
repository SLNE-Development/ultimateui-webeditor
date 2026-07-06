"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	EXAMPLES,
	importExample,
	importYamlFile,
} from "@/lib/uui/import";
import {
	deletePage,
	listPages,
	type StoredPageMeta,
} from "@/lib/uui/storage";
import { cn } from "@/lib/utils";
import { FileUp, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";
import { toast } from "sonner";

interface SelectPageDialogProps {
	trigger: React.ReactNode;
	title: string;
	description: string;
	/** "edit" öffnet den Editor, "preview" den Ansichtsmodus */
	mode: "edit" | "preview";
}

export default function SelectPageDialog({
	trigger,
	title,
	description,
	mode,
}: SelectPageDialogProps) {
	const router = useRouter();
	const [pages, setPages] = React.useState<StoredPageMeta[]>([]);
	const [open, setOpen] = React.useState(false);
	const [dragOver, setDragOver] = React.useState(false);
	const fileInputRef = React.useRef<HTMLInputElement>(null);

	React.useEffect(() => {
		if (open) setPages(listPages());
	}, [open]);

	const openPage = (name: string) => {
		const suffix = mode === "preview" ? "?mode=preview" : "";
		router.push(`/editor/${encodeURIComponent(name)}${suffix}`);
	};

	const importFiles = async (files: FileList | File[]) => {
		for (const file of Array.from(files)) {
			if (!/\.ya?ml$/i.test(file.name)) {
				toast.error(`${file.name}: not a .yml file`);
				continue;
			}
			try {
				const page = await importYamlFile(file);
				toast.success(`Imported "${page.name}"`);
			} catch (err) {
				toast.error(
					`${file.name}: ${err instanceof Error ? err.message : "import failed"}`,
				);
			}
		}
		setPages(listPages());
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent
				className={cn(
					"sm:max-w-md",
					dragOver && "ring-2 ring-primary",
				)}
				onDragOver={(e) => {
					e.preventDefault();
					setDragOver(true);
				}}
				onDragLeave={() => setDragOver(false)}
				onDrop={(e) => {
					e.preventDefault();
					setDragOver(false);
					if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files);
				}}
			>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>

				{/* Import: Upload-Button + Drag&Drop */}
				<div className="flex items-center gap-2">
					<Button
						size="sm"
						variant="outline"
						onClick={() => fileInputRef.current?.click()}
					>
						<FileUp /> Import .yml
					</Button>
					<span className="text-muted-foreground text-xs">
						…or drag &amp; drop a .yml anywhere in this dialog
					</span>
					<input
						ref={fileInputRef}
						type="file"
						accept=".yml,.yaml"
						multiple
						className="hidden"
						onChange={(e) => {
							if (e.target.files?.length) importFiles(e.target.files);
							e.target.value = "";
						}}
					/>
				</div>

				{pages.length === 0 ? (
					<p className="border border-border border-dashed p-3 text-muted-foreground text-xs">
						No saved UIs yet. Create one from the home screen, import a .yml
						from your PC, or start from an example below.
					</p>
				) : (
					<ul className="flex max-h-60 flex-col gap-1 overflow-y-auto">
						{pages.map((p) => (
							<li
								key={p.name}
								className="flex items-center justify-between gap-2 border border-border p-2"
							>
								<div className="min-w-0">
									<p className="truncate font-medium text-sm">{p.name}</p>
									<p className="truncate text-muted-foreground text-xs">
										{p.description || "No description"} ·{" "}
										{new Date(p.updatedAt).toLocaleString()}
									</p>
								</div>
								<div className="flex shrink-0 gap-1">
									<Button size="sm" onClick={() => openPage(p.name)}>
										{mode === "preview" ? "Open" : "Edit"}
									</Button>
									<Button
										size="icon-sm"
										variant="ghost"
										aria-label={`Delete ${p.name}`}
										onClick={() => {
											deletePage(p.name);
											setPages(listPages());
										}}
									>
										<Trash2 />
									</Button>
								</div>
							</li>
						))}
					</ul>
				)}

				{/* Beispiele */}
				<div className="flex flex-col gap-1">
					<p className="flex items-center gap-1 font-medium text-muted-foreground text-xs">
						<Sparkles className="size-3" /> Examples (real UIs from the in-game
						editor)
					</p>
					<div className="flex flex-wrap gap-1">
						{EXAMPLES.map((ex) => (
							<Button
								key={ex.file}
								size="xs"
								variant="secondary"
								onClick={async () => {
									try {
										const page = await importExample(ex.file);
										toast.success(`Imported "${page.name}"`);
										openPage(page.name);
									} catch {
										toast.error("Failed to load example");
									}
								}}
							>
								{ex.label}
							</Button>
						))}
					</div>
				</div>

				<p className="text-muted-foreground text-xs">
					UIs are stored in your browser (localStorage). Use File → Export in
					the editor to download the .yml for your server.
				</p>
			</DialogContent>
		</Dialog>
	);
}
