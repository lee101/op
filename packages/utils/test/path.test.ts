import { describe, expect, it } from "bun:test";
import { isFullyQualifiedPath, stripWindowsExtendedLengthPathPrefix, windowsPathToWslMount } from "../src/path";

describe("stripWindowsExtendedLengthPathPrefix", () => {
	it("removes drive and UNC extended-length prefixes on Windows", () => {
		expect(stripWindowsExtendedLengthPathPrefix("\\\\?\\C:\\Users\\Shi Xin\\op.exe", "win32")).toBe(
			"C:\\Users\\Shi Xin\\op.exe",
		);
		expect(stripWindowsExtendedLengthPathPrefix("\\\\?\\UNC\\server\\share\\op.exe", "win32")).toBe(
			"\\\\server\\share\\op.exe",
		);
	});

	it("leaves non-Windows paths unchanged", () => {
		const path = "\\\\?\\C:\\Users\\Shi Xin\\op.exe";
		expect(stripWindowsExtendedLengthPathPrefix(path, "linux")).toBe(path);
	});
});

describe("windowsPathToWslMount", () => {
	it("clamps parent traversal at the Windows drive root", () => {
		expect(windowsPathToWslMount("C:\\..\\Windows\\x")).toBe("/mnt/c/Windows/x");
	});

	it("rejects paths without an absolute Windows drive", () => {
		expect(windowsPathToWslMount("/home/me/file.txt")).toBeUndefined();
	});
});

describe("isFullyQualifiedPath", () => {
	it("identifies fully qualified Windows paths across platforms", () => {
		expect(isFullyQualifiedPath("C:\\op\\bin\\op.exe", "win32")).toBe(true);
		expect(isFullyQualifiedPath("c:/op/bin/op.exe", "win32")).toBe(true);
		expect(isFullyQualifiedPath("\\\\server\\share\\op.exe", "win32")).toBe(true);
		expect(isFullyQualifiedPath("//server/share/op.exe", "win32")).toBe(true);
		expect(isFullyQualifiedPath("C:op", "win32")).toBe(false);
		expect(isFullyQualifiedPath(".\\op", "win32")).toBe(false);
		expect(isFullyQualifiedPath("\\bin\\op", "win32")).toBe(false);
		expect(isFullyQualifiedPath("/bin/op", "win32")).toBe(false);
		expect(isFullyQualifiedPath("//", "win32")).toBe(false);
		expect(isFullyQualifiedPath("\\\\", "win32")).toBe(false);
	});

	it("identifies absolute POSIX paths", () => {
		expect(isFullyQualifiedPath("/usr/local/bin/op", "darwin")).toBe(true);
		expect(isFullyQualifiedPath("/usr/local/bin/op", "linux")).toBe(true);
		expect(isFullyQualifiedPath("./op", "darwin")).toBe(false);
		expect(isFullyQualifiedPath("op", "linux")).toBe(false);
	});
});
