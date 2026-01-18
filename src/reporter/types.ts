export interface ReporterOptions {
	color?: boolean;
	verbose?: boolean;
}

export interface Reporter {
	report(result: import("../evaluator/types.js").EvaluationResult): number;
}
