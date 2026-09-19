import { describe, expect, it } from "vitest";
import { validateConfig } from "./schema.js";

// See https://github.com/Glider2355/zonefence/issues/10
describe("zoneFenceConfigSchema", () => {
	describe("reason alias", () => {
		it("should accept `reason` as an alias of `message`", () => {
			const result = validateConfig({
				version: 1,
				imports: {
					deny: [{ from: "hono", reason: "Core layer cannot depend on an HTTP framework" }],
				},
			});

			expect(result.success).toBe(true);
			if (!result.success) return;
			expect(result.data.imports.deny[0]).toEqual({
				from: "hono",
				message: "Core layer cannot depend on an HTTP framework",
			});
		});

		it("should prefer `message` when both are present", () => {
			const result = validateConfig({
				version: 1,
				imports: { deny: [{ from: "hono", message: "from message", reason: "from reason" }] },
			});

			expect(result.success).toBe(true);
			if (!result.success) return;
			expect(result.data.imports.deny[0].message).toBe("from message");
		});

		it("should leave message unset when neither is given", () => {
			const result = validateConfig({ version: 1, imports: { allow: [{ from: "./**" }] } });

			expect(result.success).toBe(true);
			if (!result.success) return;
			expect(result.data.imports.allow[0]).toEqual({ from: "./**" });
		});

		it("should still accept a bare string entry", () => {
			const result = validateConfig({ version: 1, imports: { allow: ["./**"] } });

			expect(result.success).toBe(true);
			if (!result.success) return;
			expect(result.data.imports.allow[0]).toEqual({ from: "./**" });
		});
	});

	describe("unknown keys", () => {
		it("should reject a typo in an import rule instead of dropping it", () => {
			const result = validateConfig({
				version: 1,
				imports: { deny: [{ from: "hono", mesage: "typo" }] },
			});

			expect(result.success).toBe(false);
		});

		it("should reject an unknown top-level key", () => {
			const result = validateConfig({ version: 1, importz: {} });

			expect(result.success).toBe(false);
		});

		it("should reject an unknown key inside imports", () => {
			const result = validateConfig({ version: 1, imports: { allow: ["./**"], modee: "deny" } });

			expect(result.success).toBe(false);
		});

		it("should reject an unknown key inside a directoryPatterns entry", () => {
			const result = validateConfig({
				version: 1,
				directoryPatterns: [{ pattern: "**/containers", config: {}, prioriti: 1 }],
			});

			expect(result.success).toBe(false);
		});

		it("should reject an unknown key inside scope", () => {
			const result = validateConfig({ version: 1, scope: { excludes: ["**/*.test.ts"] } });

			expect(result.success).toBe(false);
		});
	});
});
