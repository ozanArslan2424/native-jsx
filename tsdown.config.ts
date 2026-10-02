import { glob, readFile, writeFile } from "node:fs/promises";

import { defineConfig, type UserConfig } from "tsdown";

import pkg from "./package.json" with { type: "json" };

const PKG_NAME = pkg.name;
const EXE_NAME = pkg.name.replace("@ozanarslan/", "");

async function replacePackageName() {
	for await (const file of glob("dist/**/*.d.{ts,mts,cts}")) {
		const content = await readFile(file, "utf8");
		if (content.includes("__PKG_NAME__")) {
			await writeFile(file, content.replaceAll("__PKG_NAME__", PKG_NAME));
		}
	}
}

// Every config that writes to this package.json must share identical exports options.
const exports: UserConfig["exports"] = {
	bin: { [EXE_NAME]: "src/cli/index.ts" },
	exclude: ["cli/index"],
	customExports: {
		"./babel": "./dist/babel/babel.cjs",
		"./eslint": { types: "./dist/eslint/index.d.cts", default: "./dist/eslint/index.cjs" },
		"./oxlint": { types: "./dist/oxlint/index.d.cts", default: "./dist/oxlint/index.cjs" },
	},
};

export default defineConfig([
	{
		entry: {
			index: "src/default/index.ts",
			"jsx-runtime": "src/default/jsx-runtime.ts",
			"jsx-dev-runtime": "src/default/jsx-dev-runtime.ts",
			"nativewind/index": "src/nativewind/index.ts",
			"nativewind/jsx-runtime": "src/nativewind/jsx-runtime.ts",
			"nativewind/jsx-dev-runtime": "src/nativewind/jsx-dev-runtime.ts",
			system: "src/design-system/system.ts",
		},
		platform: "neutral",
		format: ["esm"],
		minify: true,
		dts: true,
		clean: true,
		// Copied to the top of dist so the configs' relative requires (../../package.json, ../rules) still resolve.
		copy: [
			"config/babel",
			"config/eslint",
			"config/oxlint",
			"config/rules.cjs",
			"config/rules.d.cts",
		],
		exports,
		hooks: {
			"build:done": replacePackageName,
		},
	},
	{
		entry: { "cli/index": "src/cli/index.ts" },
		platform: "node",
		format: ["esm"],
		minify: true,
		dts: false,
		clean: true,
		exports,
	},
]);
