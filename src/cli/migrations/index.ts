import { eslint } from "./eslint";
import { jsx } from "./jsx";
import { oxlint } from "./oxlint";
import { styleSheet } from "./stylesheet";
import type { Migration } from "./types";

// Order matters: migrations run in this order when several flags are passed.
export const MIGRATIONS: Array<Migration> = [jsx, styleSheet, eslint, oxlint];
