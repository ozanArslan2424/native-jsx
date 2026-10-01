import type * as React from "react";
import {
	ActivityIndicator,
	Image,
	KeyboardAvoidingView,
	Modal,
	Pressable,
	RefreshControl,
	ScrollView,
	Switch,
	Text,
	TextInput,
	View,
} from "react-native";

type Intrinsics = {
	view: typeof View;
	text: typeof Text;
	image: typeof Image;
	"scroll-view": typeof ScrollView;
	"text-input": typeof TextInput;
	switch: typeof Switch;
	pressable: typeof Pressable;
	"activity-indicator": typeof ActivityIndicator;
	modal: typeof Modal;
	"keyboard-avoiding-view": typeof KeyboardAvoidingView;
	"refresh-control": typeof RefreshControl;
};

// Getters keep React Native's lazy module init: a component loads the first time its tag renders.
const intrinsics: Intrinsics = {
	get view() {
		return View;
	},
	get text() {
		return Text;
	},
	get image() {
		return Image;
	},
	get "scroll-view"() {
		return ScrollView;
	},
	get "text-input"() {
		return TextInput;
	},
	get switch() {
		return Switch;
	},
	get pressable() {
		return Pressable;
	},
	get "activity-indicator"() {
		return ActivityIndicator;
	},
	get modal() {
		return Modal;
	},
	get "keyboard-avoiding-view"() {
		return KeyboardAvoidingView;
	},
	get "refresh-control"() {
		return RefreshControl;
	},
};

type IntrinsicProps = {
	[K in keyof Intrinsics]: React.ComponentPropsWithRef<Intrinsics[K]> & React.Attributes;
};

function resolve(type: React.ElementType): React.ElementType {
	if (typeof type !== "string") return type;
	// Unknown strings pass through: babel applies this runtime to node_modules too
	// (e.g. Expo's web dev tools render <div>), and TS already rejects unknown tags.
	return (intrinsics as Record<string, React.ElementType>)[type] ?? type;
}

export { type IntrinsicProps, intrinsics, resolve };
