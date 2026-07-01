"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { PropsWithChildren } from "react";

export default function Providers({ children }: PropsWithChildren) {
	return (
		<ThemeProvider
			enableSystem
			attribute="class"
			defaultTheme="system"
			disableTransitionOnChange
		>
			<TooltipProvider>{children}</TooltipProvider>;
		</ThemeProvider>
	);
}
