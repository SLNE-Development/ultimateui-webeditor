import type { NumExpr } from "./types";

/**
 * Sicherer Auswerter für die Rechenausdrücke des Plugins (position/size/layer),
 * z.B. "1920/2", "9200.0+500", "(660/100)*%player_level_percent%".
 * Placeholder werden für die Editor-Vorschau durch ihren DEFAULT (oder 0) ersetzt.
 * Unterstützt + - * / ( ) sowie abs/min/max/floor/round — wie der Plugin-Parser.
 */
export function evalNumExpr(expr: NumExpr | undefined, fallback = 0): number {
	if (expr === undefined || expr === null) return fallback;
	if (typeof expr === "number") return expr;
	let s = expr.trim();
	if (s === "") return fallback;

	// Placeholder %...% bzw. %%...%% → DEFAULT=… wenn vorhanden, sonst 0
	s = s.replace(/%%?[^%]*?%%?/g, (m) => {
		const def = /DEFAULT=([-\d.]+)/.exec(m);
		return def ? def[1] : "0";
	});
	// {var}/${var}-Reste (Component-Params) → 0
	s = s.replace(/\$?\{[^}]*\}/g, "0");

	const num = Number(s);
	if (!Number.isNaN(num)) return num;

	try {
		return parseExpression(s);
	} catch {
		return fallback;
	}
}

/** Rekursiver Abstiegsparser: expression := term (('+'|'-') term)* */
function parseExpression(input: string): number {
	const state = { s: input, pos: 0 };
	const value = parseAdd(state);
	skipWs(state);
	if (state.pos < state.s.length) throw new Error("trailing input");
	return value;
}

type S = { s: string; pos: number };

function skipWs(st: S) {
	while (st.pos < st.s.length && /\s/.test(st.s[st.pos])) st.pos++;
}

function parseAdd(st: S): number {
	let left = parseMul(st);
	for (;;) {
		skipWs(st);
		const c = st.s[st.pos];
		if (c === "+" || c === "-") {
			st.pos++;
			const right = parseMul(st);
			left = c === "+" ? left + right : left - right;
		} else return left;
	}
}

function parseMul(st: S): number {
	let left = parseFactor(st);
	for (;;) {
		skipWs(st);
		const c = st.s[st.pos];
		if (c === "*" || c === "/") {
			st.pos++;
			const right = parseFactor(st);
			if (c === "/") {
				if (right === 0) throw new Error("Division by zero");
				left = left / right;
			} else left = left * right;
		} else return left;
	}
}

const FUNCS: Record<string, (...args: number[]) => number> = {
	abs: Math.abs,
	min: Math.min,
	max: Math.max,
	floor: Math.floor,
	round: Math.round,
};

function parseFactor(st: S): number {
	skipWs(st);
	const c = st.s[st.pos];
	if (c === "(") {
		st.pos++;
		const v = parseAdd(st);
		skipWs(st);
		if (st.s[st.pos] !== ")") throw new Error("Missing closing parenthesis");
		st.pos++;
		return v;
	}
	if (c === "-") {
		st.pos++;
		return -parseFactor(st);
	}
	if (c === "+") {
		st.pos++;
		return parseFactor(st);
	}
	// Funktion?
	const fn = /^([a-z]+)\(/.exec(st.s.slice(st.pos));
	if (fn && FUNCS[fn[1]]) {
		st.pos += fn[1].length + 1;
		const args: number[] = [parseAdd(st)];
		skipWs(st);
		while (st.s[st.pos] === ",") {
			st.pos++;
			args.push(parseAdd(st));
			skipWs(st);
		}
		if (st.s[st.pos] !== ")") throw new Error("Missing closing parenthesis");
		st.pos++;
		return FUNCS[fn[1]](...args);
	}
	const m = /^\d*\.?\d+/.exec(st.s.slice(st.pos));
	if (!m) throw new Error(`unexpected char at ${st.pos}`);
	st.pos += m[0].length;
	return Number(m[0]);
}

/** Formatiert einen numerischen Wert für die Anzeige in Property-Feldern. */
export function formatNum(v: number): string {
	return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}
