import { describe, expect, test } from "bun:test";
import { providerEntry, seedModels } from "@openpaths/catalog/compat/providers";
import { Effort } from "@openpaths/catalog/effort";
import { DEFAULT_MODEL_PER_PROVIDER } from "@openpaths/catalog/provider-models/descriptors";

/**
 * RunAnywhere (Wally Cloud) metadata is authored in
 * `src/compat/rules/providers/runanywhere.kdl` and compiled into `rules.json`,
 * so these assertions read the compiled provider entry and its seed rows rather
 * than the generated `models.json` bundle (which is produced by a credentialed
 * catalog run) or the per-provider TypeScript tables upstream replaced.
 */
describe("RunAnywhere provider", () => {
	test("seed covers the provider default model", () => {
		// Regression for the empty-slice bug: without this seed a regen without a
		// RUNANYWHERE_API_KEY bundles no runanywhere models, and the declared
		// default model is unresolvable at boot before async discovery.
		const entry = providerEntry("runanywhere");
		expect(entry).toBeDefined();
		expect(entry?.defaultModel).toBe("glm-5.3-flash");
		expect(entry?.envVars).toEqual(["RUNANYWHERE_API_KEY"]);
		expect(DEFAULT_MODEL_PER_PROVIDER.runanywhere).toBe("glm-5.3-flash");

		const seedIds = seedModels("runanywhere").map(model => model.id);
		expect(seedIds).toEqual(["glm-5.3-flash", "qwen3.8-27b"]);
		// The declared default must actually resolve against the seed rows.
		expect(seedIds).toContain(entry?.defaultModel);
	});

	test("carries no catalog discovery, so a discovered row can never fake a $0 rate", () => {
		// Wally bills against prepaid credits but its `/v1/models` answer carries
		// no rates. The descriptor deliberately omits `discovery`.
		expect(providerEntry("runanywhere")?.discovery).toBeUndefined();
	});

	test("both hosted lanes bundle Wally Cloud's own rates and effort ladder", () => {
		const flash = seedModels("runanywhere").find(model => model.id === "glm-5.3-flash");
		expect(flash?.cost).toEqual({ input: 0.1, output: 0.35, cacheRead: 0, cacheWrite: 0 });
		expect(flash?.contextWindow).toBe(1048567);
		expect(flash?.maxTokens).toBe(131072);
		expect(flash?.baseUrl).toBe("https://inference.runanywhere.ai/v1");
		// Wally 400s on `max`/`minimal` ("Supported types are xhigh (default),
		// medium, and low"), so the ladder is exactly those three tiers.
		expect(flash?.thinking?.efforts).toEqual([Effort.Low, Effort.Medium, Effort.XHigh]);
		expect(flash?.thinking?.defaultLevel).toBe(Effort.XHigh);

		const qwen = seedModels("runanywhere").find(model => model.id === "qwen3.8-27b");
		expect(qwen?.cost).toEqual({ input: 0.2, output: 2.5, cacheRead: 0, cacheWrite: 0 });
		expect(qwen?.contextWindow).toBe(262137);
		expect(qwen?.maxTokens).toBe(40960);
		expect(qwen?.baseUrl).toBe("https://inference.runanywhere.ai/v1");
		expect(qwen?.thinking?.efforts).toEqual([Effort.Low, Effort.Medium, Effort.XHigh]);
		expect(qwen?.thinking?.defaultLevel).toBe(Effort.XHigh);
	});
});
