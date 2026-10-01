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

	// See https://github.com/Glider2355/zonefence/issues/15
	describe("import rule kind", () => {
		it("should accept type, value and any", () => {
			const result = validateConfig({
				version: 1,
				imports: {
					allow: [{ from: "../gateway/**", kind: "type" }],
					deny: [
						{ from: "../gateway/**", kind: "value", message: "No implementations" },
						{ from: "hono", kind: "any" },
					],
				},
			});

			expect(result.success).toBe(true);
			if (!result.success) return;
			expect(result.data.imports.allow[0]).toEqual({ from: "../gateway/**", kind: "type" });
			expect(result.data.imports.deny[0]).toEqual({
				from: "../gateway/**",
				kind: "value",
				message: "No implementations",
			});
			expect(result.data.imports.deny[1].kind).toBe("any");
		});

		it("should reject an unknown kind", () => {
			const result = validateConfig({
				version: 1,
				imports: { allow: [{ from: "../gateway/**", kind: "types" }] },
			});

			expect(result.success).toBe(false);
		});
	});

	// See https://github.com/Glider2355/zonefence/issues/16
	describe("files", () => {
		it("should accept require and allow rules", () => {
			const result = validateConfig({
				version: 1,
				files: {
					require: [
						{
							for: "**/*.tsx",
							sibling: "{name}.stories.tsx",
							exclude: ["**/*.stories.tsx"],
							message: "Storybook required",
						},
					],
					allow: ["route.ts", "*Dto.ts"],
				},
			});

			expect(result.success).toBe(true);
			if (!result.success) return;
			expect(result.data.files?.allow).toEqual(["route.ts", "*Dto.ts"]);
			expect(result.data.files?.require[0].sibling).toBe("{name}.stories.tsx");
		});

		it("should leave files unset when not configured", () => {
			const result = validateConfig({ version: 1 });

			expect(result.success).toBe(true);
			if (!result.success) return;
			expect(result.data.files).toBeUndefined();
		});

		it("should accept files inside a directoryPatterns config", () => {
			const result = validateConfig({
				version: 1,
				directoryPatterns: [{ pattern: "**/routes", config: { files: { allow: ["route.ts"] } } }],
			});

			expect(result.success).toBe(true);
		});

		it("should require both `for` and `sibling`", () => {
			const result = validateConfig({ version: 1, files: { require: [{ for: "**/*.tsx" }] } });

			expect(result.success).toBe(false);
		});

		it("should reject an unknown key inside files", () => {
			const result = validateConfig({ version: 1, files: { alow: ["route.ts"] } });

			expect(result.success).toBe(false);
		});
	});
});
