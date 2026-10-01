import { TaggedError } from "../utils";
import { resolveMode, type ModeConfig, type ModeName, type ModeTokens } from "./mode";
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
