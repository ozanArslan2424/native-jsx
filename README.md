# native-jsx

Lowercase intrinsic elements for React Native. Write `<view>` and `<text>` like you would write `<div>` and `<span>` on the web, without importing them.

```tsx
export function Greeting(props: { name: string }) {
	return (
		<view style={styles.container}>
			<text style={styles.title}>Hello, {props.name}</text>
			<pressable onPress={() => console.log("pressed")}>
				<text>Tap me</text>
			</pressable>
		</view>
	);
}
```

Every tag resolves to the React Native core component at runtime and is fully typed with that component's props, including `ref`.

## Install

```sh
npm install @ozanarslan/native-jsx
```

Requires React 19+, React Native 0.86+ and an Expo project (`babel-preset-expo`).

## Setup

Only setup babel:

```sh
npx native-jsx
```

Run every migration at once:

```sh
npx native-jsx --migrate
```

Or pick individual ones:

```sh
npx native-jsx --jsx --eslint
```

| Flag           | What it does                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `--jsx`        | Rewrites core components imported from `react-native` (`<View>`, `<Text>`, …) to intrinsic tags and removes the unused imports |
| `--stylesheet` | Converts `StyleSheet.create` calls to `Styles.defineSheet`                                                                     |
| `--eslint`     | Adds the native-jsx config to your ESLint flat config                                                                          |
| `--oxlint`     | Adds the native-jsx config to your Oxlint config                                                                               |

Migrations run in the order above, whatever order the flags are given in. Commit or stash your changes first so you can review the diff.

Use the package's Babel preset in place of `babel-preset-expo`:

```js
// babel.config.js
module.exports = function (api) {
	api.cache(true);
	return {
		presets: ["@ozanarslan/native-jsx/babel"],
	};
};
```

Point TypeScript's JSX runtime at the package:

```json
// tsconfig.json
{
	"compilerOptions": {
		"jsx": "react-jsx",
		"jsxImportSource": "@ozanarslan/native-jsx"
	}
}
```

Restart Metro with a clean cache after changing the Babel config:

```sh
npx expo start --clear
```

## Intrinsic elements

| Tag                        | Component              |
| -------------------------- | ---------------------- |
| `<view>`                   | `View`                 |
| `<text>`                   | `Text`                 |
| `<image>`                  | `Image`                |
| `<scroll-view>`            | `ScrollView`           |
| `<text-input>`             | `TextInput`            |
| `<switch>`                 | `Switch`               |
| `<pressable>`              | `Pressable`            |
| `<activity-indicator>`     | `ActivityIndicator`    |
| `<modal>`                  | `Modal`                |
| `<keyboard-avoiding-view>` | `KeyboardAvoidingView` |
| `<refresh-control>`        | `RefreshControl`       |

Components load lazily: a component's module is only initialized the first time its tag renders, the same as importing it from `react-native`.

Generic components such as `FlatList` and `SectionList` are not intrinsics. JSX intrinsic props can't take type parameters, so `renderItem` would lose its item type. Import them from `react-native` as usual; they work side by side with intrinsic tags.

## Styling

The package includes a small design system with light and dark modes.

### Define the system

```ts
// src/design-system.ts
import { defineDesignSystem } from "@ozanarslan/native-jsx";

export const designSystem = defineDesignSystem({
	palette: {
		serviceUp: "#22c55e",
	},
	modes: {
		dark: {
			color: {
				background: "#0b0b0d",
				foreground: "#ededef",
				primary: "#34d399",
				// ...
			},
		},
		light: {
			color: {
				background: "#f2f2f7",
				foreground: "#111114",
				primary: "#047857",
				// ...
			},
		},
	},
});

declare module "@ozanarslan/native-jsx" {
	interface Register {
		designSystem: typeof designSystem;
	}
}
```

Import it once at the root of your app, for example in `app/_layout.tsx`:

```ts
import "@/design-system";
```

The `Register` declaration types every token you use in style sheets. Palette entries can be single colors or full 50–950 scales.

### Style sheets

`Styles` is available globally. `Styles.defineSheet` takes a function that receives the tokens and builds the sheet once per mode:

```tsx
export function Card(props: Props) {
	const styles = styleSheet.useWithColorScheme();

	return (
		<view style={styles.card}>
			<text style={styles.title}>{props.title}</text>
		</view>
	);
}

const styleSheet = Styles.defineSheet((s) => ({
	card: {
		padding: s.spacing(4),
		borderRadius: s.radius.lg,
		backgroundColor: s.color.card,
	},
	title: {
		...s.text.base,
		fontWeight: "600",
		color: s.color.cardForeground,
	},
}));
```

`useWithColorScheme()` returns the styles for the current color scheme and re-renders when it changes. Reading `styleSheet.card` directly also resolves against the current scheme, but doesn't re-render.

### Shared styles

`Styles.defineStyle` creates a single style to spread into sheets. It accepts an object or a token factory:

```ts
const button = Styles.defineStyle((s) => ({
	height: 44,
	borderRadius: s.radius.md,
	alignItems: "center",
	justifyContent: "center",
}));

const styleSheet = Styles.defineSheet((s) => ({
	primaryButton: {
		...button,
		backgroundColor: s.color.primary,
	},
}));
```

Spread inside a sheet, a shared style resolves against the mode that sheet is being built for.

### Tokens outside style sheets

For props that take a color rather than a style, use `Styles.useDesignSystem()`:

```tsx
const s = Styles.useDesignSystem();

<activity-indicator color={s.color.primary} />;
```

## NativeWind

To use intrinsic tags with NativeWind's `className`, point the JSX runtime at the NativeWind entry instead:

```json
{
	"compilerOptions": {
		"jsxImportSource": "@ozanarslan/native-jsx/nativewind"
	}
}
```

## Linting

Intrinsic tags take React Native props, which React lint rules check against DOM attributes. The package ships configs for ESLint and Oxlint that turn those checks off, and the CLI adds them to your config:

```sh
npx native-jsx --eslint
npx native-jsx --oxlint
```

Or add them yourself. ESLint (flat config), last in the array:

```js
import nativeJsx from "@ozanarslan/native-jsx/eslint";

export default [
	// your other configs
	nativeJsx,
];
```

Oxlint, last in `extends`:

```ts
import { defineConfig } from "oxlint";
import nativeJsx from "@ozanarslan/native-jsx/oxlint";

export default defineConfig({
	extends: [nativeJsx],
});
```

## License

MIT
