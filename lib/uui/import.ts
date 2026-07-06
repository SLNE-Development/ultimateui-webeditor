import { pageExists, savePage } from "./storage";
import type { EditorPage } from "./types";
import { yamlToPage } from "./yaml";

/**
 * Importiert eine UltimateUI-Page aus YAML-Text (Upload/Drag&Drop/Beispiel),
 * speichert sie im Browser und liefert den Storage-Namen zurück.
 * Bei Namenskonflikt wird _1, _2, … angehängt (nichts wird überschrieben).
 */
export function importYamlText(text: string): EditorPage {
	const page = yamlToPage(text);
	let name = page.name?.trim() || "imported_ui";
	if (pageExists(name)) {
		for (let i = 1; ; i++) {
			const candidate = `${name}_${i}`;
			if (!pageExists(candidate)) {
				name = candidate;
				break;
			}
		}
	}
	const stored = { ...page, name };
	savePage(stored);
	return stored;
}

export function importYamlFile(file: File): Promise<EditorPage> {
	return file.text().then((text) => importYamlText(text));
}

/** Mitgelieferte echte Beispiel-UIs (aus dem Ingame-Editor gespeichert). */
export const EXAMPLES = [
	{ file: "profile.yml", label: "Profile (Menü mit Icons & Redirect)" },
	{ file: "profile_rtp.yml", label: "Serverauswahl (Hover-Bilder)" },
	{ file: "scoreboard.yml", label: "Scoreboard (HUD, Placeholder)" },
	{ file: "hud.yml", label: "Skill-HUD (minimal)" },
] as const;

export async function importExample(file: string): Promise<EditorPage> {
	const res = await fetch(`/examples/${file}`);
	if (!res.ok) throw new Error(`Example ${file} not found`);
	return importYamlText(await res.text());
}
