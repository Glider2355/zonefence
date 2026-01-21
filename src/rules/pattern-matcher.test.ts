import { describe, expect, it } from "vitest";
import {
	calculateSpecificity,
	collectPatternSources,
	findMatchingPatterns,
	matchDirectoryPattern,
} from "./pattern-matcher.js";

describe("matchDirectoryPattern", () => {
	it("should match simple pattern", () => {
		expect(
			matchDirectoryPattern("/root/pages/home/containers", "**/containers", "/root/pages"),
		).toBe(true);
	});

	it("should match nested pattern", () => {
		expect(
			matchDirectoryPattern("/root/pages/settings/containers", "**/containers", "/root/pages"),
		).toBe(true);
	});

	it("should not match outside source directory", () => {
		expect(matchDirectoryPattern("/root/api/containers", "**/containers", "/root/pages")).toBe(
			false,
		);
	});

	it("should not match the source directory itself", () => {
		expect(matchDirectoryPattern("/root/pages", "**/pages", "/root/pages")).toBe(false);
	});

	it("should match single wildcard pattern", () => {
		expect(
			matchDirectoryPattern("/root/pages/home/presenters", "*/presenters", "/root/pages"),
		).toBe(true);
	});

	it("should not match deeper nesting with single wildcard", () => {
		expect(
			matchDirectoryPattern("/root/pages/home/sub/presenters", "*/presenters", "/root/pages"),
		).toBe(false);
	});

	it("should match double wildcard at any depth", () => {
		expect(
			matchDirectoryPattern("/root/pages/home/sub/presenters", "**/presenters", "/root/pages"),
		).toBe(true);
	});
});

describe("calculateSpecificity", () => {
	it("should give higher specificity to literal patterns", () => {
		const literalSpec = calculateSpecificity("containers");
		const wildcardSpec = calculateSpecificity("*");
		expect(literalSpec).toBeGreaterThan(wildcardSpec);
	});

	it("should give higher specificity to longer literal paths", () => {
		const longPath = calculateSpecificity("home/containers");
		const shortPath = calculateSpecificity("containers");
		expect(longPath).toBeGreaterThan(shortPath);
	});

	it("should give lower specificity to double wildcards", () => {
		const doubleWildcard = calculateSpecificity("**/containers");
		const singleWildcard = calculateSpecificity("*/containers");
		expect(singleWildcard).toBeGreaterThan(doubleWildcard);
	});
});

describe("findMatchingPatterns", () => {
	it("should find matching patterns and sort by priority", () => {
		const patternSources = [
			{
				sourceFile: "/root/pages/zonefence.yaml",
				sourceDir: "/root/pages",
				patterns: [
					{
						pattern: "**/containers",
						config: { description: "Container layer" },
						priority: 0,
					},
					{
						pattern: "home/containers",
						config: { description: "Home container layer" },
						priority: 10,
					},
				],
			},
		];

		const matches = findMatchingPatterns("/root/pages/home/containers", patternSources);

		expect(matches).toHaveLength(2);
		// Higher priority first
		expect(matches[0].pattern).toBe("home/containers");
		expect(matches[0].priority).toBe(10);
		expect(matches[1].pattern).toBe("**/containers");
	});

	it("should return empty array when no patterns match", () => {
		const patternSources = [
			{
				sourceFile: "/root/pages/zonefence.yaml",
				sourceDir: "/root/pages",
				patterns: [
					{
						pattern: "**/containers",
						config: { description: "Container layer" },
						priority: 0,
					},
				],
			},
		];

		const matches = findMatchingPatterns("/root/api/containers", patternSources);

		expect(matches).toHaveLength(0);
	});

	it("should sort by specificity when priorities are equal", () => {
		const patternSources = [
			{
				sourceFile: "/root/pages/zonefence.yaml",
				sourceDir: "/root/pages",
				patterns: [
					{
						pattern: "**/containers",
						config: { description: "Any containers" },
						priority: 0,
					},
					{
						pattern: "*/containers",
						config: { description: "Direct child containers" },
						priority: 0,
					},
				],
			},
		];

		const matches = findMatchingPatterns("/root/pages/home/containers", patternSources);

		expect(matches).toHaveLength(2);
		// More specific pattern (*/containers) should come first
		expect(matches[0].pattern).toBe("*/containers");
	});
});

describe("collectPatternSources", () => {
	it("should collect patterns from rules with directoryPatterns", () => {
		const rulesByDirectory = {
			"/root/pages": {
				config: {
					directoryPatterns: [
						{
							pattern: "**/containers",
							config: { description: "Container layer" },
							priority: 0,
						},
					],
				},
				ruleFilePath: "/root/pages/zonefence.yaml",
			},
			"/root/api": {
				config: {},
				ruleFilePath: "/root/api/zonefence.yaml",
			},
		};

		const sources = collectPatternSources(rulesByDirectory);

		expect(sources).toHaveLength(1);
		expect(sources[0].sourceDir).toBe("/root/pages");
		expect(sources[0].patterns).toHaveLength(1);
	});

	it("should return empty array when no patterns defined", () => {
		const rulesByDirectory = {
			"/root/pages": {
				config: {},
				ruleFilePath: "/root/pages/zonefence.yaml",
			},
		};

		const sources = collectPatternSources(rulesByDirectory);

		expect(sources).toHaveLength(0);
	});
});
