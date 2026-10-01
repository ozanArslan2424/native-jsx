import type * as React from "react";
import * as Runtime from "react/jsx-runtime";

import { resolve, type IntrinsicProps } from "../intrinsics";

const Fragment = Runtime.Fragment;

function jsx(...args: Parameters<typeof Runtime.jsx>) {
	const [type, ...rest] = args;
	return Runtime.jsx(resolve(type), ...rest);
}

function jsxs(...args: Parameters<typeof Runtime.jsxs>) {
	const [type, ...rest] = args;
	return Runtime.jsxs(resolve(type), ...rest);
}

declare namespace JSX {
	type ElementType = React.JSX.ElementType;
	interface Element extends React.JSX.Element {}
	interface ElementClass extends React.JSX.ElementClass {}
	interface ElementAttributesProperty extends React.JSX.ElementAttributesProperty {}
	interface ElementChildrenAttribute extends React.JSX.ElementChildrenAttribute {}
	type LibraryManagedAttributes<C, P> = React.JSX.LibraryManagedAttributes<C, P>;
	interface IntrinsicAttributes extends React.JSX.IntrinsicAttributes {}
	interface IntrinsicClassAttributes<T> extends React.JSX.IntrinsicClassAttributes<T> {}
	interface IntrinsicElements extends IntrinsicProps {}
}

export { Fragment, jsx, jsxs, type JSX };
