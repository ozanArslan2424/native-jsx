import type { ImportDeclaration, ImportSpecifier } from "@babel/types";

import { applyEdits, type Edit } from "../applyEdits";
import { migrateFiles, parseFile, range, removeSpecifiers, walk, type Specifier } from "../ast";
import type { Migration } from "./types";

// keep in sync with src/intrinsics.ts
const COMPONENTS = [
	"View",
	"Text",
	"Image",
	"ScrollView",
	"TextInput",
	"Switch",
	"Pressable",
	"ActivityIndicator",
	"Modal",
	"KeyboardAvoidingView",
	"RefreshControl",
];

const TAGS = new Map(
	COMPONENTS.map((name) => [name, name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()]),
);
const EXTENSIONS = new Set([".tsx", ".jsx", ".js"]);

type Entry = { tag: string; specifier: ImportSpecifier; declaration: ImportDeclaration };

function transform(code: string, file: string): string | null {
	const ast = parseFile(code, file);

	const imported = new Map<string, Entry>();
	for (const statement of ast.program.body) {
		if (statement.type !== "ImportDeclaration") continue;
		if (statement.source.value !== "react-native" || statement.importKind === "type") continue;

		for (const specifier of statement.specifiers) {
			if (specifier.type !== "ImportSpecifier" || specifier.importKind === "type") continue;
			const name =
				specifier.imported.type === "Identifier"
					? specifier.imported.name
					: specifier.imported.value;
			const tag = TAGS.get(name);
			if (tag) imported.set(specifier.local.name, { tag, specifier, declaration: statement });
		}
	}

	if (imported.size === 0) return null;

	const edits: Array<Edit> = [];
	const renamed = new Set<string>();
	const used = new Set<string>();

	walk(ast.program, (node, parent, key) => {
		if (node.type === "JSXIdentifier") {
			const entry = imported.get(node.name);
			if (!entry) return;

			const isTagName =
				key === "name" &&
				parent !== null &&
				(parent.type === "JSXOpeningElement" || parent.type === "JSXClosingElement");

			if (isTagName) {
				edits.push({ ...range(node), text: entry.tag });
				renamed.add(node.name);
			} else {
				used.add(node.name);
			}
		} else if (node.type === "Identifier") {
			const entry = imported.get(node.name);
			if (!entry) return;
			if (node !== entry.specifier.local && node !== entry.specifier.imported) {
				used.add(node.name);
			}
		}
	});

	if (renamed.size === 0) return null;

	const removedByDeclaration = new Map<ImportDeclaration, Set<Specifier>>();
	for (const [local, entry] of imported) {
		if (!renamed.has(local) || used.has(local)) continue;

		let removed = removedByDeclaration.get(entry.declaration);
		if (!removed) {
			removed = new Set();
			removedByDeclaration.set(entry.declaration, removed);
		}
		removed.add(entry.specifier);
	}

	for (const [declaration, removed] of removedByDeclaration) {
		edits.push(...removeSpecifiers(code, declaration, removed));
	}

	return applyEdits(code, edits);
}

export const jsx: Migration = {
	flag: "--jsx",
	description: "replace react-native component imports with intrinsic tags",
	run(cwd) {
		return migrateFiles(cwd, {
			extensions: EXTENSIONS,
			shouldVisit: (code) => code.includes("react-native"),
			transform,
		});
	},
};
