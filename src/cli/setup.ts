#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { logger, TaggedError, PKG_NAME } from "../utils";

const PRESET = `${PKG_NAME}/babel`;
const cwd = process.cwd();

function packageVersion(name: string) {
	const installed = join(cwd, "node_modules", name, "package.json");
	if (existsSync(installed)) return JSON.parse(readFileSync(installed, "utf8")).version;

	const manifest = join(cwd, "package.json");
	if (!existsSync(manifest)) return null;
	const pkg = JSON.parse(readFileSync(manifest, "utf8"));
	return pkg.dependencies?.[name] ?? pkg.devDependencies?.[name] ?? null;
}

function hasMajor(name: string, major: number) {
	const version = packageVersion(name);
	return version !== null && new RegExp(`^\\D*${major}\\.`).test(version);
}

// Libraries that need their own JSX runtime. Add new ones here; the first match wins.
const INTEGRATIONS = [
	{
		name: "nativewind v4",
		detect: () => hasMajor("nativewind", 4),
		jsxSource: `${PKG_NAME}/nativewind`,
		presetOptions: { nativewind: true },
		extraPresets: ["nativewind/babel"],
	},
];

const DEFAULT_INTEGRATION = {
	name: null,
	jsxSource: PKG_NAME,
	presetOptions: {},
	extraPresets: [],
};
const INTEGRATION = INTEGRATIONS.find((integration) => integration.detect()) ?? DEFAULT_INTEGRATION;
const JSX_SOURCE = INTEGRATION.jsxSource;
const OPTION_KEYS = INTEGRATIONS.flatMap((integration) => Object.keys(integration.presetOptions));

function formatOptions(options: Record<string, unknown>) {
	return Object.entries(options).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
}

function presetEntry(extraOptions: Array<Record<string, unknown>> = []) {
	const options = [...extraOptions, ...formatOptions(INTEGRATION.presetOptions)];
	return options.length > 0 ? `["${PRESET}", { ${options.join(", ")} }]` : `"${PRESET}"`;
}

const PRESET_ENTRY = presetEntry();

function isPresetConfigured(content: string) {
	return OPTION_KEYS.every(
		(key) => new RegExp(`\\b${key}\\s*:`).test(content) === key in INTEGRATION.presetOptions,
	);
}

const BABEL_CONFIGS = ["babel.config.js", "babel.config.cjs"];
const EXPO_TUPLE = /\[\s*(["'])babel-preset-expo\1\s*,\s*\{([^{}]*)\}\s*,?\s*\]/;
const EXPO_TUPLE_START = /\[\s*(["'])babel-preset-expo\1\s*,/;
const EXPO_PLAIN = /(["'])babel-preset-expo\1/;

function rewriteExpoPreset(content: string, file: string) {
	if (EXPO_TUPLE.test(content)) {
		return content.replace(EXPO_TUPLE, (_match, _quote, options) => {
			const kept = options
				.replace(/\s*jsxImportSource\s*:\s*(["'])[^"']*\1\s*,?/, "")
				.trim()
				.replace(/,$/, "");
			return presetEntry(kept ? [kept] : []);
		});
	}

	if (EXPO_TUPLE_START.test(content)) {
		throw new TaggedError(
			`couldn't safely rewrite the babel-preset-expo options in ${file}, replace the preset with ${PRESET_ENTRY} manually`,
		);
	}

	if (EXPO_PLAIN.test(content)) return content.replace(EXPO_PLAIN, PRESET_ENTRY);

	throw new TaggedError(
		`couldn't find babel-preset-expo in ${file}, replace your preset with ${PRESET_ENTRY} manually`,
	);
}

function setupBabel() {
	if (INTEGRATION.name) logger.log(`detected ${INTEGRATION.name}`);

	const existing = BABEL_CONFIGS.map((name) => join(cwd, name)).find((path) => existsSync(path));

	if (!existing) {
		const content = `
module.exports = function (api) {
    api.cache(true);
    return {
        presets: [${[PRESET_ENTRY, ...INTEGRATION.extraPresets.map((preset) => JSON.stringify(preset))].join(", ")}]
    };
};
`.trim();

		writeFileSync(join(cwd, "babel.config.js"), content);
		return "created babel.config.js";
	}

	const content = readFileSync(existing, "utf8");

	if (content.includes(PRESET)) {
		if (isPresetConfigured(content)) return "babel config already configured";
		throw new TaggedError(
			`${existing} uses ${PRESET} with options that don't match this project, change it to ${PRESET_ENTRY} manually`,
		);
	}

	writeFileSync(existing, rewriteExpoPreset(content, existing));
	return `updated ${existing}`;
}

function parseJsonc(text: string) {
	let i = 0;

	function fail(message: string): never {
		throw new TaggedError(`tsconfig.json: ${message} at offset ${i}`);
	}

	function skip() {
		while (i < text.length) {
			const c = text[i];
			if (c === " " || c === "\t" || c === "\n" || c === "\r") {
				i++;
			} else if (c === "/" && text[i + 1] === "/") {
				while (i < text.length && text[i] !== "\n") i++;
			} else if (c === "/" && text[i + 1] === "*") {
				const end = text.indexOf("*/", i + 2);
				if (end === -1) fail("unterminated comment");
				i = end + 2;
			} else {
				return;
			}
		}
	}

	function string() {
		const start = i++;
		while (text[i] !== '"') {
			if (i >= text.length) fail("unterminated string");
			if (text[i] === "\\") i++;
			i++;
		}
		i++;
		return JSON.parse(text.slice(start, i));
	}

	function literal() {
		const match = /^[^\s,\]}/]+/.exec(text.slice(i));
		if (!match) fail("unexpected token");
		i += match[0].length;
		return JSON.parse(match[0]);
	}

	function list(close: string, onItem: () => void) {
		i++;
		skip();
		while (text[i] !== close) {
			if (i >= text.length) fail(`expected "${close}"`);
			onItem();
			skip();
			if (text[i] === ",") {
				i++;
				skip();
			} else if (text[i] !== close) {
				fail(`expected "," or "${close}"`);
			}
		}
		i++;
	}

	type JsonNode = {
		props: Map<string, JsonNode>;
		value: string;
		start: number;
		end: number;
	};

	function value() {
		skip();
		const node: JsonNode = { start: i, end: 0, props: new Map(), value: "" };
		if (text[i] === "{") {
			node.props = new Map();
			list("}", () => {
				if (text[i] !== '"') fail("expected property name");
				const key = string();
				skip();
				if (text[i] !== ":") fail('expected ":"');
				i++;
				node.props?.set(key, value());
			});
		} else if (text[i] === "[") {
			list("]", value);
		} else if (text[i] === '"') {
			node.value = string();
		} else {
			node.value = literal();
		}
		node.end = i;
		return node;
	}

	const root = value();
	skip();
	if (i < text.length) fail("unexpected trailing content");
	return root;
}

function setupTsconfig() {
	const file = join(cwd, "tsconfig.json");
	if (!existsSync(file)) throw new TaggedError("tsconfig.json not found");

	const text = readFileSync(file, "utf8");
	const root = parseJsonc(text);
	if (!root.props) throw new TaggedError("tsconfig.json: root isn't an object");

	const desired = { jsx: "react-jsx", jsxImportSource: JSX_SOURCE };
	const unit = /^[ \t]+/m.exec(text)?.[0] ?? "  ";
	const line = (key: string, value: string) =>
		`${unit}${unit}${JSON.stringify(key)}: ${JSON.stringify(value)}`;
	const edits = [];

	const compilerOptions = root.props.get("compilerOptions");
	if (!compilerOptions) {
		const body = Object.entries(desired)
			.map(([key, value]) => line(key, value))
			.join(",\n");
		const tail = root.props.size > 0 ? "," : "\n";
		edits.push({
			start: root.start + 1,
			end: root.start + 1,
			text: `\n${unit}"compilerOptions": {\n${body}\n${unit}}${tail}`,
		});
	} else {
		if (!compilerOptions.props)
			throw new TaggedError("tsconfig.json: compilerOptions isn't an object");

		const missing = [];
		for (const [key, value] of Object.entries(desired)) {
			const existing = compilerOptions.props.get(key);
			if (!existing) {
				missing.push(line(key, value));
			} else if (existing.value !== value) {
				edits.push({ start: existing.start, end: existing.end, text: JSON.stringify(value) });
			}
		}

		if (missing.length > 0) {
			const empty = compilerOptions.props.size === 0;
			edits.push({
				start: compilerOptions.start + 1,
				end: compilerOptions.start + 1,
				text: `\n${missing.join(",\n")}${empty ? `\n${unit}` : ","}`,
			});
		}
	}

	if (edits.length === 0) return "tsconfig.json already configured";

	let output = text;
	for (const edit of edits.sort((a, b) => b.start - a.start)) {
		output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
	}
	writeFileSync(file, output);
	return "updated tsconfig.json";
}

export function setup() {
	let failed = false;
	for (const step of [setupBabel, setupTsconfig]) {
		try {
			logger.log(`${step()}`);
		} catch (err) {
			logger.error(`${String(err)}`);
			failed = true;
		}
	}

	if (!failed) logger.log("done, restart with: npx expo start --clear");
	return failed ? 1 : 0;
}
