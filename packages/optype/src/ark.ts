/**
 * ArkType compatibility facade — `@openpaths/optype/ark`.
 *
 * Lets code written against arktype keep its imports and names while running
 * on the optype lazy-JIT runtime: swap `from "arktype"` for
 * `from "@openpaths/optype/ark"` and nothing else changes. New code should
 * import `@openpaths/optype` directly.
 *
 * Compatibility affordance: `ArkError` / `ArkErrors` alias `OpError` /
 * `OpErrors`. All schema builders, including recursive `scope()`, are
 * re-exported unchanged.
 */
import { OpError, OpErrors } from "./errors";

export * from "./index";

export const ArkError = OpError;
export type ArkError = OpError;
export const ArkErrors = OpErrors;
export type ArkErrors = OpErrors;
