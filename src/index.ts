export { checkProject } from "./core/project.js";
export { collectImports, collectImportsWithDiagnostics } from "./core/import-collector.js";
export { collectFiles } from "./core/file-collector.js";
export { loadRules, loadRulesForDirectoryWithAllDirs } from "./rules/loader.js";
export { resolveRules, resolveRulesWithPatterns } from "./rules/resolver.js";
export { evaluate } from "./evaluator/index.js";
export { generateDocs } from "./docs/markdown.js";
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

export type {
	ImportInfo,
	ImportKind,
	ProjectOptions,
	UnanalyzableImport,
} from "./core/types.js";
export type {
	ZoneFenceConfig,
	ImportRule,
	ImportRuleKind,
	FileAllowRule,
	FilesConfig,
	FileRequireRule,
	DirectoryPatternRule,
	PatternRuleConfig,
} from "./rules/types.js";
export type { EvaluationResult, Severity, Violation, ViolationRule } from "./evaluator/types.js";
export type { DocsLanguage, DocsOptions } from "./docs/markdown.js";
export type { JsonReport, JsonViolation, ReporterName } from "./reporter/index.js";
