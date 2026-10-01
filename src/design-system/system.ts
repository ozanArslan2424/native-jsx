import {
	Appearance,
	StyleSheet as RNStyleSheet,
	useColorScheme,
	type ColorSchemeName,
	type ImageStyle,
	type TextStyle,
	type ViewStyle,
} from "react-native";

import { TaggedError } from "../utils";
import { resolveMode, type ModeConfig, type ModeTokens, type ModeName } from "./mode";
import { defaultPalette, type DefaultPalette, type Palette, type SemanticColors } from "./palette";
import { resolveTheme, type BaseTokens, type ThemeConfig } from "./theme";

/* ---------- config (user input) ---------- */

export interface DesignSystemConfig<P extends Palette = Palette> {
	/** Raw scales, exposed as `s.color.blue[500]`. Merged over Tailwind defaults. */
	palette?: P;
	/** Overrides over Tailwind defaults. `spacing` is the base unit. */
	theme?: ThemeConfig;
	modes: {
		light: ModeConfig;
		dark?: ModeConfig;
	};
}

export type DesignSystemBase<P extends Palette = Palette> = BaseTokens & {
	color: SemanticColors & P;
	shadow: ModeTokens["shadow"];
	mode: ModeName;
};

/* ---------- registration ---------- */

/**
 * Augment with your own design system
 *
 * @example
 * declare module "__PKG_NAME__" {
 *   interface Register {
 *     designSystem: typeof designSystem
 *   }
 * }
 */
export interface Register {}

export type RegisteredSystem = Register extends { designSystem: infer S } ? S : DesignSystemBase;

export type SystemTokens =
	RegisteredSystem extends Record<ModeName, infer S> ? S : RegisteredSystem;

/* ---------- resolved (what the callback receives) ---------- */

export type ResolvedDesignSystem<P extends Palette> = Record<
	ModeName,
	DesignSystemBase<DefaultPalette & P>
>;

let current: ResolvedDesignSystem<Palette> | undefined;

export function defineDesignSystem<P extends Palette = {}>(
	config: DesignSystemConfig<P>,
): ResolvedDesignSystem<P> {
	const base = resolveTheme(config.theme);
	const palette = { ...defaultPalette, ...config.palette } as DefaultPalette & P;
	const light = resolveMode(config.modes.light);
	const dark = config.modes.dark ? resolveMode(config.modes.dark) : light;

	const system = {
		light: { ...base, color: { ...palette, ...light.color }, shadow: light.shadow, mode: "light" },
		dark: { ...base, color: { ...palette, ...dark.color }, shadow: dark.shadow, mode: "dark" },
	} as ResolvedDesignSystem<P>;

	current = system;
	return system;
}

export function getDesignSystem(): ResolvedDesignSystem<Palette> {
	if (!current) throw new TaggedError("defineDesignSystem() must be called before defineSheet()");
	return current;
}

const MODES = ["light", "dark"] as const satisfies readonly ModeName[];

// Set while a factory runs, so nested styles resolve against the mode being built.
let buildingMode: ModeName | undefined;

function toMode(scheme: ColorSchemeName | null): ModeName {
	return scheme === "dark" ? "dark" : "light";
}

function currentMode(): ModeName {
	return buildingMode ?? toMode(Appearance.getColorScheme());
}

function buildForModes<T>(factory: (s: SystemTokens) => T): Record<ModeName, T> {
	const s = getDesignSystem();
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
export function useDesignSystem(): SystemTokens {
	return getDesignSystem()[toMode(useColorScheme())];
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
	factory: (s: SystemTokens) => T & AnyStyle,
): ThemedStyles<T>;
export function defineStyle<T extends AnyStyle>(style: T & AnyStyle): ThemedStyles<T>;
export function defineStyle(
	input: AnyStyle | ((s: SystemTokens) => AnyStyle),
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
	factory: (s: SystemTokens) => T & NamedStyles<any>,
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
