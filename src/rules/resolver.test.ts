import { describe, expect, it } from "vitest";
import { resolveRules, resolveRulesWithPatterns } from "./resolver.js";
import type { RulesByDirectory } from "./types.js";

describe("resolveRules with directoryPatterns", () => {
	it("should apply pattern rules to matching directories", () => {
		const rulesByDirectory: RulesByDirectory = {
			"/root/pages": {
				config: {
					version: 1,
					description: "Pages layer",
					directoryPatterns: [
						{
							pattern: "**/containers",
							config: {
								description: "Container layer",
								imports: {
									allow: [{ from: "../presenters/**" }],
									deny: [{ from: "../containers/**", message: "No sibling imports" }],
								},
							},
							priority: 0,
						},
					],
				},
				ruleFilePath: "/root/pages/zonefence.yaml",
			},
			"/root/pages/home/containers": {
				config: {
					version: 1,
				},
				ruleFilePath: "/root/pages/home/containers/zonefence.yaml",
			},
		};

		const resolved = resolveRules(rulesByDirectory);

		const containersRule = resolved.find((r) => r.directory === "/root/pages/home/containers");
		expect(containersRule).toBeDefined();
		expect(containersRule?.appliedPatternRules).toHaveLength(1);
		expect(containersRule?.appliedPatternRules?.[0].pattern).toBe("**/containers");
		expect(containersRule?.config.imports?.allow).toContainEqual({ from: "../presenters/**" });
		expect(containersRule?.config.imports?.deny).toContainEqual({
			from: "../containers/**",
			message: "No sibling imports",
		});
	});

	it("should respect priority when multiple patterns match", () => {
		const rulesByDirectory: RulesByDirectory = {
			"/root/pages": {
				config: {
					version: 1,
					directoryPatterns: [
						{
							pattern: "**/containers",
							config: {
								imports: {
									allow: [{ from: "low-priority" }],
								},
							},
							priority: 0,
						},
						{
							pattern: "home/containers",
							config: {
								imports: {
									allow: [{ from: "high-priority" }],
								},
							},
							priority: 10,
						},
					],
				},
				ruleFilePath: "/root/pages/zonefence.yaml",
			},
			"/root/pages/home/containers": {
				config: { version: 1 },
				ruleFilePath: "/root/pages/home/containers/zonefence.yaml",
			},
		};

		const resolved = resolveRules(rulesByDirectory);

		const containersRule = resolved.find((r) => r.directory === "/root/pages/home/containers");
		expect(containersRule?.appliedPatternRules).toHaveLength(2);
		// Both patterns' imports should be merged
		expect(containersRule?.config.imports?.allow).toContainEqual({ from: "low-priority" });
		expect(containersRule?.config.imports?.allow).toContainEqual({ from: "high-priority" });
	});

	it("should give directory's own config highest priority", () => {
		const rulesByDirectory: RulesByDirectory = {
			"/root/pages": {
				config: {
					version: 1,
					directoryPatterns: [
						{
							pattern: "**/containers",
							config: {
								description: "Pattern description",
								imports: {
									allow: [{ from: "pattern-allow" }],
								},
							},
							priority: 0,
						},
					],
				},
				ruleFilePath: "/root/pages/zonefence.yaml",
			},
			"/root/pages/home/containers": {
				config: {
					version: 1,
					description: "Own description",
					imports: {
						allow: [{ from: "own-allow" }],
					},
				},
				ruleFilePath: "/root/pages/home/containers/zonefence.yaml",
			},
		};

		const resolved = resolveRules(rulesByDirectory);

		const containersRule = resolved.find((r) => r.directory === "/root/pages/home/containers");
		// Own description takes precedence
		expect(containersRule?.config.description).toBe("Own description");
		// But imports should be merged
		expect(containersRule?.config.imports?.allow).toContainEqual({ from: "pattern-allow" });
		expect(containersRule?.config.imports?.allow).toContainEqual({ from: "own-allow" });
	});

	it("should support override merge strategy", () => {
		const rulesByDirectory: RulesByDirectory = {
			"/root/pages": {
				config: {
					version: 1,
					directoryPatterns: [
						{
							pattern: "**/containers",
							config: {
								imports: {
									allow: [{ from: "base-allow" }],
								},
							},
							priority: 0,
						},
						{
							pattern: "home/containers",
							config: {
								imports: {
									allow: [{ from: "override-allow" }],
								},
								mergeStrategy: "override",
							},
							priority: 10,
						},
					],
				},
				ruleFilePath: "/root/pages/zonefence.yaml",
			},
			"/root/pages/home/containers": {
				config: { version: 1 },
				ruleFilePath: "/root/pages/home/containers/zonefence.yaml",
			},
		};

		const resolved = resolveRules(rulesByDirectory);

		const containersRule = resolved.find((r) => r.directory === "/root/pages/home/containers");
		// Override should replace, not merge
		expect(containersRule?.config.imports?.allow).toHaveLength(1);
		expect(containersRule?.config.imports?.allow).toContainEqual({ from: "override-allow" });
	});
});

describe("resolveRulesWithPatterns", () => {
	it("should create rules for directories that only match patterns", () => {
		const rulesByDirectory: RulesByDirectory = {
			"/root/pages": {
				config: {
					version: 1,
					directoryPatterns: [
						{
							pattern: "**/containers",
							config: {
								description: "Container layer",
								imports: {
									allow: [{ from: "../presenters/**" }],
								},
							},
							priority: 0,
						},
					],
				},
				ruleFilePath: "/root/pages/zonefence.yaml",
			},
		};

		// Simulate directories that exist but don't have their own zonefence.yaml
		const allDirectories = [
			"/root/pages",
			"/root/pages/home",
			"/root/pages/home/containers",
			"/root/pages/home/presenters",
			"/root/pages/settings",
			"/root/pages/settings/containers",
		];

		const resolved = resolveRulesWithPatterns(rulesByDirectory, allDirectories);

		// Should have rules for pages + home/containers + settings/containers
		const containerRules = resolved.filter((r) => r.directory.endsWith("/containers"));
		expect(containerRules).toHaveLength(2);

		for (const rule of containerRules) {
			expect(rule.appliedPatternRules).toHaveLength(1);
			expect(rule.config.imports?.allow).toContainEqual({ from: "../presenters/**" });
		}
	});

	it("should not apply patterns outside the source directory scope", () => {
		const rulesByDirectory: RulesByDirectory = {
			"/root/pages": {
				config: {
					version: 1,
					directoryPatterns: [
						{
							pattern: "**/containers",
							config: {
								imports: {
									allow: [{ from: "pages-pattern" }],
								},
							},
							priority: 0,
						},
					],
				},
				ruleFilePath: "/root/pages/zonefence.yaml",
			},
		};

		const allDirectories = [
			"/root/pages",
			"/root/pages/home/containers",
			"/root/api",
			"/root/api/containers", // This should NOT match pages' pattern
		];

		const resolved = resolveRulesWithPatterns(rulesByDirectory, allDirectories);

		const apiContainers = resolved.find((r) => r.directory === "/root/api/containers");
		// api/containers should not exist in resolved rules (no matching patterns)
		expect(apiContainers).toBeUndefined();

		const pagesContainers = resolved.find((r) => r.directory === "/root/pages/home/containers");
		expect(pagesContainers).toBeDefined();
		expect(pagesContainers?.config.imports?.allow).toContainEqual({ from: "pages-pattern" });
	});
});
