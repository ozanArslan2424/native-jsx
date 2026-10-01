import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

import { parse, type ParserPlugin } from "@babel/parser";
import type { Node, Program } from "@babel/types";

import RULES from "../../../config/rules.cjs";
import { logger, TaggedError, LOCAL_NAME, PKG_NAME } from "../../utils";
import { applyEdits } from "../applyEdits";
import {
	appendEdit,
	arrayTarget,
	end,
	findExport,
	importEdit,
	resolve,
	unwrap,
	type Target,
} from "../config-ast";
import type { Migration } from "./types";

const CONFIG_SOURCE = `${PKG_NAME}/eslint`;
const MANUAL = `import ${LOCAL_NAME} from "${CONFIG_SOURCE}" and add it to the end of your config array manually`;

const FLAT_CONFIGS = [
	"eslint.config.js",
	"eslint.config.mjs",
	"eslint.config.cjs",
	"eslint.config.ts",
	"eslint.config.mts",
	"eslint.config.cts",
];
const LEGACY_CONFIGS = [
	".eslintrc",
	".eslintrc.js",
	".eslintrc.cjs",
	".eslintrc.json",
	".eslintrc.yml",
	".eslintrc.yaml",
];

// Supports: [...], defineConfig([...]), tseslint.config(a, b, ...), and an identifier bound to any of those.
function findTarget(code: string, program: Program, node: Node): Target {
	const array = arrayTarget(node);
	if (array) return array;

	const current = unwrap(node);

	if (current.type === "CallExpression") {
		const [first] = current.arguments;
		if (current.arguments.length === 1 && first && unwrap(first).type === "ArrayExpression") {
			return findTarget(code, program, first);
		}
		return { items: current.arguments, open: code.indexOf("(", end(current.callee)) + 1 };
	}

	if (current.type === "Identifier") {
		const init = resolve(program, current.name);
		if (!init) throw new TaggedError(`couldn't resolve "${current.name}"`);
		return findTarget(code, program, init);
	}

	throw new TaggedError(`unsupported config export (${current.type})`);
}

export const eslint: Migration = {
	flag: "--eslint",
	description: `add the ${PKG_NAME} config to the eslint config`,
	run(cwd) {
		const file = FLAT_CONFIGS.map((name) => join(cwd, name)).find((path) => existsSync(path));

		if (!file) {
			const legacy = LEGACY_CONFIGS.find((name) => existsSync(join(cwd, name)));
			if (legacy) {
				logger.error(
					`${legacy} uses the legacy eslintrc format, add these rules to it manually: ${JSON.stringify(RULES)}`,
				);
				return 1;
			}
			logger.log("no eslint config found, skipped");
			return 0;
		}

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

			const target = findTarget(code, program, exported.node);
			const output = applyEdits(code, [
				importEdit(code, program, exported.cjs, CONFIG_SOURCE),
				appendEdit(code, target),
			]);

			writeFileSync(file, output);
			logger.log(`updated ${name}`);
			return 0;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logger.error(`${name}: ${message}, ${MANUAL}`);
			return 1;
		}
	},
};
