import * as NativewindRuntime from "nativewind/jsx-runtime";
import type * as ReactRuntime from "react/jsx-runtime";

import { Fragment, type JSX } from "../default/jsx-runtime";
import { resolve } from "../intrinsics";

// nativewind's jsx-runtime ships only `export type * from "react/jsx-runtime"` as types
const Runtime = NativewindRuntime as unknown as typeof ReactRuntime;

function jsx(...args: Parameters<typeof Runtime.jsx>) {
	const [type, ...rest] = args;
	return Runtime.jsx(resolve(type), ...rest);
}

function jsxs(...args: Parameters<typeof Runtime.jsxs>) {
	const [type, ...rest] = args;
	return Runtime.jsxs(resolve(type), ...rest);
}

export { Fragment, jsx, jsxs, type JSX };
