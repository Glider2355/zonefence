export { checkProject } from "./core/project.js";
export { collectImports } from "./core/import-collector.js";
export { loadRules } from "./rules/loader.js";
export { resolveRules } from "./rules/resolver.js";
export { evaluate } from "./evaluator/index.js";

export type { ImportInfo, ProjectOptions } from "./core/types.js";
export type { ZoneFenceConfig, ImportRule } from "./rules/types.js";
export type { EvaluationResult, Violation } from "./evaluator/types.js";
