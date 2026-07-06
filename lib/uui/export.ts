import JSZip from "jszip";
import { getAsset } from "./assets";
import {
	effectToYaml,
	listCustomEffects,
} from "./effects";
import { flatten } from "./tree";
import type { EditorPage } from "./types";
import { pageToYaml } from "./yaml";

function download(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

/** Einzelne Page als .yml — direkt nach plugins/UltimateUI/contents/pages/ hochladbar. */
export function exportYml(page: EditorPage) {
	const yml = pageToYaml(page);
	download(
		new Blob([yml], { type: "text/yaml" }),
		`${page.name}.yml`,
	);
}

/** Alle im Projekt referenzierten Bildnamen (image + hover.image). */
function collectImageNames(page: EditorPage): string[] {
	const names = new Set<string>();
	for (const el of flatten(page.blocks)) {
		if (el.type === "image" && el.image) names.add(el.image);
		if (el.hover?.image) names.add(el.hover.image);
	}
	return [...names];
}

/** Alle referenzierten Effektnamen (hover/click/open/close). */
function collectEffectRefs(page: EditorPage): string[] {
	const names = new Set<string>();
	for (const el of flatten(page.blocks)) {
		if (el.hover?.effect) names.add(el.hover.effect);
		if (el.click?.effect) names.add(el.click.effect);
	}
	if (page.animation?.open?.effect) names.add(page.animation.open.effect);
	if (page.animation?.close?.effect) names.add(page.animation.close.effect);
	return [...names];
}

/** ZIP mit der Server-Ordnerstruktur: contents/pages/<name>.yml plus alle
 *  hochgeladenen Bilder unter contents/images/ (das Plugin generiert daraus
 *  beim Start automatisch Resource-Pack-Glyphen). In plugins/UltimateUI/
 *  entpacken, dann /uui reload. */
export async function exportZip(page: EditorPage) {
	const zip = new JSZip();
	zip.file(`contents/pages/${page.name}.yml`, pageToYaml(page));

	const imageNames = collectImageNames(page);
	const bundled: string[] = [];
	const missing: string[] = [];
	for (const name of imageNames) {
		const blob = await getAsset(`img:${name}`);
		if (blob) {
			zip.file(`contents/images/${name}.png`, blob);
			bundled.push(name);
		} else missing.push(name);
	}

	// selbst erstellte Effekt-Presets, die diese Page referenziert
	const customEffects = listCustomEffects();
	const bundledEffects: string[] = [];
	for (const ref of collectEffectRefs(page)) {
		const effect = customEffects[ref];
		if (effect) {
			zip.file(`contents/effects/${ref}.yml`, effectToYaml(effect));
			bundledEffects.push(ref);
		}
	}

	zip.file(
		"README.txt",
		[
			"UltimateUI export — created with the UltimateUI web editor",
			"",
			"Installation:",
			"1. Extract this zip into plugins/UltimateUI/ on your server",
			`   (page: plugins/UltimateUI/contents/pages/${page.name}.yml`,
			"    images: plugins/UltimateUI/contents/images/*.png).",
			"2. Run /uui reload — the plugin regenerates its resource pack",
			"   glyphs for the images automatically.",
			`3. Open it in game with /uui open ${page.name}`,
			"",
			bundled.length ? `Bundled images: ${bundled.join(", ")}` : "",
			bundledEffects.length
				? `Bundled effects: ${bundledEffects.join(", ")} (contents/effects/)`
				: "",
			missing.length
				? `MISSING images (referenced but not uploaded in the web editor): ${missing.join(", ")} — put these PNGs into contents/images/ yourself.`
				: "",
			"",
		]
			.filter((l) => l !== "")
			.join("\n"),
	);
	const blob = await zip.generateAsync({ type: "blob" });
	download(blob, `${page.name}-ultimateui.zip`);
}
