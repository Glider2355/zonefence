import { z } from "zod";
import type { ImportRule } from "./types.js";

/**
 * A single allow/deny entry.
 *
 * `reason` is accepted as an alias of `message` for backwards compatibility with
 * configs written against earlier documentation. Unknown keys are rejected so
 * that typos surface as validation errors instead of being silently dropped.
 */
const importRuleObjectSchema = z
	.object({
		from: z.string(),
		message: z.string().optional(),
		reason: z.string().optional(),
	})
	.strict()
	.transform(({ from, message, reason }): ImportRule => {
		const resolvedMessage = message ?? reason;
		return resolvedMessage === undefined ? { from } : { from, message: resolvedMessage };
	});

const importRuleSchema = z.union([
	z.string().transform((from): ImportRule => ({ from })),
	importRuleObjectSchema,
]);

const importsSchema = z
	.object({
		allow: z.array(importRuleSchema).optional().default([]),
		deny: z.array(importRuleSchema).optional().default([]),
		mode: z.enum(["allow-first", "deny-first"]).optional().default("allow-first"),
	})
	.strict();

const patternRuleConfigSchema = z
	.object({
		description: z.string().optional(),
		imports: importsSchema.optional(),
		mergeStrategy: z.enum(["merge", "override"]).optional().default("merge"),
	})
	.strict();

const directoryPatternRuleSchema = z
	.object({
		pattern: z.string(),
		config: patternRuleConfigSchema,
		priority: z.number().int().optional().default(0),
	})
	.strict();

export const zoneFenceConfigSchema = z
	.object({
		version: z.number().int().positive(),
		description: z.string().optional(),
		scope: z
			.object({
				apply: z.enum(["self", "descendants"]).optional().default("descendants"),
				exclude: z.array(z.string()).optional().default([]),
			})
			.strict()
			.optional()
			.default({}),
		imports: importsSchema.optional().default({}),
		directoryPatterns: z.array(directoryPatternRuleSchema).optional().default([]),
	})
	.strict();

export type ParsedZoneFenceConfig = z.infer<typeof zoneFenceConfigSchema>;

export function parseConfig(data: unknown): ParsedZoneFenceConfig {
	return zoneFenceConfigSchema.parse(data);
}

export function validateConfig(
	data: unknown,
): { success: true; data: ParsedZoneFenceConfig } | { success: false; error: z.ZodError } {
	const result = zoneFenceConfigSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, error: result.error };
}
