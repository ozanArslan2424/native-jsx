import * as React from "react";

import { resolve } from "./intrinsics";

// Babel's automatic runtime imports createElement from the bare import source for `<X {...props} key="k" />`.
export const createElement = ((type: React.ElementType, ...rest: unknown[]) =>
	(React.createElement as (...args: unknown[]) => React.ReactElement)(
		resolve(type),
		...rest,
	)) as typeof React.createElement;
