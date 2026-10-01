/** Lint rules shared by the eslint and oxlint configs. */
module.exports = {
	// Intrinsic tags (<view>, <text>) take React Native props, which the react plugin checks against DOM attributes.
	"react/no-unknown-property": "off",
};
