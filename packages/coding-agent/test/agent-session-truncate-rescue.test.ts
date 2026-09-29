import { afterEach, describe, expect, it, vi } from "bun:test";
import * as path from "node:path";
import { Agent, type AgentTool } from "@openpaths/agent-core";
import { createMockModel, type MockResponse } from "@openpaths/ai/providers/mock";
import { ModelRegistry } from "@openpaths/coding-agent/config/model-registry";
import { Settings } from "@openpaths/coding-agent/config/settings";
import { AgentSession } from "@openpaths/coding-agent/session/agent-session";
import { AuthStorage } from "@openpaths/coding-agent/session/auth-storage";
import { convertToLlm } from "@openpaths/coding-agent/session/messages";
import { SessionManager } from "@openpaths/coding-agent/session/session-manager";
import { type } from "@openpaths/optype";
import { TempDir } from "@openpaths/utils";

const DEAD_END_WARNING = "Compaction freed too little context to make progress";

const noopSchema = type({});
const noopTool: AgentTool<typeof noopSchema, undefined> = {
	label: "No-op",
	name: "noop",
	description: "noop",
	parameters: noopSchema,
	execute: async () => ({ content: [{ type: "text", text: "noop" }], metadata: undefined }),
};
/** Unfenced log paste sized to ~`approxTokens` real tokens — no fence/XML shape for elide to grab. */
function giantPaste(approxTokens: number): string {
	const lines: string[] = [];
	let chars = 0;
	for (let i = 0; chars < approxTokens * 4; i++) {
		const line = `log line ${i}: event ${i.toString(36)}-${((i * 2654435761) >>> 0).toString(16)}`;
		lines.push(line);
		chars += line.length + 1;
	}
	return lines.join("\n");
}

describe("AgentSession dead-end truncate rescue", () => {
	let tempDir: TempDir;
	let authStorage: AuthStorage;
	let session: AgentSession;

	afterEach(async () => {
		await session?.dispose();
		authStorage?.close();
		await tempDir?.remove();
		vi.restoreAllMocks();
	});

	async function createSession(options: { responses: MockResponse[] }): Promise<{
		notices: string[];
		compactionStarts: number[];
		shakeCalls: string[];
	}> {
		const notices: string[] = [];
		const compactionStarts: number[] = [];
		tempDir = TempDir.createSync("op-dead-end-truncate-rescue");
		authStorage = await AuthStorage.create(path.join(tempDir.path(), "auth.db"));
		authStorage.setRuntimeApiKey("mock", "test-key");
		const modelRegistry = new ModelRegistry(authStorage, path.join(tempDir.path(), "models.yml"));
		const mock = createMockModel({ responses: options.responses });
		vi.spyOn(modelRegistry, "getAvailable").mockReturnValue([mock]);

		const sessionManager = SessionManager.inMemory(tempDir.path());
		const settings = Settings.isolated({
			"compaction.strategy": "context-full",
			"compaction.thresholdTokens": 100_000,
			"compaction.midTurnEnabled": true,
			"compaction.autoContinue": false,
			"retry.enabled": false,
			"todo.enabled": false,
		});
		const agent = new Agent({
			getApiKey: () => "test-key",
			initialState: { model: mock, systemPrompt: ["Test"], tools: [noopTool], messages: [] },
			convertToLlm,
			streamFn: mock.stream,
		});
		session = new AgentSession({
			agent,
			sessionManager,
			settings,
			modelRegistry,
			toolRegistry: new Map([[noopTool.name, noopTool]]),
		});
		session.subscribe(event => {
			if (event.type === "notice") notices.push(event.message);
			else if (event.type === "auto_compaction_start") compactionStarts.push(1);
		});
		const shakeCalls: string[] = [];
		const realShake = session.shake.bind(session);
		session.shake = async (mode, opts) => {
			const r = await realShake(mode, opts);
			shakeCalls.push(`${mode}:${r.toolResultsDropped + r.blocksDropped}:${r.tokensFreed}`);
			return r;
		};
		return { notices, compactionStarts, shakeCalls };
	}

	it("recovers a single oversized-turn dead end via middle-out truncation instead of pausing", async () => {
		const state = await createSession({ responses: [{ content: ["done"] }] });

		// One turn whose entire bulk is an unfenced user paste: elide finds no
		// fenced/XML block and no tool result, so the pre-truncate behavior
		// dead-ends instead of shrinking it.
		await session.prompt(giantPaste(120_000));
		await session.waitForIdle();

		const notices = state.notices.join("\n");
		expect(notices).not.toContain(DEAD_END_WARNING);
		expect(notices).toContain("middle-out truncated");
		expect(state.shakeCalls.some(call => call.startsWith("truncate:1:"))).toBe(true);

		// The persisted turn keeps head + tail around an explicit marker.
		const userEntry = session.sessionManager
			.getBranch()
			.find(entry => entry.type === "message" && entry.message.role === "user");
		if (userEntry?.type !== "message") throw new Error("Expected a persisted user entry");
		const message: unknown = userEntry.message;
		if (!(typeof message === "object" && message !== null && "content" in message)) {
			throw new Error("Expected user message content");
		}
		const rawContent: unknown = message.content;
		const blocks: Array<{ type: string; text?: string }> = Array.isArray(rawContent)
			? rawContent
			: [{ type: "text", text: String(rawContent) }];
		const text = blocks.map(block => block.text ?? "").join("\n");
		expect(text.length).toBeLessThan(20_000);
		expect(text).toContain("middle-out truncated");
		expect(text.startsWith("log line 0:")).toBe(true);
		expect(text.trimEnd().endsWith("log line 14096: event avk-ce9ca210")).toBe(true);
	});
});
