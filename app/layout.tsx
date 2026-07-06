import Providers from "@/app/providers";
import { Toaster } from "@/components/ui/sonner";
import ThemeSwitcher from "@/components/utils/theme-switcher";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "UltimateUI - Webeditor",
	description: "An editor for the Minecraft PaperMC Plugin UltimateUI",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			className={cn(
				"h-full",
				"antialiased",
				geistSans.variable,
				geistMono.variable,
				"font-sans",
				inter.variable,
			)}
			suppressHydrationWarning
		>
			<body className="min-h-full flex flex-col">
				<Providers>
					{children}
					<Toaster />
					<ThemeSwitcher />
				</Providers>
			</body>
		</html>
	);
}
