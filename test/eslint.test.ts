import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { eslint } from "../src/cli/migrations/eslint";
import { PKG_NAME, LOCAL_NAME } from "../src/utils";

const SOURCE = `${PKG_NAME}/eslint`;
const dirs: Array<string> = [];

function setup(files: Record<string, string>): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "native-jsx-eslint-"));
	dirs.push(dir);
	for (const [name, content] of Object.entries(files)) {
		fs.writeFileSync(path.join(dir, name), content);
	}
	return dir;
}

function read(dir: string, name: string): string {
	return fs.readFileSync(path.join(dir, name), "utf8");
}

afterEach(() => {
	for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("eslint migration", () => {
	test("appends to an inline array export", () => {
		const dir = setup({
			"eslint.config.js": `import js from "@eslint/js";\n\nexport default [js.configs.recommended];\n`,
		});

		expect(eslint.run(dir)).toBe(0);
		expect(read(dir, "eslint.config.js")).toBe(
			`import js from "@eslint/js";\nimport ${LOCAL_NAME} from "${SOURCE}";\n\nexport default [js.configs.recommended, ${LOCAL_NAME}];\n`,
		);
	});

	test("keeps multiline arrays multiline", () => {
		const dir = setup({
			"eslint.config.js": `import js from "@eslint/js";\n\nexport default [\n\tjs.configs.recommended,\n];\n`,
		});

		expect(eslint.run(dir)).toBe(0);
		expect(read(dir, "eslint.config.js")).toContain(
			`\tjs.configs.recommended,\n\t${LOCAL_NAME},\n];`,
		);
	});

	test("appends inside defineConfig([...])", () => {
		const dir = setup({
			"eslint.config.mjs": `import { defineConfig } from "eslint/config";\n\nexport default defineConfig([a]);\n`,
		});

		expect(eslint.run(dir)).toBe(0);
		expect(read(dir, "eslint.config.mjs")).toContain(`defineConfig([a, ${LOCAL_NAME}])`);
	});

	test("appends as an argument to tseslint.config(a, b)", () => {
		const dir = setup({
			"eslint.config.ts": `import tseslint from "typescript-eslint";\n\nexport default tseslint.config(a, b);\n`,
		});

		expect(eslint.run(dir)).toBe(0);
		expect(read(dir, "eslint.config.ts")).toContain(`tseslint.config(a, b, ${LOCAL_NAME})`);
	});

	test("follows an identifier to its array", () => {
		const dir = setup({
			"eslint.config.js": `import js from "@eslint/js";\n\nconst config = [js];\n\nexport default config;\n`,
		});

		expect(eslint.run(dir)).toBe(0);
		expect(read(dir, "eslint.config.js")).toContain(`const config = [js, ${LOCAL_NAME}];`);
	});

	test("sees through `as` and `satisfies`", () => {
		const dir = setup({
			"eslint.config.ts": `import js from "@eslint/js";\n\nexport default [js] satisfies Array<unknown>;\n`,
		});

		expect(eslint.run(dir)).toBe(0);
		expect(read(dir, "eslint.config.ts")).toContain(`[js, ${LOCAL_NAME}] satisfies`);
	});

	test("fills an empty array", () => {
		const dir = setup({
			"eslint.config.js": `import js from "@eslint/js";\n\nexport default [];\n`,
		});

		expect(eslint.run(dir)).toBe(0);
		expect(read(dir, "eslint.config.js")).toContain(`export default [${LOCAL_NAME}];`);
	});

	test("adds the import above the first statement when there are no imports", () => {
		const dir = setup({ "eslint.config.js": `export default [];\n` });

		expect(eslint.run(dir)).toBe(0);
		expect(read(dir, "eslint.config.js")).toBe(
			`import ${LOCAL_NAME} from "${SOURCE}";\n\nexport default [${LOCAL_NAME}];\n`,
		);
	});

	test("uses require for CommonJS configs", () => {
		const dir = setup({
			"eslint.config.cjs": `const js = require("@eslint/js");\n\nmodule.exports = [js];\n`,
		});

		expect(eslint.run(dir)).toBe(0);
		expect(read(dir, "eslint.config.cjs")).toBe(
			`const js = require("@eslint/js");\nconst ${LOCAL_NAME} = require("${SOURCE}");\n\nmodule.exports = [js, ${LOCAL_NAME}];\n`,
		);
	});

	test("matches the existing quote style and semicolons", () => {
		const dir = setup({
			"eslint.config.js": `import js from '@eslint/js'\n\nexport default [js]\n`,
		});

		expect(eslint.run(dir)).toBe(0);
		expect(read(dir, "eslint.config.js")).toContain(`import ${LOCAL_NAME} from '${SOURCE}'\n`);
	});

	test("is idempotent", () => {
		const dir = setup({
			"eslint.config.js": `import js from "@eslint/js";\n\nexport default [js];\n`,
		});

		expect(eslint.run(dir)).toBe(0);
		const once = read(dir, "eslint.config.js");
		expect(eslint.run(dir)).toBe(0);
		expect(read(dir, "eslint.config.js")).toBe(once);
	});

	test("fails without writing on an unsupported export", () => {
		const original = `export default { rules: {} };\n`;
		const dir = setup({ "eslint.config.js": original });

		expect(eslint.run(dir)).toBe(1);
		expect(read(dir, "eslint.config.js")).toBe(original);
	});

	test("fails without writing on an unresolvable identifier", () => {
		const original = `import config from "./shared";\n\nexport default config;\n`;
		const dir = setup({ "eslint.config.js": original });

		expect(eslint.run(dir)).toBe(1);
		expect(read(dir, "eslint.config.js")).toBe(original);
	});

	test("fails on a legacy eslintrc without touching it", () => {
		const original = `{ "rules": {} }\n`;
		const dir = setup({ ".eslintrc.json": original });

		expect(eslint.run(dir)).toBe(1);
		expect(read(dir, ".eslintrc.json")).toBe(original);
	});

	test("skips when there is no config", () => {
		const dir = setup({});
		expect(eslint.run(dir)).toBe(0);
	});
});
