import * as NativewindDevRuntime from "nativewind/jsx-dev-runtime";
import type * as ReactDevRuntime from "react/jsx-dev-runtime";

import { Fragment, type JSX } from "../default/jsx-runtime";
import { resolve } from "../intrinsics";

// nativewind's jsx-dev-runtime ships only `export type * from "react/jsx-dev-runtime"` as types
const DevRuntime = NativewindDevRuntime as unknown as typeof ReactDevRuntime;

function jsxDEV(...args: Parameters<typeof DevRuntime.jsxDEV>) {
	const [type, ...rest] = args;
	return DevRuntime.jsxDEV(resolve(type), ...rest);
}

export { Fragment, type JSX, jsxDEV };
