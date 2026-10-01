import { expect, test } from "bun:test";
import { PROVIDER_DESCRIPTORS, resolveModelCacheProviderId } from "@openpaths/catalog/provider-models";

test("lightweight cache resolver matches every descriptor default", () => {
	for (const descriptor of PROVIDER_DESCRIPTORS) {
		const options = descriptor.createModelManagerOptions({});
		expect(resolveModelCacheProviderId(descriptor.providerId)).toBe(options.cacheProviderId ?? descriptor.providerId);
	}
});

test("lightweight cache resolver matches scoped descriptor inputs", () => {
	const cases = [
		{ providerId: "litellm", baseUrl: "http://litellm.example:4100/v1" },
		{ providerId: "ollama", baseUrl: "http://ollama.example:11434/v1/" },
		{ providerId: "opencode-go", baseUrl: "https://opencode.example/go" },
		{ providerId: "opencode-zen", baseUrl: "https://opencode.example/zen/v1/" },
		{ providerId: "vllm", baseUrl: "http://vllm.example:8000/v1" },
	] as const;
	for (const { providerId, baseUrl } of cases) {
		const descriptor = PROVIDER_DESCRIPTORS.find(candidate => candidate.providerId === providerId);
		if (!descriptor) throw new Error(`Missing descriptor for ${providerId}`);
		const config = { apiKey: "cache-test-key", baseUrl };
		const options = descriptor.createModelManagerOptions(config);
		expect(resolveModelCacheProviderId(providerId, config)).toBe(options.cacheProviderId ?? providerId);
	}
});

test("ollama cache scope preserves reverse-proxy path prefixes", () => {
	const teamA = resolveModelCacheProviderId("ollama", { baseUrl: "https://proxy.example/team-a/v1/" });
	expect(teamA).toBe(resolveModelCacheProviderId("ollama", { baseUrl: "https://proxy.example/team-a" }));
	expect(teamA).toBe(resolveModelCacheProviderId("ollama", { baseUrl: "https://proxy.example/team-a/" }));
	expect(teamA).not.toBe(resolveModelCacheProviderId("ollama", { baseUrl: "https://proxy.example/team-b/v1" }));
});

test("cursor cache scope isolates account catalogs without exposing credentials", () => {
	const accountA = resolveModelCacheProviderId("cursor", {
		apiKey: "cursor-account-a",
		baseUrl: "https://api2.cursor.sh/",
	});
	expect(accountA).toBe(
		resolveModelCacheProviderId("cursor", {
			apiKey: "cursor-account-a",
			baseUrl: "https://api2.cursor.sh",
		}),
	);
	expect(accountA).not.toBe(
		resolveModelCacheProviderId("cursor", {
			apiKey: "cursor-account-b",
			baseUrl: "https://api2.cursor.sh",
		}),
	);
	expect(accountA).not.toBe(
		resolveModelCacheProviderId("cursor", {
			apiKey: "cursor-account-a",
			baseUrl: "https://cursor-proxy.example",
		}),
	);
	expect(accountA).not.toContain("cursor-account-a");
	expect(accountA).not.toContain("api2.cursor.sh");
});

test("cursor cache scope survives access-token refresh for the same account", () => {
	const jwt = (claims: Record<string, unknown>): string =>
		`${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;
	const scope = (apiKey: string): string =>
		resolveModelCacheProviderId("cursor", { apiKey, baseUrl: "https://api2.cursor.sh" });
	const before = scope(jwt({ sub: "auth0|user_a", exp: 1_900_000_000, iat: 1_800_000_000 }));
	expect(scope(jwt({ sub: "auth0|user_a", exp: 1_900_086_400, iat: 1_800_086_400 }))).toBe(before);
	expect(scope(jwt({ sub: "auth0|user_b", exp: 1_900_000_000, iat: 1_800_000_000 }))).not.toBe(before);
});
