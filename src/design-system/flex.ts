import type { ViewStyle } from "react-native";

// required to be typed by hand to make it lazy
export type FlexClass =
	| "flex-row"
	| "flex-row-reverse"
	| "flex-col"
	| "flex-col-reverse"
	| "flex-wrap"
	| "flex-wrap-reverse"
	| "flex-nowrap"
	| "flex-1"
	| "flex-auto"
	| "flex-initial"
	| "flex-none"
	| "grow"
	| "grow-0"
	| "shrink"
	| "shrink-0"
	| "basis-auto"
	| "basis-full"
	| "justify-start"
	| "justify-end"
	| "justify-center"
	| "justify-between"
	| "justify-around"
	| "justify-evenly"
	| "items-start"
	| "items-end"
	| "items-center"
	| "items-baseline"
	| "items-stretch"
	| "self-auto"
	| "self-start"
	| "self-end"
	| "self-center"
	| "self-stretch"
	| "self-baseline"
	| "content-start"
	| "content-end"
	| "content-center"
	| "content-between"
	| "content-around"
	| "content-evenly"
	| "content-stretch";

function create(name: FlexClass): ViewStyle {
	switch (name) {
		case "flex-row":
			return { flexDirection: "row" };
		case "flex-row-reverse":
			return { flexDirection: "row-reverse" };
		case "flex-col":
			return { flexDirection: "column" };
		case "flex-col-reverse":
			return { flexDirection: "column-reverse" };

		case "flex-wrap":
			return { flexWrap: "wrap" };
		case "flex-wrap-reverse":
			return { flexWrap: "wrap-reverse" };
		case "flex-nowrap":
			return { flexWrap: "nowrap" };

		case "flex-1":
			return { flexGrow: 1, flexShrink: 1, flexBasis: "0%" };
		case "flex-auto":
			return { flexGrow: 1, flexShrink: 1, flexBasis: "auto" };
		case "flex-initial":
			return { flexGrow: 0, flexShrink: 1, flexBasis: "auto" };
		case "flex-none":
			return { flexGrow: 0, flexShrink: 0, flexBasis: "auto" };

		case "grow":
			return { flexGrow: 1 };
		case "grow-0":
			return { flexGrow: 0 };
		case "shrink":
			return { flexShrink: 1 };
		case "shrink-0":
			return { flexShrink: 0 };

		case "basis-auto":
			return { flexBasis: "auto" };
		case "basis-full":
			return { flexBasis: "100%" };

		case "justify-start":
			return { justifyContent: "flex-start" };
		case "justify-end":
			return { justifyContent: "flex-end" };
		case "justify-center":
			return { justifyContent: "center" };
		case "justify-between":
			return { justifyContent: "space-between" };
		case "justify-around":
			return { justifyContent: "space-around" };
		case "justify-evenly":
			return { justifyContent: "space-evenly" };

		case "items-start":
			return { alignItems: "flex-start" };
		case "items-end":
			return { alignItems: "flex-end" };
		case "items-center":
			return { alignItems: "center" };
		case "items-baseline":
			return { alignItems: "baseline" };
		case "items-stretch":
			return { alignItems: "stretch" };

		case "self-auto":
			return { alignSelf: "auto" };
		case "self-start":
			return { alignSelf: "flex-start" };
		case "self-end":
			return { alignSelf: "flex-end" };
		case "self-center":
			return { alignSelf: "center" };
		case "self-stretch":
			return { alignSelf: "stretch" };
		case "self-baseline":
			return { alignSelf: "baseline" };

		case "content-start":
			return { alignContent: "flex-start" };
		case "content-end":
			return { alignContent: "flex-end" };
		case "content-center":
			return { alignContent: "center" };
		case "content-between":
			return { alignContent: "space-between" };
		case "content-around":
			return { alignContent: "space-around" };
		case "content-evenly":
			return { alignContent: "space-evenly" };
		case "content-stretch":
			return { alignContent: "stretch" };
	}
}

const cache = new Map<FlexClass, ViewStyle>();

function get(name: FlexClass): ViewStyle {
	let style = cache.get(name);
	if (!style) {
		style = create(name);
		cache.set(name, style);
	}
	return style;
}

type Before<
	C extends readonly unknown[],
	N extends number,
	Acc extends unknown[] = [],
> = Acc["length"] extends N
	? Acc
	: C extends readonly [infer H, ...infer R]
		? Before<R, N, [...Acc, H]>
		: Acc;

type Unique<C extends readonly unknown[]> = {
	[K in keyof C]: K extends `${infer N extends number}`
		? C[K] extends Before<C, N>[number]
			? never
			: C[K]
		: C[K];
};

/**
 * Tailwind flex utilities as a React Native style. Direction defaults to column, as in React Native.
 *
 * @example
 * row: { ...s.flex("flex-row", "items-center", "justify-between"), gap: s.spacing[2] }
 */
export function flex<const C extends readonly FlexClass[]>(...names: Unique<C>): ViewStyle {
	const style: ViewStyle = {};
	for (const name of names) Object.assign(style, get(name as FlexClass));
	return style;
}
