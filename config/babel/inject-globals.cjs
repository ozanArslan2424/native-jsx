const { name } = require("../../package.json");

module.exports = function nativeJsxGlobals({ types: t }) {
	return {
		name: `${name.replace("@ozanarslan/", "")}-inject-globals`,
		visitor: {
			Program(path) {
				let needed = false;

				path.traverse({
					ReferencedIdentifier(p) {
						if (p.node.name === "Styles" && !p.scope.hasBinding("Styles")) {
							needed = true;
							p.stop();
						}
					},
				});

				if (!needed) return;

				path.unshiftContainer(
					"body",
					t.importDeclaration(
						[t.importSpecifier(t.identifier("Styles"), t.identifier("Styles"))],
						t.stringLiteral(`${name}/system`),
					),
				);
			},
		},
	};
};
