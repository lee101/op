import { afterEach, describe, expect, it, vi } from "bun:test";
import { type } from "@openpaths/optype";
import type * as TypeBox from "@openpaths/optype/typebox";
import * as zod from "@openpaths/optype/zod";
import * as piCodingAgent from "@openpaths/coding-agent";
import { GreenCommand } from "@openpaths/coding-agent/extensibility/custom-commands/bundled/ci-green";
import type { CustomCommandAPI } from "@openpaths/coding-agent/extensibility/custom-commands/types";
import type { HookCommandContext } from "@openpaths/coding-agent/extensibility/hooks/types";
import type { VcsGitRepo } from "@openpaths/natives";
import * as vcs from "@openpaths/natives/vcs";

afterEach(() => {
	vi.restoreAllMocks();
});

function createApi(): CustomCommandAPI {
	return {
		cwd: "/tmp/test",
		exec: async () => ({
			stdout: "",
			stderr: "",
			code: 0,
			killed: false,
		}),
		typebox: {} as unknown as typeof TypeBox,
		arktype: Object.assign(Function.prototype.bind.call(type, undefined) as typeof type, type, { type }),
		zod,
		pi: piCodingAgent,
	};
}

describe("GreenCommand", () => {
	it("includes tag instructions when HEAD has a tag", async () => {
		vi.spyOn(vcs, "requireGit").mockReturnValue({
			tagsAt: async () => ["v0.1.0-alpha2"],
		} as unknown as VcsGitRepo);
		const command = new GreenCommand(createApi());

		const result = await command.execute([], {} as HookCommandContext);

		expect(result).toContain("v0.1.0-alpha2");
	});
});
