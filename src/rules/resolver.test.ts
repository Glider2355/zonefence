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

// See https://github.com/Glider2355/zonefence/issues/16
describe("resolving files rules", () => {
	it("should inherit files rules from a parent and merge them with the child's", () => {
		const rulesByDirectory: RulesByDirectory = {
			"/root/api": {
				config: { version: 1, files: { allow: ["index.ts"] } },
				ruleFilePath: "/root/api/zonefence.yaml",
			},
			"/root/api/routes": {
				config: {
					version: 1,
					files: {
						allow: ["route.ts"],
						require: [{ for: "*.test.ts", sibling: "{stem}.ts" }],
					},
				},
				ruleFilePath: "/root/api/routes/zonefence.yaml",
			},
		};

		const resolved = resolveRules(rulesByDirectory);
		const routes = resolved.find((rule) => rule.directory === "/root/api/routes");

		expect(routes?.config.files).toEqual({
			allow: ["index.ts", "route.ts"],
			require: [{ for: "*.test.ts", sibling: "{stem}.ts" }],
		});
	});

	it("should apply files rules from directoryPatterns to directories without a rule file", () => {
		const rulesByDirectory: RulesByDirectory = {
			"/root/src": {
				config: {
					version: 1,
					directoryPatterns: [
						{
							pattern: "**/ui",
							config: {
								files: { require: [{ for: "*.tsx", sibling: "{name}.stories.tsx" }] },
							},
						},
					],
				},
				ruleFilePath: "/root/src/zonefence.yaml",
			},
		};

		const resolved = resolveRulesWithPatterns(rulesByDirectory, [
			"/root/src",
			"/root/src/components",
			"/root/src/components/ui",
		]);
		const ui = resolved.find((rule) => rule.directory === "/root/src/components/ui");

		expect(ui?.config.files?.require).toEqual([{ for: "*.tsx", sibling: "{name}.stories.tsx" }]);
	});

	it("should replace inherited files rules when a pattern uses mergeStrategy override", () => {
		const rulesByDirectory: RulesByDirectory = {
			"/root/src": {
				config: {
					version: 1,
					directoryPatterns: [
						{ pattern: "**/routes", config: { files: { allow: ["index.ts"] } }, priority: 0 },
						{
							pattern: "**/routes",
							config: { files: { allow: ["route.ts"] }, mergeStrategy: "override" },
							priority: 10,
						},
					],
				},
				ruleFilePath: "/root/src/zonefence.yaml",
			},
		};

		const resolved = resolveRulesWithPatterns(rulesByDirectory, ["/root/src", "/root/src/routes"]);
		const routes = resolved.find((rule) => rule.directory === "/root/src/routes");

		expect(routes?.config.files?.allow).toEqual(["route.ts"]);
	});

	it("should leave files unset when no rule defines them", () => {
		const rulesByDirectory: RulesByDirectory = {
			"/root/src": {
				config: { version: 1, imports: { allow: [{ from: "./**" }] } },
				ruleFilePath: "/root/src/zonefence.yaml",
			},
		};

		expect(resolveRules(rulesByDirectory)[0].config.files).toBeUndefined();
	});
});
