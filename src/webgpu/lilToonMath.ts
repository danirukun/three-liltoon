// Ports lilToon 2.3.4 lil_common_functions.hlsl, lil_common_macro.hlsl, and lilGetShading of lil_common_frag.hlsl.
// LilToonLightingModel.ts has one TSL function for each function here, with the prefix `tsl`.

export type Rgb = readonly [number, number, number];
export type Rgba = readonly [number, number, number, number];

/**
 * The lilToon light color is the three light color times this scale. Task 10 calibrates it against the Unity
 * reference. The start value makes a three light of intensity PI a Unity light of intensity 1 (the Lambert 1 / PI).
 */
export const UNITY_LIGHT_SCALE = 1 / Math.PI;

/**
 * The smallest band ramp. lilTooningNoSaturateScale divides by 0 when the blur is 0; this keeps a step without NaN.
 * The 3-argument lilToon overload (lil_common_functions.hlsl:52-55) uses the same lower clamp.
 */
export const BAND_EPSILON = 1e-4;

const saturate = (value: number): number => Math.min(Math.max(value, 0), 1);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerpRgb = (a: Rgb, b: Rgb, t: number | Rgb): [number, number, number] =>
	[0, 1, 2].map((i) =>
		lerp(a[i]!, b[i]!, typeof t === "number" ? t : t[i]!),
	) as [number, number, number];
const mulRgb = (a: Rgb, b: Rgb | number): [number, number, number] =>
	[0, 1, 2].map((i) => a[i]! * (typeof b === "number" ? b : b[i]!)) as [
		number,
		number,
		number,
	];
const rgb = (value: Rgba): Rgb => [value[0], value[1], value[2]];

/** lil_common_frag.hlsl:948 — `saturate(dot(fd.L, N1) * 0.5 + 0.5)`. */
export const lilHalfLambert = (nDotL: number): number =>
	saturate(nDotL * 0.5 + 0.5);

/**
 * lil_common_frag.hlsl:974-977 — `lns.x *= lerp(1.0, calculatedShadow, _ShadowReceive)`, where
 * `calculatedShadow = saturate(fd.attenuation + distance(fd.L, fd.origL))`. The direction override term is 0 here.
 */
export const lilReceive = (
	ln: number,
	shadow: number,
	receive: number,
): number => ln * lerp(1, saturate(shadow), receive);

/**
 * The lilToon shadow band before the saturate. `nl` is the half-Lambert value of lilHalfLambert. `aa` is the
 * anti-aliasing term `fwidth(nl) * _AAStrength` of LIL_ANTIALIAS_MODE 1 (the lilToon default); 0 is mode 0.
 * lil_common_functions.hlsl:57-69 (lilTooningNoSaturateScale with blur, and with borderRange).
 */
export const lilBandNoSaturate = (
	nl: number,
	border: number,
	blur: number,
	borderRange = 0,
	aa = 0,
): number => {
	const borderMin = saturate(border - blur * 0.5 - borderRange);
	const borderMax = saturate(border + blur * 0.5);
	return (
		(nl - borderMin) /
		Math.max(saturate(borderMax - borderMin + aa), BAND_EPSILON)
	);
};

/** The lilToon shadow band: 1 lit, 0 in shadow. lil_common_functions.hlsl:77-85 (lilTooningScale). */
export const lilBand = (
	nl: number,
	border: number,
	blur: number,
	borderRange = 0,
	aa = 0,
): number => saturate(lilBandNoSaturate(nl, border, blur, borderRange, aa));

/** The AO shift of `_ShadowBorderMask`, lil_common_frag.hlsl:1011-1014. */
export const lilAOShift = (
	mask: Rgb,
	shift: Rgba,
	shift2: Rgba,
): [number, number, number] => [
	saturate(mask[0] * shift[0] + shift[1]),
	saturate(mask[1] * shift[2] + shift[3]),
	saturate(mask[2] * shift2[0] + shift2[1]),
];

export interface LilShadowBandsInput {
	/** lns.xyz after the received shadow: first, second, third. */
	ln: Rgb;
	/** `_ShadowBorder`, `_Shadow2ndBorder`, `_Shadow3rdBorder`. */
	border: Rgb;
	/** `_ShadowBlur`, `_Shadow2ndBlur`, `_Shadow3rdBlur`. */
	blur: Rgb;
	/** The `_ShadowBlurMask` sample (rgb), 1 without a texture. */
	blurMask: Rgb;
	borderRange: number;
	/** lilAOShift of the `_ShadowBorderMask` sample. */
	ao: Rgb;
	/** `_ShadowPostAO`. */
	postAO: boolean;
	/** `fwidth(value) * _AAStrength` of each value at the tooning, first, second, third. */
	aa: Rgb;
}

/**
 * The bands (x first, y second, z third, w first with `_ShadowBorderRange`), lil_common_frag.hlsl:983-1026: the blur
 * mask (996-999), the AO border mask before (1016) or after (1025) the tooning, and the saturate (1026). Without a
 * border mask texture the mask is 1, and this is the same as lines 1028-1033.
 */
export const lilShadowBands = (input: LilShadowBandsInput): Rgba => {
	const { ao, postAO } = input;
	const blur = mulRgb(input.blur, input.blurMask);
	const ln = postAO ? input.ln : mulRgb(input.ln, ao);
	const band = (i: number, range = 0) =>
		lilBandNoSaturate(ln[i]!, input.border[i]!, blur[i]!, range, input.aa[i]!);
	const bands = [band(0), band(1), band(2), band(0, input.borderRange)];
	const post = postAO ? [ao[0], ao[1], ao[2], ao[0]] : [1, 1, 1, 1];
	return bands.map((b, i) => saturate(b * post[i]!)) as unknown as Rgba;
};

/** lil_common_functions.hlsl:342-345. */
export const lilGray = (color: Rgb): number =>
	(color[0] + color[1] + color[2]) / 3;

/**
 * LIL_CORRECT_LIGHTCOLOR_VS without `_AsUnlit`, lil_common_macro.hlsl:2086-2087: the clamp to the light limits and the
 * monochrome mix.
 */
export const lilLimitLight = (
	color: Rgb,
	min: number,
	max: number,
	monochrome: number,
): [number, number, number] => {
	const clamped = color.map((c) => Math.min(Math.max(c, min), max)) as [
		number,
		number,
		number,
	];
	const gray = lilGray(clamped);
	return lerpRgb(clamped, [gray, gray, gray], monochrome);
};

export interface LilShadeInput {
	/** fd.albedo. */
	albedo: Rgb;
	/** fd.lightColor after the light limit and `_AsUnlit`. */
	light: Rgb;
	/** fd.indLightColor. */
	environment: Rgb;
	/** lns after tooning: x first, y second, z third, w first with `_ShadowBorderRange`. */
	bands: Rgba;
	shadowStrength: number;
	shadowColor: Rgb;
	/** The sample of `_ShadowColorTex`, or 0 when the material has no texture. */
	shadowColorTex: Rgba;
	shadow2ndColor: Rgba;
	shadow2ndColorTex: Rgba;
	/** `null` when LIL_FEATURE_SHADOW_3RD is off. */
	shadow3rdColor: Rgba | null;
	shadow3rdColorTex: Rgba;
	shadowMainStrength: number;
	shadowEnvStrength: number;
	shadowBorderColor: Rgb;
}

/** lilGetShading with `_UseShadow`, lil_common_frag.hlsl:1048-1133, from "Strength" to "Mix". */
export const lilShade = (input: LilShadeInput): [number, number, number] => {
	const { albedo, light, bands } = input;
	// 1066: lns.x = lerp(1.0, lns.x, shadowStrength)
	const first = lerp(1, bands[0], input.shadowStrength);
	// 1103: indirectCol = lerp(fd.albedo, shadowColorTex.rgb, shadowColorTex.a) * _ShadowColor.rgb
	let indirect = mulRgb(
		lerpRgb(albedo, rgb(input.shadowColorTex), input.shadowColorTex[3]),
		input.shadowColor,
	);
	// 1106-1108: the second shadow color, by lns.y = a - lns.y * a
	const second = mulRgb(
		lerpRgb(albedo, rgb(input.shadow2ndColorTex), input.shadow2ndColorTex[3]),
		rgb(input.shadow2ndColor),
	);
	indirect = lerpRgb(
		indirect,
		second,
		input.shadow2ndColor[3] - bands[1] * input.shadow2ndColor[3],
	);
	// 1112-1114: the third shadow color, by lns.z = a - lns.z * a
	if (input.shadow3rdColor) {
		const third = mulRgb(
			lerpRgb(albedo, rgb(input.shadow3rdColorTex), input.shadow3rdColorTex[3]),
			rgb(input.shadow3rdColor),
		);
		indirect = lerpRgb(
			indirect,
			third,
			input.shadow3rdColor[3] - bands[2] * input.shadow3rdColor[3],
		);
	}
	// 1118: indirectCol = lerp(indirectCol, indirectCol * fd.albedo, _ShadowMainStrength)
	indirect = lerpRgb(
		indirect,
		mulRgb(indirect, albedo),
		input.shadowMainStrength,
	);
	// 1121-1122: directCol = fd.albedo * fd.lightColor; indirectCol = indirectCol * fd.lightColor
	const direct = mulRgb(albedo, light);
	indirect = mulRgb(indirect, light);
	// 1125: indirectCol = lerp(indirectCol, fd.albedo, saturate(fd.indLightColor * _ShadowEnvStrength))
	indirect = lerpRgb(
		indirect,
		albedo,
		input.environment.map((e) =>
			saturate(e * input.shadowEnvStrength),
		) as never,
	);
	// 1128: indirectCol = min(indirectCol, directCol)
	indirect = indirect.map((c, i) => Math.min(c, direct[i]!)) as never;
	// 1130: indirectCol = lerp(indirectCol, directCol, lns.w * _ShadowBorderColor.rgb)
	indirect = lerpRgb(
		indirect,
		direct,
		mulRgb(input.shadowBorderColor, bands[3]),
	);
	// 1133: fd.col.rgb = lerp(indirectCol, directCol, lns.x)
	return lerpRgb(indirect, direct, first);
};

/**
 * fd.N from the three normal on one face. `facing` is 1 on a front face and -1 on a back face; three negates the
 * normal on a back face, lilToon does not, and `_FlipNormal` negates it (lil_pass_forward_normal.hlsl:299-303).
 */
export const lilFaceNormal = (
	threeNormal: Rgb,
	facing: number,
	flipNormal: number,
): [number, number, number] =>
	mulRgb(threeNormal, facing < flipNormal - 1 ? -facing : facing);

/** The lilToon blend modes of lilBlendColor: 0 Normal, 1 Add, 2 Screen, 3 Multiply. */
export const isLilBlendMode = (mode: number): boolean =>
	mode === 0 || mode === 1 || mode === 2 || mode === 3;

/**
 * lilBlendColor, lil_common_functions.hlsl:325-340. The HLSL leaves `outCol` unset for a mode outside 0-3. This
 * port draws such a mode as 0, and nodeWarnings reports it.
 */
export const lilBlendColor = (
	dst: Rgb,
	src: Rgb,
	srcA: number | Rgb,
	mode: number,
): [number, number, number] => {
	const each = (f: (i: number) => number) =>
		[0, 1, 2].map(f) as [number, number, number];
	const ad = each((i) => dst[i]! + src[i]!);
	const mu = mulRgb(dst, src);
	const screen = each((i) => Math.max(ad[i]! - mu[i]!, dst[i]!));
	const out = [src, ad, screen, mu][isLilBlendMode(mode) ? mode : 0]!;
	return lerpRgb(dst, out, srcA);
};

/**
 * lilGetOutlineWidth with `_OutlineVertexR2Width` 0, lil_common_functions.hlsl:273-290: `_OutlineWidth` is in
 * centimetres, times the `_OutlineWidthMask` red channel. `_OutlineFixWidth` narrows it within 1 m of the camera.
 */
export const lilOutlineWidth = (
	width: number,
	mask: number,
	fixWidth: number,
	cameraDistance: number,
): number => width * 0.01 * mask * lerp(1, saturate(cameraDistance), fixWidth);
