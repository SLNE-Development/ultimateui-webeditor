"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { pageExists, sanitizePageName } from "@/lib/uui/storage";
import { useRouter } from "next/navigation";
import React from "react";

export default function CreateUiDialog({
	trigger,
}: {
	trigger: React.ReactNode;
}) {
	const router = useRouter();
	const [name, setName] = React.useState("");
	const [error, setError] = React.useState<string | null>(null);

	const create = () => {
		const clean = sanitizePageName(name);
		if (!clean) {
			setError("Please enter a name (a-z, 0-9, _ and - allowed).");
			return;
		}
		if (pageExists(clean)) {
			setError(`A UI named "${clean}" already exists.`);
			return;
		}
		router.push(`/editor/${encodeURIComponent(clean)}`);
	};

	return (
		<Dialog>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create UI</DialogTitle>
					<DialogDescription>
						Choose a name for the new UI. It becomes the file name on the
						server (contents/pages/&lt;name&gt;.yml).
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						create();
					}}
					className="flex flex-col gap-2"
				>
					<Input
						autoFocus
						placeholder="my_menu"
						value={name}
						onChange={(e) => {
							setName(e.target.value);
							setError(null);
						}}
					/>
					{error && <p className="text-destructive text-xs">{error}</p>}
					<DialogFooter>
						<Button type="submit">Create</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
