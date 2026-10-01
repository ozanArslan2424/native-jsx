import fs from "node:fs";
import path from "node:path";

import { parse, type ParserPlugin } from "@babel/parser";
import type { File, ImportDeclaration, Node } from "@babel/types";

import { logger, TaggedError } from "../utils";
import type { Edit } from "./applyEdits";

export type Specifier = ImportDeclaration["specifiers"][number];
export type Visit = (node: Node, parent: Node | null, key: string | null) => void;
type Range = { start: number; end: number };

const SKIPPED_KEYS = new Set([
	"loc",
	"extra",
	"leadingComments",
	"trailingComments",
	"innerComments",
]);

export function parseFile(code: string, file: string): File {
	const plugins: Array<ParserPlugin> = [];
	if (!file.endsWith(".ts")) plugins.push("jsx");
	if (file.endsWith(".ts") || file.endsWith(".tsx")) plugins.push("typescript");
	return parse(code, { sourceType: "module", plugins });
}

export function isNode(value: unknown): value is Node {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as { type?: unknown }).type === "string"
	);
}

export function walk(
	value: unknown,
	visit: Visit,
	parent: Node | null = null,
	key: string | null = null,
): void {
	if (Array.isArray(value)) {
		for (const child of value) walk(child, visit, parent, key);
		return;
	}
	if (!isNode(value)) return;

	visit(value, parent, key);
	for (const [childKey, child] of Object.entries(value)) {
		if (SKIPPED_KEYS.has(childKey)) continue;
		if (child && typeof child === "object") walk(child, visit, value, childKey);
	}
}

export function range(node: Node): Range {
	if (node.start == null || node.end == null) {
		throw new TaggedError(`missing source range on ${node.type}`);
	}
	return { start: node.start, end: node.end };
}

function lineEnd(code: string, index: number): number {
	if (code[index] === "\n") return index + 1;
	if (code[index] === "\r" && code[index + 1] === "\n") return index + 2;
	return index;
}

export function removeSpecifiers(
	code: string,
	declaration: ImportDeclaration,
	removed: ReadonlySet<Specifier>,
): Array<Edit> {
	const specifiers = declaration.specifiers;
	const kept = specifiers.filter((specifier) => !removed.has(specifier));
	const declarationRange = range(declaration);

	if (kept.length === 0) {
		return [{ start: declarationRange.start, end: lineEnd(code, declarationRange.end), text: "" }];
	}

	const [firstKept] = kept;
	if (firstKept && !kept.some((specifier) => specifier.type === "ImportSpecifier")) {
		const sourceRange = range(declaration.source);
		const source = code.slice(sourceRange.start, sourceRange.end);
		const semicolon = code[declarationRange.end - 1] === ";" ? ";" : "";
		return [
			{
				start: declarationRange.start,
				end: declarationRange.end,
				text: `import ${firstKept.local.name} from ${source}${semicolon}`,
			},
		];
	}

	const edits: Array<Edit> = [];
	const lastKept = specifiers.reduce(
		(last, specifier, index) => (removed.has(specifier) ? last : index),
		-1,
	);

	for (const [i, specifier] of specifiers.entries()) {
		if (i >= lastKept) break;
		if (!removed.has(specifier)) continue;

		const next = specifiers[i + 1];
		if (!next) throw new TaggedError("missing specifier after removed specifier");
		edits.push({ start: range(specifier).start, end: range(next).start, text: "" });
	}

	const lastKeptSpecifier = specifiers[lastKept];
	const lastSpecifier = specifiers[specifiers.length - 1];
	if (lastKeptSpecifier && lastSpecifier && lastKept < specifiers.length - 1) {
		edits.push({ start: range(lastKeptSpecifier).end, end: range(lastSpecifier).end, text: "" });
	}

	return edits;
}

const IGNORED_DIRS = new Set(["node_modules", "ios", "android", "dist", "build"]);

export function* files(dir: string, extensions: ReadonlySet<string>): Generator<string> {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.name.startsWith(".") || IGNORED_DIRS.has(entry.name)) continue;
		const fpath = path.join(dir, entry.name);
		if (entry.isDirectory()) yield* files(fpath, extensions);
		else if (entry.isFile() && extensions.has(path.extname(entry.name))) yield fpath;
	}
}

type FileMigration = {
	extensions: ReadonlySet<string>;
	/** Cheap text check to skip parsing files that can't be affected. */
	shouldVisit(code: string): boolean;
	/** Returns the new source, or null when nothing changed. Throw to skip the file. */
	transform(code: string, file: string): string | null;
};

export function migrateFiles(cwd: string, migration: FileMigration): number {
	let changed = 0;
	let failed = 0;

	for (const file of files(cwd, migration.extensions)) {
		const code = fs.readFileSync(file, "utf8");
		if (!migration.shouldVisit(code)) continue;

		let output: string | null;
		try {
			output = migration.transform(code, file);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			logger.error(`skipped ${path.relative(cwd, file)}: ${message}`);
			failed++;
			continue;
		}

		if (output === null || output === code) continue;
		fs.writeFileSync(file, output);
		logger.log(`migrated ${path.relative(cwd, file)}`);
		changed++;
	}

	logger.log(`${changed} file(s) migrated${failed ? `, ${failed} skipped` : ""}`);
	return failed ? 1 : 0;
}
