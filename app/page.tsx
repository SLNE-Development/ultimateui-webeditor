"use client";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Home() {
	return (
		<div>
			<Button
				variant={"destructive"}
				size={"lg"}
				onClick={() => toast.success("Hello World!")}
			>
				Hello
			</Button>
		</div>
	);
}
