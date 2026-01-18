export interface Violation {
	/** The file containing the violation */
	sourceFile: string;
	/** The import module specifier that caused the violation */
	moduleSpecifier: string;
	/** Line number of the violation */
	line: number;
	/** Column number of the violation */
	column: number;
	/** The rule that was violated */
	rule: "import-boundary";
	/** Error message */
	message: string;
	/** Path to the rule file that defined this rule */
	ruleFilePath: string;
	/** Optional design intent from the rule description */
	designIntent?: string;
	/** Optional fix suggestion */
	suggestion?: string;
}

export interface EvaluationResult {
	/** List of violations found */
	violations: Violation[];
	/** Number of files checked */
	filesChecked: number;
	/** Number of imports checked */
	importsChecked: number;
}
