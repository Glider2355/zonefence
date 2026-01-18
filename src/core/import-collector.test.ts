import { describe, expect, it } from "vitest";
import { isExternalImport } from "./import-collector.js";

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
