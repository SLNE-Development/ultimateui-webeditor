import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { X } from "lucide-react";
import React from "react";

interface SelectPageDialogProps {
	trigger: React.ReactNode;
	title: string;
	description: string;
	footer: React.ReactNode;
}

export default function SelectPageDialog({
	trigger,
	title,
	description,
	footer,
}: SelectPageDialogProps) {
	return (
		<Dialog>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<DialogClose asChild>
					<Button variant={"outline"}>
						<X />
					</Button>
				</DialogClose>
				<DialogFooter>{footer}</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
