"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { PropsWithChildren } from "react";

export default function Providers({ children }: PropsWithChildren) {
	return <TooltipProvider>{children}</TooltipProvider>;
}
