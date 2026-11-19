import { describe, expect, it } from "vitest";
import {
	UNITY_LIGHT_SCALE,
	lilAOShift,
	lilBand,
	lilShadowBands,
	type LilShadowBandsInput,
	lilGray,
	lilHalfLambert,
	lilLimitLight,
	lilReceive,
	lilShade,
	type LilShadeInput,
} from "../../src/webgpu/lilToonMath";

const close = (actual: readonly number[], expected: readonly number[]) => {
	expect(actual.length).toBe(expected.length);
	actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i]!, 6));
};

describe("lilBand", () => {
	it("is half lit at the border", () => {
		expect(lilBand(0.5, 0.5, 0.1)).toBeCloseTo(0.5, 6);
	});

	it("is lit at 1 and in shadow at 0", () => {
		expect(lilBand(1, 0.5, 0.1)).toBe(1);
		expect(lilBand(0, 0.5, 0.1)).toBe(0);
	});

	it("is a step at the border when the blur is 0", () => {
		expect(lilBand(0.49, 0.5, 0)).toBe(0);
		expect(lilBand(0.51, 0.5, 0)).toBe(1);
		expect(Number.isNaN(lilBand(0.5, 0.5, 0))).toBe(false);
	});

	// lil_common_functions.hlsl:26-31 and 77-80:
	// (value - saturate(border - blur/2)) / saturate(saturate(border + blur/2) - saturate(border - blur/2)), saturated.
	it("matches lilTooningScale with a blur", () => {
		// border 0.15, blur 0.1: min 0.1, max 0.2. (0.17 - 0.1) / 0.1 = 0.7.
		expect(lilBand(0.17, 0.15, 0.1)).toBeCloseTo(0.7, 6);
		// border 0.98, blur 0.1: min 0.93, max saturate(1.03) = 1. (0.965 - 0.93) / 0.07 = 0.5.
		expect(lilBand(0.965, 0.98, 0.1)).toBeCloseTo(0.5, 6);
	});

	// lil_common_functions.hlsl:33-38 and 82-85: borderMin also subtracts borderRange.
	it("matches lilTooningScale with a border range", () => {
		// border 0.5, blur 0.1, range 0.08: min 0.37, max 0.55. (0.46 - 0.37) / 0.18 = 0.5.
		expect(lilBand(0.46, 0.5, 0.1, 0.08)).toBeCloseTo(0.5, 6);
		// border 0.15, blur 0.1, range 0.2: min saturate(-0.15) = 0, max 0.2. 0.05 / 0.2 = 0.25.
		expect(lilBand(0.05, 0.15, 0.1, 0.2)).toBeCloseTo(0.25, 6);
	});
});

describe("lilBand anti-aliasing", () => {
	// LIL_ANTIALIAS_MODE 1, lil_common_functions.hlsl:61 and 68:
	// (value - borderMin) / saturate(borderMax - borderMin + fwidth(value) * aascale). `aa` is fwidth(value) * aascale.
	it("widens the ramp by the anti-aliasing term", () => {
		// min 0.45, max 0.55: 0.05 / saturate(0.1 + 0.1) = 0.25.
		expect(lilBand(0.5, 0.5, 0.1, 0, 0.1)).toBeCloseTo(0.25, 6);
		// blur 0: min = max = 0.5: 0.01 / saturate(0 + 0.02) = 0.5.
		expect(lilBand(0.51, 0.5, 0, 0, 0.02)).toBeCloseTo(0.5, 6);
	});
});

describe("lilAOShift", () => {
	// lil_common_frag.hlsl:1011-1014.
	it("shifts the border mask channels", () => {
		// r: 0.4 * 2 - 0.1 = 0.7. g: 0.5 * 0.5 + 0.6 = 0.85. b: 0.2 * 1 + 0.3 = 0.5.
		close(
			lilAOShift([0.4, 0.5, 0.2], [2, -0.1, 0.5, 0.6], [1, 0.3, 0, 0]),
			[0.7, 0.85, 0.5],
		);
		// Saturated: 1.5 -> 1, -1 -> 0, 3 -> 1.
		close(lilAOShift([1, 1, 1], [1, 0.5, -1, 0], [3, 0, 0, 0]), [1, 0, 1]);
	});
});

const bandsBase: LilShadowBandsInput = {
	ln: [1, 1, 1],
	border: [0.5, 0.15, 0.25],
	blur: [0.1, 0.1, 0.1],
	blurMask: [1, 1, 1],
	borderRange: 0.08,
	ao: [1, 1, 1],
	postAO: false,
	aa: [0, 0, 0],
};

// lil_common_frag.hlsl:983-1026: the blur mask, then the AO border mask before or after the tooning.
describe("lilShadowBands", () => {
	it("multiplies the AO mask before the tooning", () => {
		// lns.xyz = [1, 0.6, 0.6] * [0.5, 0.3, 1] = [0.5, 0.18, 0.6]; lns.w = lns.x = 0.5.
		// x: (0.5 - 0.45) / 0.1 = 0.5. y: (0.18 - 0.1) / 0.1 = 0.8. z: (0.6 - 0.2) / 0.1 -> 1.
		// w: min 0.37, max 0.55: (0.5 - 0.37) / 0.18 = 0.7222222.
		close(
			lilShadowBands({ ...bandsBase, ln: [1, 0.6, 0.6], ao: [0.5, 0.3, 1] }),
			[0.5, 0.8, 1, 0.7222222],
		);
	});

	it("multiplies the AO mask after the tooning with _ShadowPostAO", () => {
		// x: (0.47 - 0.45) / 0.1 = 0.2, * 0.5 = 0.1. y: (0.11 - 0.1) / 0.1 = 0.1, * 0.3 = 0.03.
		// z: (0.6 - 0.2) / 0.1 = 4, * 1, saturated to 1. w: (0.47 - 0.37) / 0.18 = 0.5555556, * 0.5 = 0.2777778.
		close(
			lilShadowBands({
				...bandsBase,
				ln: [0.47, 0.11, 0.6],
				ao: [0.5, 0.3, 1],
				postAO: true,
			}),
			[0.1, 0.03, 1, 0.2777778],
		);
	});

	it("scales the blur by the blur mask and adds the anti-aliasing term", () => {
		// x: blur 0.05: min 0.475, max 0.525, denominator 0.05 + 0.05: (0.5 - 0.475) / 0.1 = 0.25.
		// w: min 0.395, max 0.525, denominator 0.13 + 0.05: (0.5 - 0.395) / 0.18 = 0.5833333.
		// y: (0.5 - 0.1) / 0.1 -> 1. z: (0.5 - 0.2) / 0.1 -> 1.
		close(
			lilShadowBands({
				...bandsBase,
				ln: [0.5, 0.5, 0.5],
				blurMask: [0.5, 1, 1],
				aa: [0.05, 0, 0],
			}),
			[0.25, 1, 1, 0.5833333],
		);
	});
});

describe("lilHalfLambert and lilReceive", () => {
	// lil_common_frag.hlsl:948: saturate(dot(L, N) * 0.5 + 0.5).
	it("remaps N·L to 0..1", () => {
		expect(lilHalfLambert(0)).toBe(0.5);
		expect(lilHalfLambert(-0.4)).toBeCloseTo(0.3, 6);
		expect(lilHalfLambert(-2)).toBe(0);
	});

	// lil_common_frag.hlsl:975-977: ln *= lerp(1, saturate(attenuation), receive).
	it("folds the received shadow by the receive amount", () => {
		expect(lilReceive(0.8, 0.25, 0)).toBeCloseTo(0.8, 6);
		// 0.8 * lerp(1, 0.25, 0.5) = 0.8 * 0.625 = 0.5.
		expect(lilReceive(0.8, 0.25, 0.5)).toBeCloseTo(0.5, 6);
		expect(lilReceive(0.8, 1.5, 1)).toBeCloseTo(0.8, 6);
	});
});

describe("lilLimitLight", () => {
	it("clamps to the max limit", () => {
		expect(lilLimitLight([3, 3, 3], 0.05, 1, 0)).toEqual([1, 1, 1]);
	});

	it("clamps to the min limit", () => {
		expect(lilLimitLight([0, 0, 0], 0.05, 1, 0)).toEqual([0.05, 0.05, 0.05]);
	});

	it("makes three equal channels at full monochrome", () => {
		const [r, g, b] = lilLimitLight([1, 0, 0], 0, 1, 1);
		expect(r).toBeCloseTo(g, 6);
		expect(g).toBeCloseTo(b, 6);
	});

	// lil_common_macro.hlsl:2086-2087: clamp, then lerp(c, lilGray(c), _MonochromeLighting).
	it("matches LIL_CORRECT_LIGHTCOLOR", () => {
		// clamp: [0.6, 0.3, 0.05]; gray 0.95 / 3; half way.
		close(
			lilLimitLight([0.6, 0.3, 0], 0.05, 1, 0.5),
			[0.4583333, 0.3083333, 0.1833333],
		);
		// clamp: [2, 0.5, 0.5] with max 2; gray 1; a quarter way.
		close(lilLimitLight([4, 0.5, 0.5], 0, 2, 0.25), [1.75, 0.625, 0.625]);
	});
});

describe("lilGray and UNITY_LIGHT_SCALE", () => {
	// lil_common_functions.hlsl:342-345.
	it("is the channel mean", () => {
		expect(lilGray([0.3, 0.6, 0.9])).toBeCloseTo(0.6, 6);
		expect(lilGray([1, 0, 0])).toBeCloseTo(1 / 3, 6);
	});

	it("starts at 1 / PI", () => {
		expect(UNITY_LIGHT_SCALE).toBe(1 / Math.PI);
	});
});

const base: LilShadeInput = {
	albedo: [0.8, 0.6, 0.4],
	light: [1, 1, 1],
	environment: [0, 0, 0],
	bands: [1, 1, 1, 1],
	shadowStrength: 1,
	shadowColor: [0.82, 0.76, 0.85],
	shadowColorTex: [0, 0, 0, 0],
	shadow2ndColor: [0.68, 0.66, 0.79, 1],
	shadow2ndColorTex: [0, 0, 0, 0],
	shadow3rdColor: null,
	shadow3rdColorTex: [0, 0, 0, 0],
	shadowMainStrength: 0,
	shadowEnvStrength: 0,
	shadowBorderColor: [1, 0.1, 0],
};

// lil_common_frag.hlsl:1048-1133 (lilGetShading, from "Strength" to "Mix").
describe("lilShade", () => {
	it("is albedo times light where every band is lit", () => {
		close(lilShade({ ...base, light: [0.5, 0.5, 0.5] }), [0.4, 0.3, 0.2]);
	});

	it("uses the first shadow color in the first band", () => {
		// bands x = 0, y = 1 (lns.y = 1 - 1 = 0), w = 0:
		// indirectCol = albedo * _ShadowColor, min with direct, no gradation, col = indirectCol.
		close(lilShade({ ...base, bands: [0, 1, 1, 0] }), [
			0.8 * 0.82,
			0.6 * 0.76,
			0.4 * 0.85,
		]);
	});

	it("mixes the second shadow, the strength, the gradation, and the environment", () => {
		// bands [0.2, 0.5, 1, 0.4], strength 0.5, env 0.5 at strength 1, light 0.8.
		// x = lerp(1, 0.2, 0.5) = 0.6. y = 1 - 0.5 = 0.5.
		// ind1 = albedo * _ShadowColor = [0.656, 0.456, 0.34].
		// ind2 = albedo * _Shadow2ndColor = [0.544, 0.396, 0.316].
		// ind = lerp(ind1, ind2, 0.5) = [0.6, 0.426, 0.328].
		// direct = albedo * 0.8 = [0.64, 0.48, 0.32]. ind * 0.8 = [0.48, 0.3408, 0.2624].
		// env: lerp(ind, albedo, 0.5) = [0.64, 0.4704, 0.3312]. min with direct: [0.64, 0.4704, 0.32].
		// gradation: lerp(ind, direct, 0.4 * [1, 0.1, 0]) = [0.64, 0.4704 + 0.04 * 0.0096, 0.32] = [0.64, 0.470784, 0.32].
		// col = lerp(ind, direct, 0.6) = [0.64, 0.470784 + 0.6 * 0.009216, 0.32] = [0.64, 0.4763136, 0.32].
		close(
			lilShade({
				...base,
				light: [0.8, 0.8, 0.8],
				environment: [0.5, 0.5, 0.5],
				shadowEnvStrength: 1,
				shadowStrength: 0.5,
				bands: [0.2, 0.5, 1, 0.4],
			}),
			[0.64, 0.4763136, 0.32],
		);
	});

	it("uses the shadow color textures, the third shadow, and the main strength", () => {
		// x = 0, w = 0. shadowColorTex [1, 0, 0, 0.5]: ind1 = lerp(albedo, [1, 0, 0], 0.5) * [1, 1, 1] = [0.9, 0.3, 0.2].
		// y: alpha 0 makes lns.y = 0. z: _Shadow3rdColor [0, 0, 1, 0.5], band 0: lns.z = 0.5.
		// ind3 = albedo * [0, 0, 1] = [0, 0, 0.4]. ind = lerp(ind1, ind3, 0.5) = [0.45, 0.15, 0.3].
		// main strength 1: ind * albedo = [0.36, 0.09, 0.12]. light 1, env 0. min with albedo: same.
		close(
			lilShade({
				...base,
				bands: [0, 0, 0, 0],
				shadowColor: [1, 1, 1],
				shadowColorTex: [1, 0, 0, 0.5],
				shadow2ndColor: [0, 0, 0, 0],
				shadow3rdColor: [0, 0, 1, 0.5],
				shadowMainStrength: 1,
			}),
			[0.36, 0.09, 0.12],
		);
	});
});
