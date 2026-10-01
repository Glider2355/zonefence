export type ScopeApply = "self" | "descendants";
export type EvaluationMode = "allow-first" | "deny-first";
export type MergeStrategy = "merge" | "override";
/** Which import syntax a rule applies to. `any` (the default) matches both. */
export type ImportRuleKind = "type" | "value" | "any";

export interface ImportRule {
	from: string;
	message?: string;
	kind?: ImportRuleKind;
	/**
	 * Directory a relative `from` is resolved against. Set by the resolver on rules
	 * inherited from a parent directory, so that they keep pointing at the same
	 * place; otherwise the directory the rule applies to is used.
	 */
	baseDir?: string;
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
	/**
	 * Directory `for` and `exclude` are relative to. Set by the resolver on rules
	 * inherited from a parent directory; otherwise the directory the rule applies to.
	 */
	baseDir?: string;
}

/**
 * A `files.allow` glob. Written as a plain string; the resolver turns a pattern
 * inherited from a parent directory into the object form to record the directory
 * it is relative to.
 */
export type FileAllowRule = string | { pattern: string; baseDir: string };

export interface FilesConfig {
	require?: FileRequireRule[];
	/** When non-empty, only files matching one of these globs may exist */
	allow?: FileAllowRule[];
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
