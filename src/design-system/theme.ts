import type { DeepPartial } from "../utils";
import { defaultRadiusConfig, type RadiusConfig } from "./radius";
import {
	defaultTextConfig,
	defaultFontConfig,
	defaultFontWeightConfig,
	defaultLeadingConfig,
	defaultTrackingConfig,
	type TextConfig,
	type FontConfig,
	type FontWeightConfig,
	type LeadingConfig,
	type TrackingConfig,
	type TextKey,
	type TextToken,
} from "./text";

/** Same across all modes. */
export interface BaseTokens {
	/** Tailwind v4 style: `s.spacing(4)` → 4 * base (default base 4 → 16). */
	spacing: (n: number) => number;
	radius: RadiusConfig;
	font: FontConfig;
	text: TextConfig;
	fontWeight: FontWeightConfig;
	leading: LeadingConfig;
	tracking: TrackingConfig;
}

export type ThemeConfig = DeepPartial<Omit<BaseTokens, "spacing">> & { spacing?: number };

export const defaultThemeConfig: Omit<BaseTokens, "spacing"> & { spacing: number } = {
	spacing: 4,
	radius: defaultRadiusConfig,
	font: defaultFontConfig,
	text: defaultTextConfig,
	fontWeight: defaultFontWeightConfig,
	leading: defaultLeadingConfig,
	tracking: defaultTrackingConfig,
};

export function resolveTheme(overrides: ThemeConfig = {}): BaseTokens {
	const base = overrides.spacing ?? defaultThemeConfig.spacing;

	const text = { ...defaultThemeConfig.text };
	for (const key in overrides.text) {
		const k = key as TextKey;
		text[k] = { ...defaultThemeConfig.text[k], ...overrides.text[k] } as TextToken;
	}

	return {
		spacing: (n: number) => n * base,
		radius: { ...defaultThemeConfig.radius, ...overrides.radius },
		font: { ...defaultThemeConfig.font, ...overrides.font },
		text,
		fontWeight: { ...defaultThemeConfig.fontWeight, ...overrides.fontWeight },
		leading: { ...defaultThemeConfig.leading, ...overrides.leading },
		tracking: { ...defaultThemeConfig.tracking, ...overrides.tracking },
	};
}
