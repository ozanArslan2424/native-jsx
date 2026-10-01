import type { ImportDeclaration, ImportSpecifier } from "@babel/types";

import { TaggedError } from "../../utils";
import { applyEdits, type Edit } from "../applyEdits";
import { migrateFiles, parseFile, range, removeSpecifiers, walk } from "../ast";
import type { Migration } from "./types";

const GLOBAL = "Styles";
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const BINDINGS = new Set([
	"VariableDeclarator",
	"FunctionDeclaration",
	"ClassDeclaration",
	"ImportSpecifier",
	"ImportDefaultSpecifier",
	"ImportNamespaceSpecifier",
]);

type Entry = { specifier: ImportSpecifier; declaration: ImportDeclaration };

function findImport(body: Array<import("@babel/types").Statement>): Entry | null {
	for (const statement of body) {
		if (statement.type !== "ImportDeclaration") continue;
		if (statement.source.value !== "react-native" || statement.importKind === "type") continue;

		for (const specifier of statement.specifiers) {
			if (specifier.type !== "ImportSpecifier" || specifier.importKind === "type") continue;
			const name =
				specifier.imported.type === "Identifier"
					? specifier.imported.name
					: specifier.imported.value;
			if (name === "StyleSheet") return { specifier, declaration: statement };
		}
	}
	return null;
}

function transform(code: string, file: string): string | null {
	const ast = parseFile(code, file);
	const entry = findImport(ast.program.body);
	if (!entry) return null;

	const local = entry.specifier.local.name;
	const edits: Array<Edit> = [];
	// Set when a reference can't become `Styles` (type namespace, shorthand, re-export), so the import must stay.
	let keepImport = false;

	walk(ast.program, (node, parent, key) => {
		if (node.type !== "Identifier" || parent === null) return;

		if (node.name === GLOBAL && BINDINGS.has(parent.type) && (key === "id" || key === "local")) {
			throw new TaggedError(`already declares "${GLOBAL}"`);
		}

		if (node.name !== local) return;
		if (node === entry.specifier.local || node === entry.specifier.imported) return;

		const isMember =
			parent.type === "MemberExpression" || parent.type === "OptionalMemberExpression";
		if (isMember && key === "property" && !parent.computed) return;

		if (parent.type === "ObjectProperty" && parent.shorthand) {
			keepImport = true;
			return;
		}
		if (key === "key" && !(parent as { computed?: boolean }).computed) return;

		// `StyleSheet.NamedStyles<T>` uses RN's type namespace, which the global const doesn't have.
		if (parent.type === "TSQualifiedName" && key === "left") {
			keepImport = true;
			return;
		}
		if (parent.type === "ExportSpecifier") {
			keepImport = true;
			return;
		}

		edits.push({ ...range(node), text: GLOBAL });
	});

	if (edits.length === 0) return null;
	if (!keepImport)
		edits.push(...removeSpecifiers(code, entry.declaration, new Set([entry.specifier])));

	return applyEdits(code, edits);
}

export const styleSheet: Migration = {
	flag: "--stylesheet",
	description: "replace react-native StyleSheet with the global Styles",
	run(cwd) {
		return migrateFiles(cwd, {
			extensions: EXTENSIONS,
			shouldVisit: (code) => code.includes("StyleSheet"),
			transform,
		});
	},
};
