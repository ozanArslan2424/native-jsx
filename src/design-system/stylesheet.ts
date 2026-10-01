import { Appearance, StyleSheet as RNStyleSheet, useColorScheme } from "react-native";
import type { ColorSchemeName, ImageStyle, TextStyle, ViewStyle } from "react-native";

import { flex } from "./flex";
import type { ModeName } from "./mode";
import { getDesignSystem, type SystemTokens } from "./system";

const helpers = {
	flex,
} as const;

type DesignSystem = SystemTokens & typeof helpers;

const MODES = ["light", "dark"] as const satisfies readonly ModeName[];

let systems: Record<ModeName, DesignSystem> | undefined;

// Set while a factory runs, so nested styles resolve against the mode being built.
let buildingMode: ModeName | undefined;

function getSystems(): Record<ModeName, DesignSystem> {
	if (!systems) {
		const system = getDesignSystem() as unknown as Record<ModeName, SystemTokens>;
		systems = {
			light: { ...system.light, ...helpers },
			dark: { ...system.dark, ...helpers },
		};
	}
	return systems;
}

function toMode(scheme: ColorSchemeName | null): ModeName {
	return scheme === "dark" ? "dark" : "light";
}

function currentMode(): ModeName {
	return buildingMode ?? toMode(Appearance.getColorScheme());
}

function buildForModes<T>(factory: (s: DesignSystem) => T): Record<ModeName, T> {
	const s = getSystems();
	const result = {} as Record<ModeName, T>;
	for (const mode of MODES) {
		const previous = buildingMode;
		buildingMode = mode;
		try {
			result[mode] = factory(s[mode]);
		} finally {
			buildingMode = previous;
		}
	}
	return result;
}

/**
 * React hook that returns the design system tokens for the current color scheme,
 * for values that don't need a style entry (e.g. `tintColor={s.color.primary}`).
 * Re-renders the component when the scheme changes.
 */
export function useDesignSystem(): DesignSystem {
	return getSystems()[toMode(useColorScheme())];
}

type AnyStyle = ViewStyle | TextStyle | ImageStyle;

export type ThemedStyles<T> = T & {
	/**
	 * React hook that returns the styles for the current color scheme and
	 * re-renders the component when the scheme changes (e.g. system dark mode toggle).
	 *
	 * Accessing styles directly (`styles.card`) also resolves against the current
	 * scheme, but only at the moment of access — nothing re-renders when the scheme
	 * changes. Use this hook in any component that must update live.
	 *
	 * Follows the rules of hooks: call it at the top level of a component.
	 *
	 * @example
	 * const styles = Styles.defineSheet((s) => ({
	 *   card: { backgroundColor: s.color.card },
	 * }));
	 *
	 * function Card(props: Props) {
	 *   const themed = styles.useWithColorScheme();
	 *   return <view style={themed.card}>{props.children}</view>;
	 * }
	 */
	useWithColorScheme(): T;
};

export function defineStyle<T extends AnyStyle>(
	factory: (s: DesignSystem) => T & AnyStyle,
): ThemedStyles<T>;
export function defineStyle<T extends AnyStyle>(style: T & AnyStyle): ThemedStyles<T>;
export function defineStyle(
	input: AnyStyle | ((s: DesignSystem) => AnyStyle),
): ThemedStyles<AnyStyle> {
	const factory = typeof input === "function" ? input : () => input;
	let styles: Record<ModeName, AnyStyle> | undefined;

	function getStyles(): Record<ModeName, AnyStyle> {
		styles ??= buildForModes(factory);
		return styles;
	}

	function useWithColorScheme(): AnyStyle {
		return getStyles()[toMode(useColorScheme())];
	}

	function current(): AnyStyle {
		return getStyles()[currentMode()];
	}

	// Proxy traps make both property access and object spread resolve against the current mode.
	return new Proxy({ useWithColorScheme } as ThemedStyles<AnyStyle>, {
		get(_target, key) {
			if (key === "useWithColorScheme") return useWithColorScheme;
			return Reflect.get(current(), key);
		},
		has(_target, key) {
			return key === "useWithColorScheme" || Reflect.has(current(), key);
		},
		ownKeys() {
			return Reflect.ownKeys(current());
		},
		getOwnPropertyDescriptor(_target, key) {
			const descriptor = Reflect.getOwnPropertyDescriptor(current(), key);
			return descriptor && { ...descriptor, configurable: true };
		},
	});
}

type NamedStyles<T> = { [K in keyof T]: AnyStyle };

export function defineSheet<T extends NamedStyles<T> | NamedStyles<any>>(
	factory: (s: DesignSystem) => T & NamedStyles<any>,
): ThemedStyles<T> {
	let sheets: Record<ModeName, T> | undefined;

	function getSheets(): Record<ModeName, T> {
		if (!sheets) {
			const built = buildForModes(factory);
			sheets = {
				light: RNStyleSheet.create(built.light),
				dark: RNStyleSheet.create(built.dark),
			};
		}
		return sheets;
	}

	function useWithColorScheme(): T {
		return getSheets()[toMode(useColorScheme())];
	}

	// Proxy is used instead of getters because the style keys don't exist until
	// the factory runs, and the factory can't run until the system is defined.
	return new Proxy({ useWithColorScheme } as ThemedStyles<T>, {
		get(_target, key) {
			if (key === "useWithColorScheme") return useWithColorScheme;
			return getSheets()[currentMode()][key as keyof T];
		},
	});
}

type ExtendedStyleSheet = typeof RNStyleSheet & {
	defineSheet: typeof defineSheet;
	defineStyle: typeof defineStyle;
	useDesignSystem: typeof useDesignSystem;
};

export const Styles: ExtendedStyleSheet = Object.assign(Object.create(RNStyleSheet), {
	defineSheet,
	defineStyle,
	useDesignSystem,
});

declare global {
	const Styles: ExtendedStyleSheet;
}
