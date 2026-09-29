import { createApiKeyLogin } from "./api-key-login";
import type { OAuthLoginCallbacks } from "./oauth/types";
import type { ProviderDefinition } from "./types";

export const loginRunAnywhere = createApiKeyLogin({
	providerLabel: "RunAnywhere (Wally Cloud)",
	authUrl: "https://console.runanywhere.ai",
	instructions: "Create a Cloud key on the RunAnywhere console's Cloud keys page",
	promptMessage: "Paste your RunAnywhere Cloud key",
	placeholder: "sk-runa-...",
	validation: {
		kind: "models-endpoint",
		provider: "RunAnywhere (Wally Cloud)",
		modelsUrl: "https://inference.runanywhere.ai/v1/models",
	},
});

export const runanywhereProvider = {
	id: "runanywhere",
	name: "RunAnywhere (Wally Cloud)",
	login: (cb: OAuthLoginCallbacks) => loginRunAnywhere(cb),
} as const satisfies ProviderDefinition;
