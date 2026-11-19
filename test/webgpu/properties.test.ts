import { Color, Vector4 } from "three";
import { describe, expect, it } from "vitest";
import { LILTOON_DEFAULTS } from "../../src/generated/defaults";
import {
	LILTOON_NODE_FEATURES,
	LILTOON_NODE_VARIANTS,
	nodeProperties,
	nodeVariant,
	nodeWarnings,
} from "../../src/webgpu/properties";

describe("nodeVariant", () => {
	it("keeps a supported variant with its mode and outline", () => {
		expect(nodeVariant("Hidden/lilToonCutoutOutline")).toEqual({
			variant: "Hidden/lilToonCutoutOutline",
			mode: "cutout",
			outline: true,
			warning: null,
		});
		expect(nodeVariant("Hidden/lilToonOnePassTransparent").mode).toBe(
			"transparent",
		);
	});

	it("falls back to lilToon for a known unsupported variant", () => {
		const result = nodeVariant("Hidden/lilToonFur");
		expect(result.variant).toBe("lilToon");
		expect(result.mode).toBe("opaque");
		expect(result.outline).toBe(false);
		expect(result.warning).toMatch(/Fur/);
	});

	it("keeps the outline of a known unsupported variant", () => {
		const result = nodeVariant("Hidden/lilToonTwoPassTransparentOutline");
		expect(result).toMatchObject({
			variant: "lilToon",
			mode: "opaque",
			outline: true,
		});
		expect(result.warning).not.toBeNull();
	});

	it("falls back to lilToon for an unknown name", () => {
		const result = nodeVariant("Nope");
		expect(result.variant).toBe("lilToon");
		expect(result.outline).toBe(false);
		expect(result.warning).not.toBeNull();
	});

	it("selects lilToon without a warning when no name is given", () => {
		expect(nodeVariant(undefined)).toEqual({
			variant: "lilToon",
			mode: "opaque",
			outline: false,
			warning: null,
		});
	});

	it("lists the eight supported variants and eight features", () => {
		expect([...LILTOON_NODE_VARIANTS].sort()).toEqual(
			[
				"lilToon",
				"Hidden/lilToonOutline",
				"Hidden/lilToonCutout",
				"Hidden/lilToonCutoutOutline",
				"Hidden/lilToonTransparent",
				"Hidden/lilToonTransparentOutline",
				"Hidden/lilToonOnePassTransparent",
				"Hidden/lilToonOnePassTransparentOutline",
			].sort(),
		);
		expect([...LILTOON_NODE_FEATURES].sort()).toEqual(
			[
				"shadow",
				"shadow3rd",
				"normal1st",
				"matcap",
				"rim",
				"emission1st",
				"backlight",
				"outline",
			].sort(),
		);
	});
});

describe("nodeProperties", () => {
	it("merges given values over the defaults", () => {
		const properties = nodeProperties("lilToon", { _Color: [1, 0, 0, 1] });
		expect(properties._Color).toEqual([1, 0, 0, 1]);
		expect(properties._ShadowBorder).toBe(LILTOON_DEFAULTS._ShadowBorder);
	});

	it("uses the mode defaults of the variant", () => {
		expect(nodeProperties("Hidden/lilToonTransparent", {})._DstBlend).toBe(10);
	});

	it("converts booleans, colors, and vectors to numbers and arrays", () => {
		const properties = nodeProperties("lilToon", {
			_UseRim: true,
			_RimColor: new Color(0.5, 0.25, 1),
			_MainTex_ST: new Vector4(2, 3, 0.5, 0.25),
		});
		expect(properties._UseRim).toBe(1);
		expect(properties._RimColor).toEqual([
			0.5,
			0.25,
			1,
			LILTOON_DEFAULTS._RimColor[3],
		]);
		expect(properties._MainTex_ST).toEqual([2, 3, 0.5, 0.25]);
	});

	it("defaults the main texture transform to identity", () => {
		expect(nodeProperties("lilToon", {})._MainTex_ST).toEqual([1, 1, 0, 0]);
	});

	it("does not share arrays with the defaults or the input", () => {
		const input = [0, 1, 0, 1];
		const a = nodeProperties("lilToon", { _Color: input });
		(a._Color as number[])[0] = 9;
		expect(input[0]).toBe(0);
		const b = nodeProperties("lilToon", {});
		(b._ShadowColor as number[])[0] = 9;
		expect(nodeProperties("lilToon", {})._ShadowColor).toEqual(
			LILTOON_DEFAULTS._ShadowColor,
		);
	});
});

describe("nodeWarnings", () => {
	it("reports an enabled feature outside the supported set", () => {
		const warnings = nodeWarnings("Body", { _UseMain2ndTex: 1 }, {});
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toMatchObject({
			code: "unsupported-feature",
			property: "_UseMain2ndTex",
			materialName: "Body",
		});
	});

	it("reports nothing for supported features", () => {
		expect(nodeWarnings("Body", { _UseShadow: 1, _UseRim: 1 }, {})).toEqual([]);
	});

	it("reports an unsupported shader variant", () => {
		const warnings = nodeWarnings("Body", {}, {}, "Hidden/lilToonGem");
		expect(warnings.map((w) => w.code)).toEqual(["unsupported-shader-variant"]);
		expect(warnings[0]!.property).toBe("shaderVariant");
	});
});
