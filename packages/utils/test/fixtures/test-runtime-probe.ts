import { isBunTestRuntime } from "@openpaths/utils/env";

process.stdout.write(JSON.stringify(isBunTestRuntime()));
