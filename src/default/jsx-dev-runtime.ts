import * as DevRuntime from "react/jsx-dev-runtime";

import { resolve } from "../intrinsics";
import { Fragment, type JSX } from "./jsx-runtime";

function jsxDEV(...args: Parameters<typeof DevRuntime.jsxDEV>) {
	const [type, ...rest] = args;
	return DevRuntime.jsxDEV(resolve(type), ...rest);
}

export { Fragment, type JSX, jsxDEV };
