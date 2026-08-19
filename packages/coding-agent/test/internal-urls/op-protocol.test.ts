import { describe, expect, it } from "bun:test";
import { InternalUrlRouter } from "@openpaths/coding-agent/internal-urls";

describe("OpProtocolHandler", () => {
	it("treats op://docs as the documentation root", async () => {
		const resource = await InternalUrlRouter.instance().resolve("op://docs");

		expect(resource.content).toContain("# Documentation");
		expect(resource.content).toContain("tools/read.md");
	});

	it("resolves docs-prefixed documentation paths", async () => {
		const router = InternalUrlRouter.instance();
		const direct = await router.resolve("op://tools/read.md");
		const prefixed = await router.resolve("op://docs/tools/read.md");

		expect(prefixed.content).toBe(direct.content);
		expect(prefixed.content).toContain("# read");
	});
});
