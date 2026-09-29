import { describe, expect, test } from "bun:test";
import { Effort } from "@openpaths/catalog/effort";
import { getBundledModel } from "@openpaths/catalog/models";
import { CATALOG_PROVIDERS } from "@openpaths/catalog/provider-models/descriptors";
import { RUNANYWHERE_STATIC_MODELS } from "@openpaths/catalog/provider-models/openai-compat";

describe("RunAnywhere provider", () => {
	test("static seed covers the descriptor's default model", () => {
		// Regression for the empty-slice bug: without this seed a regen run
		// without a RUNANYWHERE_API_KEY bundles no runanywhere models, and the
		// declared defaultModel is unresolvable at boot before async discovery.
		const descriptor = CATALOG_PROVIDERS.find(provider => provider.id === "runanywhere");
		expect(descriptor).toMatchObject({
			defaultModel: "glm-5.3-flash",
			envVars: ["RUNANYWHERE_API_KEY"],
		});
		expect(RUNANYWHERE_STATIC_MODELS.map(model => model.id)).toEqual(["glm-5.3-flash", "qwen3.8-27b"]);
	});

	test("both hosted lanes bundle Wally Cloud's own rates and effort ladder", () => {
		const flash = getBundledModel("runanywhere", "glm-5.3-flash");
		expect(flash.cost).toEqual({ input: 0.1, output: 0.35, cacheRead: 0, cacheWrite: 0 });
		expect(flash.contextWindow).toBe(1048567);
		expect(flash.maxTokens).toBe(131072);
		// Wally 400s on `max`/`minimal` ("Supported types are xhigh (default),
		// medium, and low"), so the ladder is exactly those three tiers.
		expect(flash.thinking?.efforts).toEqual([Effort.Low, Effort.Medium, Effort.XHigh]);
		expect(flash.thinking?.defaultLevel).toBe(Effort.XHigh);

		const qwen = getBundledModel("runanywhere", "qwen3.8-27b");
		expect(qwen.cost).toEqual({ input: 0.2, output: 2.5, cacheRead: 0, cacheWrite: 0 });
		expect(qwen.contextWindow).toBe(262137);
		expect(qwen.maxTokens).toBe(40960);
		expect(qwen.thinking?.efforts).toEqual([Effort.Low, Effort.Medium, Effort.XHigh]);
	});
});
