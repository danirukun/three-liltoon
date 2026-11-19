import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as api from "../../src/webgpu";

const sourceFiles = (path: string): string[] => {
	try {
		return statSync(path).isDirectory()
			? readdirSync(path).flatMap((name) => sourceFiles(join(path, name)))
			: [path];
	} catch {
		return [];
	}
};

describe("webgpu entry", () => {
	it("exports the public API", () => {
		expect(api.LilToonNodeMaterial).toBeDefined();
		expect(api.GLTFLilToonNodeExtension).toBeDefined();
		expect(api.enableLilToonNodeVRM).toBeDefined();
		expect(api.LILTOON_NODE_FEATURES).toBeDefined();
	});

	it("does not import the WebGL material, generated shaders, or the WebGL renderer", () => {
		const files = ["src/webgpu.ts", ...sourceFiles("src/webgpu")];
		const banned = [/LilToonMaterial/, /generated\/shaders/, /renderer\//];
		for (const file of files) {
			const imports = readFileSync(file, "utf8")
				.split("\n")
				.filter((line) =>
					/^\s*(import|export)\b.*\bfrom\b|\bimport\s*\(/.test(line),
				);
			for (const line of imports) {
				for (const pattern of banned) {
					expect(line, `${file}: ${line}`).not.toMatch(pattern);
				}
			}
		}
	});
});
