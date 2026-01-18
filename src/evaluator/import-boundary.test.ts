import { describe, expect, it } from "vitest";
import type { ImportInfo } from "../core/types.js";
import type { ResolvedRule } from "../rules/types.js";
import { evaluateImportBoundary } from "./import-boundary.js";

// Helper to create ImportInfo for external packages
function createExternalImport(moduleSpecifier: string): ImportInfo {
	return {
		moduleSpecifier,
		sourceFile: "/project/src/index.ts",
		resolvedPath: null,
		isExternal: true,
		line: 1,
		column: 1,
	};
}

// Helper to create ImportInfo for internal imports (local files)
function createInternalImport(moduleSpecifier: string, resolvedPath: string): ImportInfo {
	return {
		moduleSpecifier,
		sourceFile: "/project/src/index.ts",
		resolvedPath,
		isExternal: false,
		line: 1,
		column: 1,
	};
}

// Helper to create a rule
function createRule(options: {
	allow?: string[];
	deny?: string[];
	mode?: "allow-first" | "deny-first";
}): ResolvedRule[] {
	return [
		{
			directory: "/project/src",
			ruleFilePath: "/project/src/zonefence.yaml",
			excludePatterns: [],
			config: {
				version: 1,
				imports: {
					mode: options.mode ?? "allow-first",
					allow: options.allow?.map((from) => ({ from })),
					deny: options.deny?.map((from) => ({ from })),
				},
			},
		},
	];
}

describe("matchesPattern - external packages", () => {
	const rootDir = "/project";

	describe("exact match", () => {
		it("should match exact package name", () => {
			const importInfo = createExternalImport("lodash");
			const rules = createRule({ allow: ["lodash"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			expect(result).toBeNull(); // null means allowed
		});

		it("should NOT match similar package names (lodash vs lodash-es)", () => {
			const importInfo = createExternalImport("lodash-es");
			const rules = createRule({ allow: ["lodash"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			expect(result).not.toBeNull(); // should be a violation
		});
	});

	describe("scoped packages", () => {
		it("should match exact scoped package name", () => {
			const importInfo = createExternalImport("@types/node");
			const rules = createRule({ allow: ["@types/node"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			expect(result).toBeNull();
		});

		it("should match scoped package with subpath", () => {
			const importInfo = createExternalImport("@types/node/fs");
			const rules = createRule({ allow: ["@types/node"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			expect(result).toBeNull();
		});
	});

	describe("glob patterns", () => {
		it("should match with glob pattern @types/*", () => {
			const importInfo = createExternalImport("@types/node");
			const rules = createRule({ allow: ["@types/*"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			expect(result).toBeNull();
		});

		it("should match with glob pattern @babel/*", () => {
			const importInfo = createExternalImport("@babel/core");
			const rules = createRule({ allow: ["@babel/*"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			expect(result).toBeNull();
		});

		it("should match lodash* pattern for lodash-es", () => {
			const importInfo = createExternalImport("lodash-es");
			const rules = createRule({ allow: ["lodash*"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			expect(result).toBeNull();
		});

		it("should match react* pattern for react-dom", () => {
			const importInfo = createExternalImport("react-dom");
			const rules = createRule({ allow: ["react*"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			expect(result).toBeNull();
		});

		it("should NOT match @types/* for @babel/core", () => {
			const importInfo = createExternalImport("@babel/core");
			const rules = createRule({ allow: ["@types/*"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			expect(result).not.toBeNull();
		});
	});

	describe("deny rules", () => {
		it("should deny exact package match", () => {
			const importInfo = createExternalImport("lodash");
			const rules = createRule({ deny: ["lodash"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			expect(result).not.toBeNull();
		});

		it("should deny with glob pattern", () => {
			const importInfo = createExternalImport("@internal/utils");
			const rules = createRule({ deny: ["@internal/*"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			expect(result).not.toBeNull();
		});
	});

	describe("package subpaths", () => {
		it("should match lodash/get with lodash pattern", () => {
			const importInfo = createExternalImport("lodash/get");
			const rules = createRule({ allow: ["lodash"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			expect(result).toBeNull();
		});

		it("should match @babel/core/lib/config with @babel/core pattern", () => {
			const importInfo = createExternalImport("@babel/core/lib/config");
			const rules = createRule({ allow: ["@babel/core"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			expect(result).toBeNull();
		});

		it("should match @babel/core with @babel/* pattern", () => {
			const importInfo = createExternalImport("@babel/core");
			const rules = createRule({ allow: ["@babel/*"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			expect(result).toBeNull();
		});

		it("should match @babel/core/lib with @babel/* pattern", () => {
			const importInfo = createExternalImport("@babel/core/lib");
			const rules = createRule({ allow: ["@babel/*"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			expect(result).toBeNull();
		});

		it("should match @babel/core/lib/config with @babel/** pattern", () => {
			const importInfo = createExternalImport("@babel/core/lib/config");
			const rules = createRule({ allow: ["@babel/**"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			expect(result).toBeNull();
		});
	});

	describe("edge cases", () => {
		it("should NOT match @babel/core with @babel pattern (no glob)", () => {
			const importInfo = createExternalImport("@babel/core");
			const rules = createRule({ allow: ["@babel"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			// @babel/core should NOT match @babel because @babel is a different scope
			expect(result).not.toBeNull();
		});

		it("should match node:fs with node:* pattern", () => {
			const importInfo = createExternalImport("node:fs");
			const rules = createRule({ allow: ["node:*"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			expect(result).toBeNull();
		});

		it("should NOT match fs with node:* pattern", () => {
			const importInfo = createExternalImport("fs");
			const rules = createRule({ allow: ["node:*"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			expect(result).not.toBeNull();
		});
	});
});

describe("matchesPattern - internal paths", () => {
	const rootDir = "/project";

	describe("resolved path matching", () => {
		it("should match internal path with glob pattern", () => {
			// import from "@/api/helpers/errorHandler" resolves to api/helpers/errorHandler.ts
			const importInfo = createInternalImport(
				"@/api/helpers/errorHandler",
				"/project/src/api/helpers/errorHandler.ts",
			);
			const rules = createRule({ allow: ["src/api/**"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			expect(result).toBeNull();
		});

		it("should match internal path with exact pattern", () => {
			const importInfo = createInternalImport("./utils/helper", "/project/src/utils/helper.ts");
			const rules = createRule({ allow: ["src/utils/**"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			expect(result).toBeNull();
		});
	});

	describe("path alias matching", () => {
		it("should match path alias pattern @/api/**", () => {
			const importInfo = createInternalImport(
				"@/api/helpers/errorHandler",
				"/project/src/api/helpers/errorHandler.ts",
			);
			const rules = createRule({ allow: ["@/api/**"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			expect(result).toBeNull();
		});

		it("should match path alias pattern @/**", () => {
			const importInfo = createInternalImport("@/utils/helper", "/project/src/utils/helper.ts");
			const rules = createRule({ allow: ["@/**"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			expect(result).toBeNull();
		});

		it("should deny path alias with deny rule", () => {
			const importInfo = createInternalImport(
				"@/internal/secret",
				"/project/src/internal/secret.ts",
			);
			const rules = createRule({ deny: ["@/internal/**"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			expect(result).not.toBeNull();
		});
	});

	describe("workspace package matching", () => {
		it("should match workspace package pattern @image-router/*", () => {
			// Workspace package resolves outside rootDir
			const importInfo = createInternalImport(
				"@image-router/shared",
				"/project/../shared/index.ts",
			);
			const rules = createRule({ allow: ["@image-router/*"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			expect(result).toBeNull();
		});

		it("should match workspace package with subpath", () => {
			const importInfo = createInternalImport(
				"@image-router/shared/utils",
				"/project/../shared/utils/index.ts",
			);
			const rules = createRule({ allow: ["@image-router/**"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			expect(result).toBeNull();
		});

		it("should deny workspace package with deny rule", () => {
			const importInfo = createInternalImport(
				"@image-router/internal",
				"/project/../internal/index.ts",
			);
			const rules = createRule({ deny: ["@image-router/internal"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir);
			expect(result).not.toBeNull();
		});
	});
});

describe("matchesPattern - path alias resolution with pathsMapping", () => {
	const rootDir = "/project";
	const pathsMapping = {
		"@/*": ["./src/*"],
		"@api/*": ["./src/api/*"],
	};

	describe("pattern resolution", () => {
		it("should match resolved path when pattern uses alias @/api/**", () => {
			// Pattern @/api/** should resolve to src/api/** and match src/api/routes/handler.ts
			const importInfo = createInternalImport("./handler", "/project/src/api/routes/handler.ts");
			const rules = createRule({ allow: ["@/api/**"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir, { pathsMapping });
			expect(result).toBeNull();
		});

		it("should match resolved path with deeper nesting", () => {
			const importInfo = createInternalImport(
				"./handler",
				"/project/src/api/routes/novel/likes/add/handler.ts",
			);
			const rules = createRule({ allow: ["@/api/**"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir, { pathsMapping });
			expect(result).toBeNull();
		});

		it("should match with @api/* alias pattern", () => {
			const importInfo = createInternalImport("./handler", "/project/src/api/routes/handler.ts");
			const rules = createRule({ allow: ["@api/**"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir, { pathsMapping });
			expect(result).toBeNull();
		});

		it("should NOT match when path is outside the alias scope", () => {
			const importInfo = createInternalImport("./helper", "/project/src/utils/helper.ts");
			const rules = createRule({ allow: ["@/api/**"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir, { pathsMapping });
			expect(result).not.toBeNull();
		});

		it("should work with multiple patterns", () => {
			const importInfo = createInternalImport("./handler", "/project/src/api/routes/handler.ts");
			const rules = createRule({ allow: ["@/shared/**", "@/api/**"] });
			const result = evaluateImportBoundary(importInfo, rules, rootDir, { pathsMapping });
			expect(result).toBeNull();
		});

		it("should match user's exact case: deep nested path in monorepo", () => {
			// Exact reproduction of user's error case
			// rootDir is packages/backend/src (where zonefence check ./src is run)
			const monorepoRootDir = "/project/packages/backend/src";
			// pathsMapping is adjusted: "@/*": ["./src/*"] becomes "@/*": ["./*"]
			// because tsconfig is in packages/backend and rootDir is packages/backend/src
			const adjustedPathsMapping = {
				"@/*": ["./*"],
			};
			const importInfo: ImportInfo = {
				moduleSpecifier: "./handler",
				sourceFile: "/project/packages/backend/src/api/routes/novel/public/novels/get/index.ts",
				resolvedPath: "/project/packages/backend/src/api/routes/novel/public/novels/get/handler.ts",
				isExternal: false,
				line: 1,
				column: 0,
			};
			const rules: ResolvedRule[] = [
				{
					directory: "/project/packages/backend/src/api",
					ruleFilePath: "/project/packages/backend/src/api/zonefence.yaml",
					excludePatterns: [],
					config: {
						version: 1,
						imports: {
							mode: "allow-first",
							allow: [{ from: "@/api/**" }],
						},
					},
				},
			];
			const result = evaluateImportBoundary(importInfo, rules, monorepoRootDir, {
				pathsMapping: adjustedPathsMapping,
			});
			expect(result).toBeNull();
		});
	});
});
