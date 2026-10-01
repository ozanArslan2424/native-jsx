import type { Node, Program, Statement } from "@babel/types";

import { LOCAL_NAME, TaggedError } from "../utils";
import type { Edit } from "./applyEdits";

export type Target = { items: Array<Node>; open: number };

export function start(node: Node): number {
	if (node.start == null) throw new TaggedError(`missing source range on ${node.type}`);
	return node.start;
}

export function end(node: Node): number {
	if (node.end == null) throw new TaggedError(`missing source range on ${node.type}`);
	return node.end;
}

export function unwrap(node: Node): Node {
	let current = node;
	while (current.type === "TSAsExpression" || current.type === "TSSatisfiesExpression") {
		current = current.expression;
	}
	return current;
}

function isModuleExports(node: Node): boolean {
	return (
		node.type === "MemberExpression" &&
		node.object.type === "Identifier" &&
		node.object.name === "module" &&
		node.property.type === "Identifier" &&
		node.property.name === "exports"
	);
}

export function findExport(program: Program): { node: Node; cjs: boolean } | null {
	for (const statement of program.body) {
		if (statement.type === "ExportDefaultDeclaration") {
			return { node: statement.declaration, cjs: false };
		}
		if (
			statement.type === "ExpressionStatement" &&
			statement.expression.type === "AssignmentExpression" &&
			isModuleExports(statement.expression.left)
		) {
			return { node: statement.expression.right, cjs: true };
		}
	}
	return null;
}

export function resolve(program: Program, name: string): Node | null {
	for (const statement of program.body) {
		if (statement.type !== "VariableDeclaration") continue;
		for (const declarator of statement.declarations) {
			if (declarator.id.type === "Identifier" && declarator.id.name === name && declarator.init) {
				return declarator.init;
			}
		}
	}
	return null;
}

export function arrayTarget(node: Node): Target | null {
	const current = unwrap(node);
	if (current.type !== "ArrayExpression") return null;
	return {
		items: current.elements.filter(
			(element): element is NonNullable<typeof element> => element !== null,
		),
		open: start(current) + 1,
	};
}

export function appendEdit(code: string, target: Target): Edit {
	const last = target.items[target.items.length - 1];
	if (!last) return { start: target.open, end: target.open, text: LOCAL_NAME };

	const lineStart = code.lastIndexOf("\n", start(last) - 1) + 1;
	const prefix = code.slice(lineStart, start(last));
	const multiline = /^\s*$/.test(prefix);

	return {
		start: end(last),
		end: end(last),
		text: multiline ? `,\n${prefix}${LOCAL_NAME}` : `, ${LOCAL_NAME}`,
	};
}

function sourceOf(statement: Statement): Node | null {
	if (statement.type === "ImportDeclaration") return statement.source;
	if (statement.type === "VariableDeclaration") {
		for (const declarator of statement.declarations) {
			const init = declarator.init;
			if (
				init?.type === "CallExpression" &&
				init.callee.type === "Identifier" &&
				init.callee.name === "require" &&
				init.arguments[0]?.type === "StringLiteral"
			) {
				return init.arguments[0];
			}
		}
	}
	return null;
}

export function importEdit(
	code: string,
	program: Program,
	cjs: boolean,
	configSource: string,
): Edit {
	let last: Statement | null = null;
	for (const statement of program.body) {
		if (sourceOf(statement)) last = statement;
	}

	const source = last ? sourceOf(last) : null;
	const quote = source ? code[start(source)] : '"';
	const semicolon = last && code[end(last) - 1] !== ";" ? "" : ";";
	const specifier = `${quote}${configSource}${quote}`;
	const statement = cjs
		? `const ${LOCAL_NAME} = require(${specifier})${semicolon}`
		: `import ${LOCAL_NAME} from ${specifier}${semicolon}`;

	if (last) return { start: end(last), end: end(last), text: `\n${statement}` };

	// Leading comments aren't part of the first statement's range, so they stay above the import.
	const first = program.body[0];
	const at = first ? start(first) : 0;
	return { start: at, end: at, text: `${statement}\n\n` };
}
