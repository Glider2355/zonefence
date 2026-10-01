export { checkProject } from "./core/project.js";
export { collectImports } from "./core/import-collector.js";
export { loadRules, loadRulesForDirectoryWithAllDirs } from "./rules/loader.js";
export { resolveRules, resolveRulesWithPatterns } from "./rules/resolver.js";
export { evaluate } from "./evaluator/index.js";
export {
	reportToConsole,
	reportToJson,
	reportToGithub,
	buildJsonReport,
	formatGithubAnnotation,
	REPORTER_NAMES,
	isReporterName,
} from "./reporter/index.js";
export {
	matchDirectoryPattern,
	findMatchingPatterns,
	collectPatternSources,
} from "./rules/pattern-matcher.js";

export type { ImportInfo, ProjectOptions } from "./core/types.js";
export type {
	ZoneFenceConfig,
	ImportRule,
	DirectoryPatternRule,
	PatternRuleConfig,
} from "./rules/types.js";
export type { EvaluationResult, Violation } from "./evaluator/types.js";
export type { JsonReport, JsonViolation, ReporterName } from "./reporter/index.js";
