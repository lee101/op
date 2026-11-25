import { getOAuthProviders as rootGetOAuthProviders, refreshOAuthToken as rootRefreshOAuthToken } from "@openpaths/ai";
import {
	getOAuthProviders as oauthGetOAuthProviders,
	refreshOAuthToken as oauthRefreshOAuthToken,
} from "@openpaths/ai/registry/oauth";
import "@openpaths/ai/providers/anthropic";
import "@openpaths/ai/auth-storage";

const publicExports = [rootGetOAuthProviders, rootRefreshOAuthToken, oauthGetOAuthProviders, oauthRefreshOAuthToken];

if (publicExports.some(value => !value)) {
	throw new Error("OAuth registry exports are unavailable");
}
