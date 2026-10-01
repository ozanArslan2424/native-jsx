const { name } = require("../../package.json");

module.exports = function nativeJsxPreset(_api, options = {}) {
	return {
		plugins: [require("./inject-globals.cjs")],
		presets: [["babel-preset-expo", { ...options, jsxImportSource: name }]],
	};
};
