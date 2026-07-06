/**
 * Zerlegt/erzeugt das führende Text-Markup von UltimateUI-Texten
 * (MiniMessage-Tags + Legacy-&-Codes), damit der Editor Farbe/Format als
 * eigene Controls anbieten kann und im Textfeld nur der Inhalt steht.
 *
 * Nur das PRÄFIX wird geparst — Tags mitten im Text (Mehrfarb-Texte) bleiben
 * unangetastet im Body erhalten. Unveränderte Elemente behalten ihren
 * Original-String (Roundtrip-Treue); erst eine Bearbeitung schreibt das
 * Markup neu (semantisch äquivalent: <#hex> + &-Formatcodes).
 */

export interface TextStyle {
	/** aus <font:...>-Präfix (undefined = kein Inline-Font-Tag) */
	font?: string;
	/** Hex ohne # aus <#..>/<color:..>/Named-/Legacy-Farbcode-Präfix */
	color?: string;
	bold: boolean;
	italic: boolean;
	underlined: boolean;
	strikethrough: boolean;
	obfuscated: boolean;
	/** Restlicher Text (kann weiterhin Inline-Tags enthalten) */
	body: string;
}

const NAMED_COLORS: Record<string, string> = {
	black: "000000",
	dark_blue: "0000aa",
	dark_green: "00aa00",
	dark_aqua: "00aaaa",
	dark_red: "aa0000",
	dark_purple: "aa00aa",
	gold: "ffaa00",
	gray: "aaaaaa",
	grey: "aaaaaa",
	dark_gray: "555555",
	dark_grey: "555555",
	blue: "5555ff",
	green: "55ff55",
	aqua: "55ffff",
	red: "ff5555",
	light_purple: "ff55ff",
	yellow: "ffff55",
	white: "ffffff",
};

const LEGACY_COLORS: Record<string, string> = {
	"0": "000000",
	"1": "0000aa",
	"2": "00aa00",
	"3": "00aaaa",
	"4": "aa0000",
	"5": "aa00aa",
	"6": "ffaa00",
	"7": "aaaaaa",
	"8": "555555",
	"9": "5555ff",
	a: "55ff55",
	b: "55ffff",
	c: "ff5555",
	d: "ff55ff",
	e: "ffff55",
	f: "ffffff",
};

export function parseTextMarkup(text: string | undefined): TextStyle {
	const style: TextStyle = {
		bold: false,
		italic: false,
		underlined: false,
		strikethrough: false,
		obfuscated: false,
		body: "",
	};
	let rest = text ?? "";

	for (;;) {
		let m: RegExpMatchArray | null;
		if ((m = rest.match(/^<font:([^>]+)>/i))) {
			style.font = m[1];
		} else if ((m = rest.match(/^<#([0-9a-fA-F]{6})>/))) {
			style.color = m[1].toLowerCase();
		} else if ((m = rest.match(/^<color:#?([0-9a-fA-F]{6})>/i))) {
			style.color = m[1].toLowerCase();
		} else if (
			(m = rest.match(
				/^<(black|dark_blue|dark_green|dark_aqua|dark_red|dark_purple|gold|gray|grey|dark_gray|dark_grey|blue|green|aqua|red|light_purple|yellow|white)>/i,
			))
		) {
			style.color = NAMED_COLORS[m[1].toLowerCase()];
		} else if ((m = rest.match(/^<(b|bold)>/i))) {
			style.bold = true;
		} else if ((m = rest.match(/^<(i|italic|em)>/i))) {
			style.italic = true;
		} else if ((m = rest.match(/^<(u|underlined)>/i))) {
			style.underlined = true;
		} else if ((m = rest.match(/^<(st|strikethrough)>/i))) {
			style.strikethrough = true;
		} else if ((m = rest.match(/^<(obf|obfuscated)>/i))) {
			style.obfuscated = true;
		} else if ((m = rest.match(/^[&§]([0-9a-fk-orA-FK-OR])/))) {
			const code = m[1].toLowerCase();
			if (code === "l") style.bold = true;
			else if (code === "o") style.italic = true;
			else if (code === "n") style.underlined = true;
			else if (code === "m") style.strikethrough = true;
			else if (code === "k") style.obfuscated = true;
			else if (code === "r") {
				style.bold = false;
				style.italic = false;
				style.underlined = false;
				style.strikethrough = false;
				style.obfuscated = false;
				style.color = undefined;
			} else if (LEGACY_COLORS[code]) style.color = LEGACY_COLORS[code];
		} else {
			break;
		}
		rest = rest.slice(m[0].length);
	}

	style.body = rest;
	return style;
}

/** Setzt Markup wieder zusammen: <font:>-Tag, <#hex>-Farbe, &-Formatcodes. */
export function composeTextMarkup(style: TextStyle): string {
	let out = "";
	if (style.font) out += `<font:${style.font}>`;
	if (style.color) out += `<#${style.color}>`;
	if (style.bold) out += "&l";
	if (style.italic) out += "&o";
	if (style.underlined) out += "&n";
	if (style.strikethrough) out += "&m";
	if (style.obfuscated) out += "&k";
	return out + style.body;
}

/** Bequemer Patch: parse → Änderungen anwenden → compose. */
export function patchTextMarkup(
	text: string | undefined,
	changes: Partial<TextStyle>,
): string {
	return composeTextMarkup({ ...parseTextMarkup(text), ...changes });
}
