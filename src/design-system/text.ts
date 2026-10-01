import { Platform } from "react-native";

export type TextKey =
	| "xs"
	| "sm"
	| "base"
	| "lg"
	| "xl"
	| "2xl"
	| "3xl"
	| "4xl"
	| "5xl"
	| "6xl"
	| "7xl"
	| "8xl"
	| "9xl";

/** Spreadable: `...s.text.lg` sets fontSize + lineHeight, like `text-lg`. */
export interface TextToken {
	fontSize: number;
	lineHeight: number;
}

export type TextConfig = Record<TextKey, TextToken>;

export const defaultTextConfig: TextConfig = {
	xs: { fontSize: 12, lineHeight: 16 },
	sm: { fontSize: 14, lineHeight: 20 },
	base: { fontSize: 16, lineHeight: 24 },
	lg: { fontSize: 18, lineHeight: 28 },
	xl: { fontSize: 20, lineHeight: 28 },
	"2xl": { fontSize: 24, lineHeight: 32 },
	"3xl": { fontSize: 30, lineHeight: 36 },
	"4xl": { fontSize: 36, lineHeight: 40 },
	"5xl": { fontSize: 48, lineHeight: 48 },
	"6xl": { fontSize: 60, lineHeight: 60 },
	"7xl": { fontSize: 72, lineHeight: 72 },
	"8xl": { fontSize: 96, lineHeight: 96 },
	"9xl": { fontSize: 128, lineHeight: 128 },
};

export type FontKey = "sans" | "serif" | "mono";

export type FontConfig = Record<FontKey, string>;

export const defaultFontConfig: FontConfig = {
	sans: Platform.select({ ios: "System", default: "sans-serif" }),
	serif: Platform.select({ ios: "Georgia", default: "serif" }),
	mono: Platform.select({ ios: "Menlo", default: "monospace" }),
};

export type FontWeightKey =
	| "thin"
	| "extralight"
	| "light"
	| "normal"
	| "medium"
	| "semibold"
	| "bold"
	| "extrabold"
	| "black";

export type FontWeightValue = "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";

export type FontWeightConfig = Record<FontWeightKey, FontWeightValue>;

export const defaultFontWeightConfig: FontWeightConfig = {
	thin: "100",
	extralight: "200",
	light: "300",
	normal: "400",
	medium: "500",
	semibold: "600",
	bold: "700",
	extrabold: "800",
	black: "900",
};

export type LeadingKey = 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type LeadingConfig = Record<LeadingKey, number>;

export const defaultLeadingConfig: LeadingConfig = {
	3: 12,
	4: 16,
	5: 20,
	6: 24,
	7: 28,
	8: 32,
	9: 36,
	10: 40,
};

export type TrackingKey = "tighter" | "tight" | "normal" | "wide" | "wider" | "widest";

export type TrackingConfig = Record<TrackingKey, number>;

/** Tailwind uses em; RN letterSpacing is absolute. Calibrated to 16px text. */
export const defaultTrackingConfig: TrackingConfig = {
	tighter: -0.8,
	tight: -0.4,
	normal: 0,
	wide: 0.4,
	wider: 0.8,
	widest: 1.6,
};
