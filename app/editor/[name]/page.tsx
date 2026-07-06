import EditorApp from "@/components/editor/editor-app";

export default async function EditorPage({
	params,
	searchParams,
}: {
	params: Promise<{ name: string }>;
	searchParams: Promise<{ mode?: string }>;
}) {
	const { name } = await params;
	const { mode } = await searchParams;
	return (
		<EditorApp
			pageName={decodeURIComponent(name)}
			initialPreview={mode === "preview"}
		/>
	);
}
