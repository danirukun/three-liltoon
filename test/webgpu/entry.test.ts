import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as api from "../../src/webgpu";

const BANNED = [/LilToonMaterial/, /generated\/shaders/, /renderer\//];

const SPECIFIER_PATTERNS = [
	/\bfrom\s*["']([^"']+)["']/g,
	/\bimport\s*\(\s*["']([^"']+)["']/g,
	/\bimport\s*["']([^"']+)["']/g,
];

const moduleSpecifiers = (text: string): string[] =>
	SPECIFIER_PATTERNS.flatMap((pattern) =>
		[...text.matchAll(pattern)].map((match) => match[1]),
	);

const bannedSpecifiers = (text: string): string[] =>
	moduleSpecifiers(text).filter((specifier) =>
		BANNED.some((pattern) => pattern.test(specifier)),
	);

const isMissing = (error: unknown): boolean =>
	(error as NodeJS.ErrnoException).code === "ENOENT";

const sourceFiles = (path: string): string[] => {
	try {
		return statSync(path).isDirectory()
			? readdirSync(path).flatMap((name) => sourceFiles(join(path, name)))
			: [path];
	} catch (error) {
		if (isMissing(error)) return [];
		throw error;
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
		for (const file of files) {
			expect(bannedSpecifiers(readFileSync(file, "utf8")), file).toEqual([]);
		}
	});

	it("catches multi-line, re-export, dynamic, and bare imports", () => {
		const text = [
			'import {\n  A,\n  B,\n} from "../renderer/x";',
			'export * from "../material/LilToonMaterial";',
			'const m = await import("../generated/shaders");',
			'import "../renderer/side-effect";',
			'import { ok } from "three/tsl";',
		].join("\n");
		expect(bannedSpecifiers(text)).toEqual([
			"../renderer/x",
			"../material/LilToonMaterial",
			"../generated/shaders",
			"../renderer/side-effect",
		]);
	});
});
