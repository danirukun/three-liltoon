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

describe("nodeProperties with a wrong shape", () => {
	// Untrusted avatar JSON: each wrong shape keeps the default and names the property. Nothing throws.
	const bad = {
		_Color: null,
		_ShadowColor: "red",
		_RimColor: { r: 1, g: 0, b: 0 },
		_Shadow2ndColor: [1, 0, 0, 1, 1],
		_MainTex_ST: [1, "2", 0, 0],
		_ShadowBorder: [0.5, 0.5],
		_Shadow3rdColor: 0.5,
		_UseRim: "1",
		_ShadowBlur: Number.NaN,
	} as never;

	it("keeps the default of each property with a wrong shape and names it once", () => {
		const invalid: string[] = [];
		const properties = nodeProperties("lilToon", bad, (name) =>
			invalid.push(name),
		);
		expect(invalid).toEqual([
			"_Color",
			"_ShadowColor",
			"_RimColor",
			"_Shadow2ndColor",
			"_MainTex_ST",
			"_ShadowBorder",
			"_Shadow3rdColor",
			"_UseRim",
			"_ShadowBlur",
		]);
		expect(properties._Color).toEqual(LILTOON_DEFAULTS._Color);
		expect(properties._ShadowColor).toEqual(LILTOON_DEFAULTS._ShadowColor);
		expect(properties._RimColor).toEqual(LILTOON_DEFAULTS._RimColor);
		expect(properties._Shadow2ndColor).toEqual(
			LILTOON_DEFAULTS._Shadow2ndColor,
		);
		expect(properties._MainTex_ST).toEqual([1, 1, 0, 0]);
		expect(properties._ShadowBorder).toBe(LILTOON_DEFAULTS._ShadowBorder);
		expect(properties._Shadow3rdColor).toEqual(
			LILTOON_DEFAULTS._Shadow3rdColor,
		);
		expect(properties._UseRim).toBe(LILTOON_DEFAULTS._UseRim);
		expect(properties._ShadowBlur).toBe(LILTOON_DEFAULTS._ShadowBlur);
	});

	it("gives a message that names the property, the value, and the default", () => {
		const messages: string[] = [];
		nodeProperties(
			"lilToon",
			{ _Color: null, _ShadowBorder: [1] } as never,
			(_, message) => messages.push(message),
		);
		expect(messages[0]).toMatch(/^_Color is null/);
		expect(messages[0]).toContain("The material uses the default");
		expect(messages[1]).toMatch(/^_ShadowBorder is an array of 1/);
	});

	it("keeps a finite number or a short number array for a name without a default", () => {
		const invalid: string[] = [];
		const properties = nodeProperties(
			"lilToon",
			{
				_Custom: 2,
				_CustomVec: [1, 2],
				_CustomBad: "x",
				_CustomLong: [1, 2, 3, 4, 5],
			} as never,
			(name) => invalid.push(name),
		);
		expect(properties._Custom).toBe(2);
		expect(properties._CustomVec).toEqual([1, 2]);
		expect(properties).not.toHaveProperty("_CustomBad");
		expect(properties).not.toHaveProperty("_CustomLong");
		expect(invalid).toEqual(["_CustomBad", "_CustomLong"]);
	});

	it("still pads a short array and converts a Color for a vector property", () => {
		const invalid: string[] = [];
		const properties = nodeProperties(
			"lilToon",
			{ _Color: [0.2, 0.4, 0.6], _RimColor: new Color(1, 0, 0) },
			(name) => invalid.push(name),
		);
		expect(invalid).toEqual([]);
		expect(properties._Color).toEqual([
			0.2,
			0.4,
			0.6,
			LILTOON_DEFAULTS._Color[3],
		]);
		expect(properties._RimColor).toEqual([
			1,
			0,
			0,
			LILTOON_DEFAULTS._RimColor[3],
		]);
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

	it("reports the flat and face shadow mask types", () => {
		for (const type of [1, 2]) {
			const warnings = nodeWarnings(
				"Face",
				{ _UseShadow: 1, _ShadowMaskType: type },
				{},
			);
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toMatchObject({
				code: "unsupported-feature",
				property: "_ShadowMaskType",
				materialName: "Face",
			});
		}
	});

	it("reports the LUT shadow color type", () => {
		const warnings = nodeWarnings(
			"Body",
			{ _UseShadow: 1, _ShadowColorType: 1 },
			{},
		);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toMatchObject({
			code: "unsupported-feature",
			property: "_ShadowColorType",
		});
	});

	it("does not report a shadow type when the shadow is off", () => {
		expect(
			nodeWarnings("Body", { _ShadowMaskType: 2, _ShadowColorType: 1 }, {}),
		).toEqual([]);
	});

	it("reports an unsupported shader variant", () => {
		const warnings = nodeWarnings("Body", {}, {}, "Hidden/lilToonGem");
		expect(warnings.map((w) => w.code)).toEqual(["unsupported-shader-variant"]);
		expect(warnings[0]!.property).toBe("shaderVariant");
	});
});
