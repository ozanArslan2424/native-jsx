export type RadiusKey = "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "full";

export type RadiusConfig = Record<RadiusKey, number>;

export const defaultRadiusConfig: RadiusConfig = {
	none: 0,
	xs: 2,
	sm: 4,
	md: 6,
	lg: 8,
	xl: 12,
	"2xl": 16,
	"3xl": 24,
	"4xl": 32,
	full: 9999,
};
