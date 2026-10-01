import { describe, expect, test, vi } from "vitest";

import { intrinsics, resolve } from "../src/intrinsics";

// react-native ships Flow source that Node can't load, so the module is replaced with named stand-ins.
// vi.hoisted runs before the hoisted vi.mock, which runs before the imports above.
const components = vi.hoisted(() => ({
	View: function View() {},
	Text: function Text() {},
	Image: function Image() {},
	ScrollView: function ScrollView() {},
	TextInput: function TextInput() {},
	Switch: function Switch() {},
	Pressable: function Pressable() {},
	ActivityIndicator: function ActivityIndicator() {},
	Modal: function Modal() {},
	KeyboardAvoidingView: function KeyboardAvoidingView() {},
	RefreshControl: function RefreshControl() {},
}));

vi.mock("react-native", () => components);

const TAGS: Array<[string, keyof typeof components]> = [
	["view", "View"],
	["text", "Text"],
	["image", "Image"],
	["scroll-view", "ScrollView"],
	["text-input", "TextInput"],
	["switch", "Switch"],
	["pressable", "Pressable"],
	["activity-indicator", "ActivityIndicator"],
	["modal", "Modal"],
	["keyboard-avoiding-view", "KeyboardAvoidingView"],
	["refresh-control", "RefreshControl"],
];

describe("resolve", () => {
	test.each(TAGS)("<%s> resolves to %s", (tag, component) => {
		expect(resolve(tag as never)).toBe(components[component]);
	});

	test("every registered intrinsic resolves to a component", () => {
		for (const tag of Object.keys(intrinsics)) {
			const resolved = resolve(tag as never);
			expect(resolved).not.toBe(tag);
			expect(typeof resolved).toBe("function");
		}
	});

	test("every registered intrinsic is covered by the tag table", () => {
		expect(Object.keys(intrinsics).sort()).toEqual(TAGS.map(([tag]) => tag).sort());
	});

	test("component types pass through unchanged", () => {
		function Custom() {
			return null;
		}
		expect(resolve(Custom)).toBe(Custom);
	});

	test("unknown string tags pass through unchanged", () => {
		expect(resolve("div")).toBe("div");
	});

	test("resolution is stable across calls", () => {
		expect(resolve("view")).toBe(resolve("view"));
	});
});
