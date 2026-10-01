export const REPORTER_NAMES = ["console", "json", "github"] as const;

export type ReporterName = (typeof REPORTER_NAMES)[number];

export function isReporterName(value: string): value is ReporterName {
	return (REPORTER_NAMES as readonly string[]).includes(value);
}

/** Reporters that emit machine-readable output must not be mixed with human logs. */
export function isMachineReadable(reporter: ReporterName): boolean {
	return reporter === "json" || reporter === "github";
}

export interface ReporterOptions {
	color?: boolean;
	verbose?: boolean;
}

export interface Reporter {
	report(result: import("../evaluator/types.js").EvaluationResult): number;
}
