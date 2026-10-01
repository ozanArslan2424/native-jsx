import { name } from "../package.json";

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

function toCamelCase(key: string): string {
	const parts = key
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/[^a-zA-Z0-9]+/g, " ")
		.split(" ")
		.filter(Boolean);
	if (parts.length === 0) return key;
	const [first, ...rest] = parts;
	return first!.toLowerCase() + rest.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
}

export const PKG_NAME = name;
export const EXE_NAME = name.replace("@ozanarslan/", "");
export const LOCAL_NAME = toCamelCase(EXE_NAME);

const tag = `[${EXE_NAME}]: `;

export const logger = {
	log(...args: any[]): void {
		console.log(tag, ...args);
	},
	error(...args: any[]): void {
		console.error(tag, ...args);
	},
	warn(...args: any[]): void {
		console.warn(tag, ...args);
	},
	info(...args: any[]): void {
		console.info(tag, ...args);
	},
};

export class TaggedError extends Error {
	constructor(...params: ConstructorParameters<typeof Error>) {
		const [msg, ...rest] = params;
		const message = `${tag}${msg ?? "Unknown Error"}`;
		super(message, ...rest);
	}
}
