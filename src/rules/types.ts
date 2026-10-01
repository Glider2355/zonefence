export type ScopeApply = "self" | "descendants";
export type EvaluationMode = "allow-first" | "deny-first";
export type MergeStrategy = "merge" | "override";
/** Which import syntax a rule applies to. `any` (the default) matches both. */
export type ImportRuleKind = "type" | "value" | "any";

export interface ImportRule {
	from: string;
	message?: string;
	kind?: ImportRuleKind;
}

export interface ImportsConfig {
	allow?: ImportRule[];
	deny?: ImportRule[];
	mode?: EvaluationMode;
}

export interface FileRequireRule {
	/** Glob selecting the files that need a sibling */
	for: string;
	/** File name template of the required sibling, e.g. "{name}.stories.tsx" */
	sibling: string;
	/** Globs for files that are exempt from this requirement */
	exclude?: string[];
	message?: string;
}

export interface FilesConfig {
	require?: FileRequireRule[];
	/** When non-empty, only files matching one of these globs may exist */
	allow?: string[];
}

export interface PatternRuleConfig {
	description?: string;
	imports?: ImportsConfig;
	files?: FilesConfig;
	mergeStrategy?: MergeStrategy;
}

export interface DirectoryPatternRule {
	pattern: string;
	config: PatternRuleConfig;
	priority?: number;
}

export interface ZoneFenceConfig {
	version: number;
	description?: string;
	scope?: {
		apply?: ScopeApply;
		exclude?: string[];
	};
	imports?: ImportsConfig;
	files?: FilesConfig;
	directoryPatterns?: DirectoryPatternRule[];
}

export interface ResolvedRule {
	/** The directory path where this rule applies */
	directory: string;
	/** The path to the zonefence.yaml file that defined this rule */
	ruleFilePath: string;
	/** The resolved configuration (after inheritance) */
	config: ZoneFenceConfig;
	/** File patterns to exclude from checking */
	excludePatterns: string[];
	/** Pattern rules that were applied to this directory */
	appliedPatternRules?: {
		pattern: string;
		sourceFile: string;
		priority: number;
	}[];
}

export interface RulesByDirectory {
	[directory: string]: {
		config: ZoneFenceConfig;
		ruleFilePath: string;
	};
}
