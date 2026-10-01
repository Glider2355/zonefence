import path from "node:path";
import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import {
	collectImports,
	collectImportsWithDiagnostics,
	isExternalImport,
} from "./import-collector.js";
import { createProject } from "./project.js";
import type { ImportInfo } from "./types.js";

describe("isExternalImport", () => {
	describe("relative imports", () => {
		it("should return false for relative imports starting with ./", () => {
			expect(isExternalImport("./utils", null)).toBe(false);
			expect(isExternalImport("./utils", "/project/src/utils.ts")).toBe(false);
		});

		it("should return false for relative imports starting with ../", () => {
			expect(isExternalImport("../utils", null)).toBe(false);
			expect(isExternalImport("../utils", "/project/utils.ts")).toBe(false);
		});

		it("should return false for absolute imports starting with /", () => {
			expect(isExternalImport("/absolute/path", null)).toBe(false);
		});
	});

	describe("external packages", () => {
		it("should return true for unresolved external packages", () => {
			expect(isExternalImport("lodash", null)).toBe(true);
			expect(isExternalImport("hono", null)).toBe(true);
			expect(isExternalImport("@types/node", null)).toBe(true);
		});

		it("should return true for resolved external packages in node_modules", () => {
			expect(isExternalImport("lodash", "/project/node_modules/lodash/index.js")).toBe(true);
			expect(isExternalImport("hono", "/project/node_modules/hono/dist/index.js")).toBe(true);
			expect(isExternalImport("@types/node", "/project/node_modules/@types/node/index.d.ts")).toBe(
				true,
			);
		});

		it("should return true for packages resolved in nested node_modules", () => {
			expect(
				isExternalImport("some-dep", "/project/node_modules/parent/node_modules/some-dep/index.js"),
			).toBe(true);
		});
	});

	describe("path aliases", () => {
		it("should return false for path aliases resolved to local files", () => {
			expect(isExternalImport("@/utils", "/project/src/utils.ts")).toBe(false);
			expect(isExternalImport("~/components", "/project/src/components/index.ts")).toBe(false);
		});

		it("should return true for unresolved path aliases (treated as external)", () => {
			expect(isExternalImport("@/utils", null)).toBe(true);
		});
	});

	describe("node: protocol", () => {
		it("should return true for node: protocol imports", () => {
			expect(isExternalImport("node:fs", null)).toBe(true);
			expect(isExternalImport("node:path", null)).toBe(true);
		});
	});
});

// See https://github.com/Glider2355/zonefence/issues/14
describe("collectImports - dynamic import() and require()", () => {
	const fixtureDir = path.resolve(__dirname, "../../test-fixtures/dynamic-imports");

	function collectConsumerImports(): ImportInfo[] {
		const project = createProject({ rootDir: fixtureDir });
		return collectImports(project, fixtureDir).filter((importInfo) =>
			importInfo.sourceFile.endsWith("consumer.ts"),
		);
	}

	it("should collect a dynamic import of an external package", () => {
		const collected = collectConsumerImports();
		const dynamicExternal = collected.find(
			(importInfo) => importInfo.moduleSpecifier === "@opennextjs/cloudflare",
		);

		expect(dynamicExternal).toBeDefined();
		expect(dynamicExternal?.isExternal).toBe(true);
	});

	it("should collect and resolve a dynamic import of a local module", () => {
		const collected = collectConsumerImports();
		const dynamicLocal = collected.find(
			(importInfo) => importInfo.moduleSpecifier === "./target.js",
		);

		expect(dynamicLocal).toBeDefined();
		expect(dynamicLocal?.isExternal).toBe(false);
		// A ".js" specifier resolves to the TypeScript source
		expect(dynamicLocal?.resolvedPath).toBe(path.join(fixtureDir, "target.ts"));
	});

	it("should collect a require() call", () => {
		const collected = collectConsumerImports();

		expect(collected.some((importInfo) => importInfo.moduleSpecifier === "node:fs")).toBe(true);
	});

	it("should skip non-literal specifiers such as template literals", () => {
		const collected = collectConsumerImports();

		expect(collected.some((importInfo) => importInfo.moduleSpecifier.includes("${"))).toBe(false);
		expect(collected).toHaveLength(3);
	});

	it("should record the line number of the dynamic import", () => {
		const collected = collectConsumerImports();
		const dynamicExternal = collected.find(
			(importInfo) => importInfo.moduleSpecifier === "@opennextjs/cloudflare",
		);

		expect(dynamicExternal?.line).toBe(2);
	});
});

// See https://github.com/Glider2355/zonefence/issues/14
describe("collectImportsWithDiagnostics - non-literal specifiers", () => {
	const fixtureDir = path.resolve(__dirname, "../../test-fixtures/dynamic-imports");

	it("should report a dynamic import whose specifier is not a string literal", () => {
		const project = createProject({ rootDir: fixtureDir });
		const { unanalyzable } = collectImportsWithDiagnostics(project, fixtureDir);

		expect(unanalyzable).toHaveLength(1);
		expect(unanalyzable[0].sourceFile).toBe(path.join(fixtureDir, "consumer.ts"));
		expect(unanalyzable[0].expression).toBe("import(`./${name}.js`)");
		expect(unanalyzable[0].line).toBe(16);
	});

	it("should return the same imports as collectImports", () => {
		const project = createProject({ rootDir: fixtureDir });

		expect(collectImportsWithDiagnostics(project, fixtureDir).imports).toEqual(
			collectImports(project, fixtureDir),
		);
	});

	it("should treat a template literal without substitutions as a literal specifier", () => {
		const project = new Project({ useInMemoryFileSystem: true });
		project.createSourceFile("/src/a.ts", "export const load = () => import(`./b`);");
		project.createSourceFile("/src/b.ts", "export const b = 1;");

		const { imports, unanalyzable } = collectImportsWithDiagnostics(project, "/src");

		expect(unanalyzable).toEqual([]);
		expect(imports.map((importInfo) => importInfo.resolvedPath)).toEqual(["/src/b.ts"]);
	});
});

// See https://github.com/Glider2355/zonefence/issues/15
describe("collectImports - type-only imports", () => {
	// Kept in memory rather than as a fixture file: a formatter would rewrite the
	// inline `type` forms into `import type`, erasing the cases under test.
	const consumerSource = [
		'import type { NovelGateway } from "./port.js";',
		'import { type NovelGateway as InlineTypeOnly } from "./port.js";',
		'import { type NovelGateway as Mixed, gateway } from "./port.js";',
		'import * as port from "./port.js";',
		'import "./port.js";',
		"",
		'export type { NovelGateway as ReExportedType } from "./port.js";',
		'export { type NovelGateway as InlineReExportedType } from "./port.js";',
		'export { gateway as reExportedValue } from "./port.js";',
		'export * from "./port.js";',
	].join("\n");

	let cachedKinds: Record<number, string | undefined> | undefined;

	function kindsByLine(): Record<number, string | undefined> {
		if (!cachedKinds) {
			const project = new Project({ useInMemoryFileSystem: true });
			project.createSourceFile(
				"/src/port.ts",
				"export interface NovelGateway {}\nexport const gateway: NovelGateway = {};",
			);
			project.createSourceFile("/src/consumer.ts", consumerSource);

			const collected = collectImports(project, "/src").filter((importInfo) =>
				importInfo.sourceFile.endsWith("consumer.ts"),
			);
			cachedKinds = Object.fromEntries(
				collected.map((importInfo) => [importInfo.line, importInfo.kind]),
			);
		}
		return cachedKinds;
	}

	it("should classify `import type` as type", () => {
		expect(kindsByLine()[1]).toBe("type");
	});

	it("should classify an import whose named bindings are all inline types as type", () => {
		expect(kindsByLine()[2]).toBe("type");
	});

	it("should classify a mixed type and value import as value", () => {
		expect(kindsByLine()[3]).toBe("value");
	});

	it("should classify namespace and side-effect imports as value", () => {
		expect(kindsByLine()[4]).toBe("value");
		expect(kindsByLine()[5]).toBe("value");
	});

	it("should classify `export type { } from` and all-inline-type re-exports as type", () => {
		expect(kindsByLine()[7]).toBe("type");
		expect(kindsByLine()[8]).toBe("type");
	});

	it("should classify value re-exports and `export *` as value", () => {
		expect(kindsByLine()[9]).toBe("value");
		expect(kindsByLine()[10]).toBe("value");
	});

	it("should classify dynamic imports as value", () => {
		const dynamicFixtureDir = path.resolve(__dirname, "../../test-fixtures/dynamic-imports");
		const project = createProject({ rootDir: dynamicFixtureDir });
		const dynamicImports = collectImports(project, dynamicFixtureDir);

		expect(dynamicImports.length).toBeGreaterThan(0);
		expect(dynamicImports.every((importInfo) => importInfo.kind === "value")).toBe(true);
	});
});
