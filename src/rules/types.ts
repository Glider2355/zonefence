export type ScopeApply = "self" | "descendants";
export type EvaluationMode = "allow-first" | "deny-first";

export interface ImportRule {
	from: string;
	message?: string;
}

export interface ZoneFenceConfig {
	version: number;
	description?: string;
	scope?: {
		apply?: ScopeApply;
		exclude?: string[];
	};
	imports?: {
		allow?: ImportRule[];
		deny?: ImportRule[];
		mode?: EvaluationMode;
	};
}

export interface ResolvedRule {
	/** The directory path where this rule applies */
	directory: string;
	/** The path to the .zonefence.yaml file that defined this rule */
	ruleFilePath: string;
	/** The resolved configuration (after inheritance) */
	config: ZoneFenceConfig;
	/** File patterns to exclude from checking */
	excludePatterns: string[];
}

export interface RulesByDirectory {
	[directory: string]: {
		config: ZoneFenceConfig;
		ruleFilePath: string;
	};
}
