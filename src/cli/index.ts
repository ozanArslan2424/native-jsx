#!/usr/bin/env node

import { logger } from "../utils";
import { MIGRATIONS } from "./migrations";
import { setup } from "./setup";

const ALL_FLAG = "--migrate";

const args = process.argv.slice(2);
const known = new Set([ALL_FLAG, ...MIGRATIONS.map((migration) => migration.flag)]);
const unknown = args.filter((arg) => !known.has(arg));

if (unknown.length > 0) {
	logger.error(
		`unknown argument: ${unknown.join(", ")}
available: ${ALL_FLAG} (all), ${MIGRATIONS.map((m) => `${m.flag} (${m.description})`).join(", ")}`,
	);
	process.exit(1);
}

const selected = args.includes(ALL_FLAG)
	? MIGRATIONS
	: MIGRATIONS.filter((migration) => args.includes(migration.flag));

let code = setup();

for (const migration of selected) {
	logger.log(`running ${migration.flag}`);
	code = Math.max(code, migration.run(process.cwd()));
}

process.exit(code);
