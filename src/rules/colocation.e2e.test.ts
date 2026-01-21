import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadRulesForDirectoryWithAllDirs } from "./loader.js";
import { resolveRulesWithPatterns } from "./resolver.js";

const FIXTURE_PATH = path.resolve(__dirname, "../../test-fixtures/colocation/src/pages");

describe("Colocation E2E", () => {
	it("should load rules with directoryPatterns", async () => {
		const { rules } = await loadRulesForDirectoryWithAllDirs(FIXTURE_PATH);

		expect(rules[FIXTURE_PATH]).toBeDefined();
		expect(rules[FIXTURE_PATH].config.directoryPatterns).toHaveLength(2);
	});

	it("should apply patterns to descendant directories", async () => {
		const { rules, allDirectories } = await loadRulesForDirectoryWithAllDirs(FIXTURE_PATH);
		const resolved = resolveRulesWithPatterns(rules, allDirectories);

		// Find all container rules
		const containerRules = resolved.filter((r) => r.directory.endsWith("/containers"));
		expect(containerRules.length).toBeGreaterThanOrEqual(2);

		for (const rule of containerRules) {
			expect(rule.appliedPatternRules).toBeDefined();
			expect(rule.appliedPatternRules?.some((p) => p.pattern === "**/containers")).toBe(true);

			// Check that the pattern rules are applied
			expect(rule.config.imports?.allow).toContainEqual({ from: "../presenters/**" });
			expect(rule.config.imports?.deny).toContainEqual({
				from: "../containers/**",
				message: "Containers should not import from sibling containers",
			});
		}

		// Find all presenter rules
		const presenterRules = resolved.filter((r) => r.directory.endsWith("/presenters"));
		expect(presenterRules.length).toBeGreaterThanOrEqual(2);

		for (const rule of presenterRules) {
			expect(rule.appliedPatternRules).toBeDefined();
			expect(rule.appliedPatternRules?.some((p) => p.pattern === "**/presenters")).toBe(true);

			// Check that the pattern rules are applied
			expect(rule.config.imports?.deny).toContainEqual({
				from: "../containers/**",
				message: "Presenters should not import from containers",
			});
		}
	});

	it("should inherit parent scope.exclude patterns", async () => {
		const { rules, allDirectories } = await loadRulesForDirectoryWithAllDirs(FIXTURE_PATH);
		const resolved = resolveRulesWithPatterns(rules, allDirectories);

		// All resolved rules should have the exclude pattern from parent
		for (const rule of resolved) {
			expect(rule.excludePatterns).toContain("**/*.test.tsx");
		}
	});
});
