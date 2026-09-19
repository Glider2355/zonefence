import path from "node:path";
import { describe, expect, it } from "vitest";
import { collectImports, isExternalImport } from "./import-collector.js";
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
