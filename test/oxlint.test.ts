import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { oxlint } from "../src/cli/migrations/oxlint";
import { LOCAL_NAME, PKG_NAME } from "../src/utils";

// Loaded with Node's own require so the CommonJS file isn't run through Vite's ESM transform.
const RULES: Record<string, string> = createRequire(import.meta.url)("../config/rules.cjs");
const SOURCE = `${PKG_NAME}/oxlint`;
const dirs: Array<string> = [];

function setup(files: Record<string, string>): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "native-jsx-oxlint-"));
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

describe("oxlint migration: TS config", () => {
	test("appends to an existing extends array", () => {
		const dir = setup({
			"oxlint.config.ts": [
				`import { defineConfig } from "oxlint";`,
				`import native from "oxlint-config-universe/native";`,
				``,
				`export default defineConfig({`,
				`\textends: [native],`,
				`});`,
				``,
			].join("\n"),
		});

		expect(oxlint.run(dir)).toBe(0);
		expect(read(dir, "oxlint.config.ts")).toBe(
			[
				`import { defineConfig } from "oxlint";`,
				`import native from "oxlint-config-universe/native";`,
				`import ${LOCAL_NAME} from "${SOURCE}";`,
				``,
				`export default defineConfig({`,
				`\textends: [native, ${LOCAL_NAME}],`,
				`});`,
				``,
			].join("\n"),
		);
	});

	test("adds extends as the first property of a multiline object", () => {
		const dir = setup({
			"oxlint.config.ts": `import { defineConfig } from "oxlint";\n\nexport default defineConfig({\n\trules: {},\n});\n`,
		});

		expect(oxlint.run(dir)).toBe(0);
		expect(read(dir, "oxlint.config.ts")).toContain(
			`defineConfig({\n\textends: [${LOCAL_NAME}],\n\trules: {},\n});`,
		);
	});

	test("adds extends inline in a one-line object", () => {
		const dir = setup({
			"oxlint.config.ts": `import { defineConfig } from "oxlint";\n\nexport default { rules: {} };\n`,
		});

		expect(oxlint.run(dir)).toBe(0);
		expect(read(dir, "oxlint.config.ts")).toContain(`{ extends: [${LOCAL_NAME}], rules: {} }`);
	});

	test("fills an empty object", () => {
		const dir = setup({
			"oxlint.config.ts": `import { defineConfig } from "oxlint";\n\nexport default defineConfig({});\n`,
		});

		expect(oxlint.run(dir)).toBe(0);
		expect(read(dir, "oxlint.config.ts")).toContain(`defineConfig({ extends: [${LOCAL_NAME}] })`);
	});

	test("accepts a quoted extends key", () => {
		const dir = setup({
			"oxlint.config.ts": `import native from "oxlint-config-universe/native";\n\nexport default { "extends": [native] };\n`,
		});

		expect(oxlint.run(dir)).toBe(0);
		expect(read(dir, "oxlint.config.ts")).toContain(`"extends": [native, ${LOCAL_NAME}]`);
	});

	test("follows an identifier to its object", () => {
		const dir = setup({
			"oxlint.config.mts": `import { defineConfig } from "oxlint";\n\nconst config = defineConfig({ extends: [] });\n\nexport default config;\n`,
		});

		expect(oxlint.run(dir)).toBe(0);
		expect(read(dir, "oxlint.config.mts")).toContain(`defineConfig({ extends: [${LOCAL_NAME}] })`);
	});

	test("uses require for CommonJS configs", () => {
		const dir = setup({
			"oxlint.config.cjs": `const native = require("oxlint-config-universe/native");\n\nmodule.exports = { extends: [native] };\n`,
		});

		expect(oxlint.run(dir)).toBe(0);
		const output = read(dir, "oxlint.config.cjs");
		expect(output).toContain(`const ${LOCAL_NAME} = require("${SOURCE}");`);
		expect(output).toContain(`extends: [native, ${LOCAL_NAME}]`);
	});

	test("is idempotent", () => {
		const dir = setup({
			"oxlint.config.ts": `import { defineConfig } from "oxlint";\n\nexport default defineConfig({ extends: [] });\n`,
		});

		expect(oxlint.run(dir)).toBe(0);
		const once = read(dir, "oxlint.config.ts");
		expect(oxlint.run(dir)).toBe(0);
		expect(read(dir, "oxlint.config.ts")).toBe(once);
	});

	test("fails without writing when extends is not an array literal", () => {
		const original = `import shared from "./shared";\n\nexport default { extends: shared };\n`;
		const dir = setup({ "oxlint.config.ts": original });

		expect(oxlint.run(dir)).toBe(1);
		expect(read(dir, "oxlint.config.ts")).toBe(original);
	});

	test("prefers the TS config over .oxlintrc.json", () => {
		const json = `{\n\t"rules": {}\n}\n`;
		const dir = setup({
			"oxlint.config.ts": `export default { extends: [] };\n`,
			".oxlintrc.json": json,
		});

		expect(oxlint.run(dir)).toBe(0);
		expect(read(dir, "oxlint.config.ts")).toContain(LOCAL_NAME);
		expect(read(dir, ".oxlintrc.json")).toBe(json);
	});
});

describe("oxlint migration: .oxlintrc.json", () => {
	test("adds every shared rule and keeps other keys", () => {
		const dir = setup({
			".oxlintrc.json": `{\n\t"plugins": ["react"],\n\t"rules": {\n\t\t"eqeqeq": "error"\n\t}\n}\n`,
		});

		expect(oxlint.run(dir)).toBe(0);
		const config = JSON.parse(read(dir, ".oxlintrc.json"));
		expect(config.plugins).toEqual(["react"]);
		expect(config.rules).toEqual({ eqeqeq: "error", ...RULES });
	});

	test("creates rules when missing", () => {
		const dir = setup({ ".oxlintrc.json": `{}\n` });

		expect(oxlint.run(dir)).toBe(0);
		expect(JSON.parse(read(dir, ".oxlintrc.json")).rules).toEqual({ ...RULES });
	});

	test("keeps a rule the user already configured", () => {
		const [rule] = Object.keys(RULES);
		if (!rule) throw new Error("config/rules.cjs has no rules");

		const dir = setup({ ".oxlintrc.json": JSON.stringify({ rules: { [rule]: "warn" } }) });

		expect(oxlint.run(dir)).toBe(0);
		expect(JSON.parse(read(dir, ".oxlintrc.json")).rules[rule]).toBe("warn");
	});

	test("preserves the file's indentation", () => {
		const dir = setup({ ".oxlintrc.json": `{\n  "rules": {}\n}\n` });

		expect(oxlint.run(dir)).toBe(0);
		expect(read(dir, ".oxlintrc.json")).toMatch(/^\{\n {2}"rules"/);
	});

	test("is idempotent", () => {
		const dir = setup({ ".oxlintrc.json": `{\n\t"rules": {}\n}\n` });

		expect(oxlint.run(dir)).toBe(0);
		const once = read(dir, ".oxlintrc.json");
		expect(oxlint.run(dir)).toBe(0);
		expect(read(dir, ".oxlintrc.json")).toBe(once);
	});

	test("fails without writing on JSON with comments", () => {
		const original = `{\n\t// comment\n\t"rules": {}\n}\n`;
		const dir = setup({ ".oxlintrc.json": original });

		expect(oxlint.run(dir)).toBe(1);
		expect(read(dir, ".oxlintrc.json")).toBe(original);
	});
});

test("skips when there is no config", () => {
	const dir = setup({});
	expect(oxlint.run(dir)).toBe(0);
});
