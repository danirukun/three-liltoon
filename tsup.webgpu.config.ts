import { defineConfig } from "tsup";

// Separate build: the main config uses clean: true and would delete this output.
export default defineConfig({
	entry: { webgpu: "src/webgpu.ts" },
	format: "esm",
	dts: true,
	clean: false,
	sourcemap: false,
	splitting: false,
	external: ["three", /^three\//, "@pixiv/three-vrm"],
	treeshake: true,
});
