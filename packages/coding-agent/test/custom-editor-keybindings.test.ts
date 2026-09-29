import { beforeAll, describe, expect, it, vi } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { KeybindingsManager } from "@openpaths/coding-agent/config/keybindings";
import { CustomEditor } from "@openpaths/coding-agent/modes/components/custom-editor";
import { getEditorTheme, initTheme } from "@openpaths/coding-agent/modes/theme/theme";
import { CombinedAutocompleteProvider } from "@openpaths/tui";

describe("CustomEditor keybindings", () => {
	beforeAll(async () => {
		await initTheme();
	});

	it("routes the configured retry chord through handleInput", () => {
		const editor = new CustomEditor(getEditorTheme());
		const onRetry = vi.fn();

		editor.setActionKeys("app.retry", ["alt+shift+r"]);
		editor.onRetry = onRetry;
		editor.handleInput("\x1bR");

		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("routes the configured tool activity visibility chord through handleInput", () => {
		const editor = new CustomEditor(getEditorTheme());
		const onToggleToolActivity = vi.fn();

		editor.setActionKeys("app.tools.toggleVisibility", ["alt+h"]);
		editor.onToggleToolActivity = onToggleToolActivity;
		editor.handleInput("\x1bh");

		expect(onToggleToolActivity).toHaveBeenCalledTimes(1);
	});

	it("lets custom handlers keep precedence over the default retry chord", () => {
		const editor = new CustomEditor(getEditorTheme());
		const onRetry = vi.fn();
		const customHandler = vi.fn();

		editor.onRetry = onRetry;
		editor.setCustomKeyHandler("alt+r", customHandler);
		editor.handleInput("\x1br");

		expect(customHandler).toHaveBeenCalledTimes(1);
		expect(onRetry).not.toHaveBeenCalled();
	});

	it("lets copy-prompt remaps keep precedence over the default retry chord", () => {
		const editor = new CustomEditor(getEditorTheme());
		const onRetry = vi.fn();
		const onCopyPrompt = vi.fn();

		editor.onRetry = onRetry;
		editor.onCopyPrompt = onCopyPrompt;
		editor.setActionKeys("app.clipboard.copyPrompt", ["alt+r"]);
		editor.handleInput("\x1br");

		expect(onCopyPrompt).toHaveBeenCalledTimes(1);
		expect(onRetry).not.toHaveBeenCalled();
	});

	it("routes Ctrl+L to a live-toggle custom handler and Alt+L to display reset by default", () => {
		const editor = new CustomEditor(getEditorTheme());
		const onDisplayReset = vi.fn();
		const onLiveToggle = vi.fn();

		editor.onDisplayReset = onDisplayReset;
		editor.setCustomKeyHandler("ctrl+l", onLiveToggle);

		editor.handleInput("\x0c"); // Ctrl+L
		expect(onLiveToggle).toHaveBeenCalledTimes(1);
		expect(onDisplayReset).not.toHaveBeenCalled();

		editor.handleInput("\x1bl"); // Alt+L
		expect(onDisplayReset).toHaveBeenCalledTimes(1);
		expect(onLiveToggle).toHaveBeenCalledTimes(1);
	});
});

describe("Tab follow-up chord", () => {
	beforeAll(async () => {
		await initTheme();
	});

	it("fires the follow-up custom handler on Tab when no autocomplete is open", () => {
		const editor = new CustomEditor(getEditorTheme());
		const queue = vi.fn();

		editor.setCustomKeyHandler("tab", queue);
		editor.setText("ship it");
		editor.handleInput("\t");

		expect(queue).toHaveBeenCalledTimes(1);
	});

	it("keeps Tab applying an open autocomplete instead of queueing", async () => {
		const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), "op-tab-queue-"));
		try {
			fs.writeFileSync(path.join(baseDir, "model.txt"), "x");
			const editor = new CustomEditor(getEditorTheme());
			editor.setAutocompleteProvider(
				new CombinedAutocompleteProvider([{ name: "model", description: "Switch model" }], baseDir),
			);
			const queue = vi.fn();
			editor.setCustomKeyHandler("tab", queue);
			// Type a leading slash command; the popup auto-opens after the editor's
			// debounced refresh — await the real onAutocompleteUpdate event.
			const opened = Promise.withResolvers<void>();
			editor.onAutocompleteUpdate = () => opened.resolve();
			for (const char of "/mod") editor.handleInput(char);
			await opened.promise;
			expect(editor.isShowingAutocomplete()).toBe(true);

			editor.handleInput("\t");

			expect(editor.getText()).toBe("/model ");
			expect(editor.isShowingAutocomplete()).toBe(false);
			expect(queue).not.toHaveBeenCalled();
		} finally {
			fs.rmSync(baseDir, { recursive: true, force: true });
		}
	});
});

describe("shipped dequeue defaults", () => {
	it("binds both alt+up and shift+up to the steering dequeue", () => {
		const keybindings = KeybindingsManager.inMemory();
		const keys = keybindings.getKeys("app.message.dequeue");
		expect(keys).toContain("alt+up");
		expect(keys).toContain("shift+up");
	});
	it("does not steal shift+up from an explicit user binding", () => {
		const keybindings = KeybindingsManager.inMemory({
			"tui.editor.cursorUp": "shift+up",
		});

		expect(keybindings.getKeys("app.message.dequeue")).toEqual(["alt+up"]);
		expect(keybindings.getKeys("tui.editor.cursorUp")).toEqual(["shift+up"]);
	});
	it("routes the shipped shift+up default through DEFAULT_ACTION_KEYS to the dequeue handler", () => {
		// F12: the registry test above does not cover DEFAULT_ACTION_KEYS, the second
		// defaults table that custom-editor.ts seeds its match set from. Drive a real
		// editor without calling setActionKeys, so the shipped entry is the only thing
		// that can make the shift+up wire form (CSI 1;2A) reach onDequeue.
		const editor = new CustomEditor(getEditorTheme());
		const onDequeue = vi.fn();

		editor.onDequeue = onDequeue;
		editor.handleInput("\x1b[1;2A");

		expect(onDequeue).toHaveBeenCalledTimes(1);
	});
});
