import { describe, expect, it } from "bun:test";
import type { AssistantMessage } from "@openpaths/ai";
import { isContextOverflow } from "@openpaths/ai/error";

function createErrorMessage(errorMessage: string): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text: "" }],
		api: "anthropic-messages",
		provider: "anthropic",
		model: "claude-sonnet-4-5",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "error",
		errorMessage,
		timestamp: Date.now(),
	};
}

describe("context overflow evidence", () => {
	it("distinguishes transient errors from text-backed overflow when usage is missing", () => {
		const message: AIError.ContextOverflowMessage = {
			stopReason: "error",
			errorMessage: "503 service unavailable",
		};
		expect(isContextOverflow(message, 128000)).toBe(false);

		message.errorMessage = "maximum context length is 128000 tokens";
		expect(isContextOverflow(message, 128000)).toBe(true);
	});

	it("counts cached input and requires usage to exceed the context window", () => {
		const message: AIError.ContextOverflowMessage = {
			stopReason: "stop",
			usage: { input: 10, cacheRead: 50, cacheWrite: 40 },
		};
		expect(isContextOverflow(message, 100)).toBe(false);
		expect(isContextOverflow(message, 99)).toBe(true);
	});

	it("judges occupancy by contextTokens over per-turn input totals", () => {
		// Cursor grok-4.7-high turn: summed turn-end input far over the 256k
		// window, checkpoint context at ~20%.
		const usage = { input: 458_717, cacheRead: 404_992, cacheWrite: 0, contextTokens: 49_925 };
		expect(isContextOverflow({ stopReason: "stop", usage }, 256_000)).toBe(false);
		expect(isContextOverflow({ stopReason: "stop", usage: { ...usage, contextTokens: 256_001 } }, 256_000)).toBe(
			true,
		);
	});
});

describe("isContextOverflow - model_context_window_exceeded", () => {
	it("detects model_context_window_exceeded in finish_reason error message", () => {
		const message = createErrorMessage("Provider finish_reason: model_context_window_exceeded");
		expect(isContextOverflow(message)).toBe(true);
	});
	it("detects empty Ollama length completion guidance", () => {
		const message = createErrorMessage(
			"Model returned no content: prompt filled the context window; raise Ollama num_ctx or shorten the prompt.",
		);
		expect(isContextOverflow(message)).toBe(true);
	});
});

describe("isContextOverflow - HTTP 413 variants", () => {
	it("detects generic 413 payload-too-large errors", () => {
		const message = createErrorMessage("413 Request Entity Too Large: payload too large for request body");
		expect(isContextOverflow(message)).toBe(true);
	});

	it("detects Anthropic request size overflow wording", () => {
		const message = createErrorMessage("Request exceeds the maximum size allowed by this model");
		expect(isContextOverflow(message)).toBe(true);
	});

	it("does not classify unrelated 413 errors as overflow", () => {
		const message = createErrorMessage("413 Forbidden");
		expect(isContextOverflow(message)).toBe(false);
	});
});

describe("isContextOverflow - 400/413 no-body (Cerebras, Mistral, proxy wrappers)", () => {
	it("detects '400 (no body)' without 'status code' word", () => {
		expect(isContextOverflow(createErrorMessage("400 (no body)"))).toBe(true);
	});

	// Regression: api.synthetic.new wraps upstream HF 400-no-body in a JSON envelope.
	// finalizeErrorMessage transforms the response to "400 status code: {JSON}" where
	// the JSON value contains the inner "400 status code (no body)" text.
	it('detects wrapped proxy envelope: \'400 status code: {"error":"... 400 status code (no body)"}\'', () => {
		const errorMessage = '400 status code: {"error":"Error from inference backend: 400 status code (no body)"}';
		expect(isContextOverflow(createErrorMessage(errorMessage))).toBe(true);
	});

	it("does not classify unrelated 400 errors as overflow", () => {
		expect(isContextOverflow(createErrorMessage("400 Bad Request: invalid API key"))).toBe(false);
	});

	it("does not classify 429 (rate limit) as overflow", () => {
		expect(isContextOverflow(createErrorMessage("429 status code (no body)"))).toBe(false);
	});
});
