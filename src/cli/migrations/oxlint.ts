import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { parse, type ParserPlugin } from "@babel/parser";
import type { Node, ObjectExpression, ObjectProperty, Program } from "@babel/types";

import RULES from "../../../config/rules.cjs";
import { logger, TaggedError, LOCAL_NAME, PKG_NAME } from "../../utils";
import { applyEdits, type Edit } from "../applyEdits";
import {
	appendEdit,
	arrayTarget,
	findExport,
	importEdit,
	resolve,
	start,
	unwrap,
} from "../config-ast";
import type { Migration } from "./types";

const CONFIG_SOURCE = `${PKG_NAME}/oxlint`;
const MANUAL = `import ${LOCAL_NAME} from "${CONFIG_SOURCE}" and add it to the end of your config's extends array manually`;

const TS_CONFIGS = [
	"oxlint.config.ts",
	"oxlint.config.mts",
	"oxlint.config.cts",
	"oxlint.config.js",
	"oxlint.config.mjs",
	"oxlint.config.cjs",
];
const JSON_CONFIG = ".oxlintrc.json";

// Supports: { ... }, defineConfig({ ... }), and an identifier bound to either.
function findConfigObject(program: Program, node: Node): ObjectExpression {
	const current = unwrap(node);

	if (current.type === "ObjectExpression") return current;

	if (current.type === "CallExpression") {
		const [first] = current.arguments;
		if (first) return findConfigObject(program, first);
	}

	if (current.type === "Identifier") {
		const init = resolve(program, current.name);
		if (!init) throw new TaggedError(`couldn't resolve "${current.name}"`);
		return findConfigObject(program, init);
	}

	throw new TaggedError(`unsupported config export (${current.type})`);
}

function findExtends(object: ObjectExpression): ObjectProperty | undefined {
	return object.properties.find(
		(property): property is ObjectProperty =>
			property.type === "ObjectProperty" &&
			((property.key.type === "Identifier" && property.key.name === "extends") ||
				(property.key.type === "StringLiteral" && property.key.value === "extends")),
	);
}

function extendsEdit(code: string, object: ObjectExpression): Edit {
	const property = findExtends(object);

	if (property) {
		const target = arrayTarget(property.value);
		if (!target) throw new TaggedError("extends is not an array literal");
		return appendEdit(code, target);
	}

	const entry = `extends: [${LOCAL_NAME}]`;
	const first = object.properties[0];

	if (!first) {
		const open = start(object) + 1;
		return { start: open, end: open, text: ` ${entry} ` };
	}

	const lineStart = code.lastIndexOf("\n", start(first) - 1) + 1;
	const prefix = code.slice(lineStart, start(first));

	return /^\s*$/.test(prefix)
		? { start: lineStart, end: lineStart, text: `${prefix}${entry},\n` }
		: { start: start(first), end: start(first), text: `${entry}, ` };
}

function migrateTs(file: string): number {
	const name = basename(file);
	const code = readFileSync(file, "utf8");

	if (code.includes(CONFIG_SOURCE)) {
		logger.log(`${name} already configured`);
		return 0;
	}

	try {
		const plugins: Array<ParserPlugin> = /\.[cm]?ts$/.test(file) ? ["typescript"] : [];
		const program = parse(code, { sourceType: "module", plugins }).program;

		const exported = findExport(program);
		if (!exported) throw new TaggedError("couldn't find the exported config");

		const object = findConfigObject(program, exported.node);
		const output = applyEdits(code, [
			importEdit(code, program, exported.cjs, CONFIG_SOURCE),
			extendsEdit(code, object),
		]);

		writeFileSync(file, output);
		logger.log(`updated ${name}`);
		return 0;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		logger.error(`${name}: ${message}, ${MANUAL}`);
		return 1;
	}
}

function migrateJson(file: string): number {
	const code = readFileSync(file, "utf8");

	let config: { rules?: Record<string, unknown> };
	try {
		config = JSON.parse(code);
	} catch {
		logger.error(
			`${JSON_CONFIG} couldn't be parsed (comments?), add these rules manually: ${JSON.stringify(RULES)}`,
		);
		return 1;
	}

	const missing = Object.entries(RULES).filter(([rule]) => config.rules?.[rule] === undefined);

	if (missing.length === 0) {
		logger.log(`${JSON_CONFIG} already configured`);
		return 0;
	}

	config.rules = { ...config.rules, ...Object.fromEntries(missing) };

	const indent = code.match(/^([ \t]+)"/m)?.[1] ?? "\t";
	writeFileSync(file, `${JSON.stringify(config, null, indent)}\n`);
	logger.log(`updated ${JSON_CONFIG}`);
	return 0;
}

export const oxlint: Migration = {
	flag: "--oxlint",
	description: `add the ${PKG_NAME} config to the oxlint config`,
	run(cwd) {
		const file = TS_CONFIGS.map((name) => join(cwd, name)).find((path) => existsSync(path));
		if (file) return migrateTs(file);

		const json = join(cwd, JSON_CONFIG);
		if (existsSync(json)) return migrateJson(json);

		logger.log("no oxlint config found, skipped");
		return 0;
	},
};
