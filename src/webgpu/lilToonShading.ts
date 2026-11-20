// Ports lilBacklight, lilGetMatCap, lilGetRim, lilEmission, and the outline color of lilToon 2.3.4 lil_common_frag.hlsl, lilBlendColor, lilCalcMatCapUV, lilCalcBlink, and lilCalcOutlinePosition of lil_common_functions.hlsl, and the outline lighting of lil_pass_forward_normal.hlsl to TSL.
import type { Node, TextureNode } from "three/webgpu";
import {
	abs,
	cameraPosition,
	cameraProjectionMatrix,
	cameraViewMatrix,
	cross,
	dot,
	faceDirection,
	float,
	fwidth,
	length,
	max,
	mix,
	modelWorldMatrix,
	normalize,
	normalLocal,
	positionLocal,
	positionViewDirection,
	pow,
	round,
	saturate,
	select,
	sin,
	sqrt,
	time,
	uv,
	vec2,
	vec3,
	vec4,
} from "three/tsl";
import { tslBand } from "./LilToonLightingModel.js";

type Float = Node<"float">;
type Vec2 = Node<"vec2">;
type Vec3 = Node<"vec3">;
type Vec4 = Node<"vec4">;

/** What the shading functions read from the material. */
export interface LilToonShadingInputs {
	float(name: string): Float;
	vec4(name: string): Vec4;
	/** The texture of one slot, or null when the slot has no texture. */
	texture(name: string): TextureNode<"vec4"> | null;
	/** fd.uvMain: uv0 × `_MainTex_ST`. */
	uvMain: Vec2;
}

/** The part of LilToonNodeMaterial that the shading inputs read. */
export interface LilToonShadingSource {
	propertyNode(name: string, type: "float"): Float;
	propertyNode(name: string, type: "vec4"): Vec4;
	textureNode(name: string): TextureNode<"vec4">;
}

/** The shading inputs of a material. `hasTexture` is the texture state of one build. */
export const lilToonShadingInputs = (
	source: LilToonShadingSource,
	hasTexture: (name: string) => boolean,
): LilToonShadingInputs => {
	const st = source.propertyNode("_MainTex_ST", "vec4");
	return {
		float: (name) => source.propertyNode(name, "float"),
		vec4: (name) => source.propertyNode(name, "vec4"),
		texture: (name) => (hasTexture(name) ? source.textureNode(name) : null),
		uvMain: uv().mul(st.xy).add(st.zw),
	};
};

/** The state of lilFragData after the lighting, which the effects read. */
export interface LilToonSurface {
	inputs: LilToonShadingInputs;
	/** fd.albedo. */
	albedo: Vec3;
	/** fd.col.a. */
	alpha: Float;
	/** LIL_RENDER == 2. */
	transparent: boolean;
	/** fd.lightColor after the light limit. */
	lightColor: Vec3;
	/** fd.shadowmix: the first shadow band before `_ShadowStrength`, 1 without `_UseShadow`. */
	shadowmix: Float;
	/** fd.N. */
	normal: Vec3;
	/** fd.origN with LIL_FEATURE_NORMAL_1ST. `null` without it, so the normal strengths do not apply. */
	geometryNormal: Vec3 | null;
}

/** LIL_SAMPLE_2D_ST: the texture at `uv * <name>_ST.xy + <name>_ST.zw`. A slot without a texture is white, 1. */
export const tslSampleST = (
	inputs: LilToonShadingInputs,
	name: string,
	at: Vec2,
): Vec4 => {
	const texture = inputs.texture(name);
	if (!texture) return vec4(1);
	const st = inputs.vec4(`${name}_ST`);
	return texture.sample(at.mul(st.xy).add(st.zw));
};

/** lilBlendColor, lil_common_functions.hlsl:325-340. A mode outside 0-3 is 0, as lilBlendColor of lilToonMath.ts. */
export const tslBlendColor = (
	dst: Vec3,
	src: Vec3,
	srcA: Float | Vec3,
	mode: Float,
): Vec3 => {
	const ad = dst.add(src);
	const mu = dst.mul(src);
	const out = select(
		mode.equal(1),
		ad,
		select(mode.equal(2), max(ad.sub(mu), dst), select(mode.equal(3), mu, src)),
	) as Vec3;
	return mix(dst, out, srcA);
};

/** `fd.facing < (mask - 1.0) ? 0.0 : value`: a mask of 1 removes the term from back faces. */
export const tslBackfaceMask = (value: Float, mask: Float): Float =>
	select(faceDirection.lessThan(mask.sub(1)), float(0), value);

/** `lerp(fd.origN, fd.N, strength)` with LIL_FEATURE_NORMAL_1ST, fd.N without it. lilToon does not normalize it. */
export const tslNormalByStrength = (
	normal: Vec3,
	geometryNormal: Vec3 | null,
	strength: Float,
): Vec3 => (geometryNormal ? mix(geometryNormal, normal, strength) : normal);

/** lilTooningScale with LIL_ANTIALIAS_MODE 1, lil_common_functions.hlsl:57-62 and 77-80. */
const tslTooning = (
	inputs: LilToonShadingInputs,
	value: Float,
	border: Float,
	blur: Float,
): Float =>
	tslBand(
		value,
		border,
		blur,
		0,
		fwidth(value).mul(inputs.float("_AAStrength")),
	);

export interface TslBacklightInput {
	inputs: LilToonShadingInputs;
	/** fd.N after `_BacklightNormalStrength` (lil_common_frag.hlsl:1238-1241). */
	normal: Vec3;
	/** fd.L of this light. */
	lightDirection: Vec3;
	/** The cast shadow of this light after receivedShadow, 1 lit. */
	shadow: Float;
}

/** The backlight of one light, lilBacklight of lil_common_frag.hlsl:1250-1257. */
export const tslBacklight = (input: TslBacklightInput): Float => {
	const { inputs, normal, lightDirection } = input;
	const p = inputs.float;
	// fd.headV is the view direction without VR (lil_common_macro.hlsl:621-628).
	const headV = positionViewDirection;
	// 1250: pow(saturate(-fd.hl * 0.5 + 0.5), _BacklightDirectivity), fd.hl = dot(fd.headV, fd.L)
	const factor = pow(
		saturate(dot(headV, lightDirection).mul(-0.5).add(0.5)),
		p("_BacklightDirectivity"),
	);
	// 1251: dot(normalize(-fd.headV * _BacklightViewStrength + fd.L), N) * 0.5 + 0.5
	const ln = dot(
		normalize(
			headV.mul(p("_BacklightViewStrength")).negate().add(lightDirection),
		),
		normal,
	)
		.mul(0.5)
		.add(0.5);
	// 1253: if(_BacklightReceiveShadow) backlightLN *= saturate(fd.attenuation + distance(fd.L, fd.origL))
	const shadowed = ln.mul(
		select(
			p("_BacklightReceiveShadow").notEqual(0),
			saturate(input.shadow),
			float(1),
		),
	);
	// 1255: lilTooningScale(_AAStrength, backlightLN, _BacklightBorder, _BacklightBlur)
	const band = tslTooning(
		inputs,
		shadowed,
		p("_BacklightBorder"),
		p("_BacklightBlur"),
	);
	// 1256-1257
	return tslBackfaceMask(
		saturate(factor.mul(band)),
		p("_BacklightBackfaceMask"),
	);
};

/** The backlight color for the factor of tslBacklight, lil_common_frag.hlsl:1244-1247 and 1260-1261. */
export const tslBacklightColor = (
	s: LilToonSurface,
	backlight: Float,
): Vec3 => {
	const { inputs } = s;
	const color = inputs
		.vec4("_BacklightColor")
		.mul(tslSampleST(inputs, "_BacklightColorTex", inputs.uvMain));
	const rgb = mix(
		color.rgb,
		color.rgb.mul(s.albedo),
		inputs.float("_BacklightMainStrength"),
	);
	return rgb.mul(backlight.mul(color.a)).mul(s.lightColor);
};

/**
 * lilCalcMatCapUV without VR and `_MatCapBlendUV1`, lil_common_functions.hlsl:550-565, in view space. The dot
 * products of the frame do not depend on the space.
 */
export const tslMatCapUV = (
	inputs: LilToonShadingInputs,
	normal: Vec3,
): Vec2 => {
	const p = inputs.float;
	// 554-555: the view direction, or the camera direction for an orthographic camera or without _MatCapPerspective.
	// The projection element [3][3] is 0 for a perspective camera and 1 for an orthographic camera.
	const perspective = cameraProjectionMatrix
		.mul(vec4(0, 0, 0, 1))
		.w.equal(0)
		.and(p("_MatCapPerspective").notEqual(0));
	const normalVD = select(perspective, positionViewDirection, vec3(0, 0, 1));
	// 556: world up with _MatCapZRotCancel, else the camera up
	const up = select(
		p("_MatCapZRotCancel").notEqual(0),
		cameraViewMatrix.mul(vec4(0, 1, 0, 0)).xyz,
		vec3(0, 1, 0),
	);
	// 557: lilOrthoNormalize
	const bitangent = normalize(up.sub(normalVD.mul(dot(normalVD, up))));
	// 558: cross(normalVD, bitangentVD) in the left-handed Unity space is cross(bitangentVD, normalVD) here.
	const tangent = cross(bitangent, normalVD);
	// 560-563
	const st = inputs.vec4("_MatCapTex_ST");
	const matUV = vec2(dot(tangent, normal), dot(bitangent, normal))
		.mul(st.xy)
		.add(st.zw)
		.mul(0.5)
		.add(0.5);
	// Unity V is 0 at the bottom of the image. These textures have flipY false, so V is 0 at the top.
	return vec2(matUV.x, matUV.y.oneMinus());
};

/** lilGetMatCap without `_MatCapCustomNormal`, lil_common_frag.hlsl:1522-1562. */
export const tslMatCap = (col: Vec3, s: LilToonSurface): Vec3 => {
	const { inputs } = s;
	const p = inputs.float;
	// 1522-1525
	const normal = tslNormalByStrength(
		s.normal,
		s.geometryNormal,
		p("_MatCapNormalStrength"),
	);
	// 1537
	const matUV = tslMatCapUV(inputs, normalize(normal));
	// 1540-1543: LIL_SAMPLE_2D_LOD(_MatCapTex, lil_sampler_linear_repeat, matUV, _MatCapLod)
	const texture = inputs.texture("_MatCapTex");
	const color = inputs.vec4("_MatCapColor");
	const sampled = texture
		? color.mul(texture.sample(matUV).level(p("_MatCapLod")))
		: color;
	// 1545-1546
	const lit = mix(
		sampled.rgb,
		sampled.rgb.mul(s.lightColor),
		p("_MatCapEnableLighting"),
	);
	const masked = mix(
		sampled.a,
		sampled.a.mul(s.shadowmix),
		p("_MatCapShadowMask"),
	);
	// 1551-1553
	const alpha = s.transparent
		? select(
				p("_MatCapApplyTransparency").notEqual(0),
				masked.mul(s.alpha),
				masked,
			)
		: masked;
	// 1554-1558
	const facing = tslBackfaceMask(alpha, p("_MatCapBackfaceMask"));
	const mask = tslSampleST(inputs, "_MatCapBlendMask", inputs.uvMain).rgb;
	// 1561-1562
	const rgb = mix(lit, lit.mul(s.albedo), p("_MatCapMainStrength"));
	return tslBlendColor(
		col,
		rgb,
		mask.mul(p("_MatCapBlend").mul(facing)),
		p("_MatCapBlendMode"),
	);
};

/** lilGetRim without LIL_FEATURE_RIMLIGHT_DIRECTION, lil_common_frag.hlsl:1700-1728. */
export const tslRim = (col: Vec3, s: LilToonSurface): Vec3 => {
	const { inputs } = s;
	const p = inputs.float;
	// 1700-1704
	const color = inputs
		.vec4("_RimColor")
		.mul(tslSampleST(inputs, "_RimColorTex", inputs.uvMain));
	const rgb = mix(color.rgb, color.rgb.mul(s.albedo), p("_RimMainStrength"));
	// 1707-1711
	const normal = tslNormalByStrength(
		s.normal,
		s.geometryNormal,
		p("_RimNormalStrength"),
	);
	const nvabs = abs(dot(normal, positionViewDirection));
	// 1714-1716
	const fresnel = tslBackfaceMask(
		pow(saturate(nvabs.oneMinus()), p("_RimFresnelPower")),
		p("_RimBackfaceMask"),
	);
	const band = tslTooning(inputs, fresnel, p("_RimBorder"), p("_RimBlur"));
	// 1717-1719
	const rim = s.transparent
		? select(p("_RimApplyTransparency").notEqual(0), band.mul(s.alpha), band)
		: band;
	// 1720
	const shadowed = mix(rim, rim.mul(s.shadowmix), p("_RimShadowMask"));
	// 1724, 1728
	const lit = mix(rgb, rgb.mul(s.lightColor), p("_RimEnableLighting"));
	return tslBlendColor(col, lit, shadowed.mul(color.a), p("_RimBlendMode"));
};

/** lilCalcBlink, lil_common_functions.hlsl:619-624. LIL_TIME is the time in seconds. */
export const tslBlink = (blink: Vec4): Float => {
	const wave = sin(time.mul(blink.z).add(blink.w)).mul(0.5).add(0.5);
	return mix(
		float(1),
		select(blink.y.greaterThan(0.5), round(wave), wave),
		blink.x,
	);
};

/**
 * lilEmission with `_EmissionMap_UVMode` 0, without the UV animation, the gradation, and AudioLink,
 * lil_common_frag.hlsl:1819-1865.
 */
export const tslEmission = (col: Vec3, s: LilToonSurface): Vec3 => {
	const { inputs } = s;
	const p = inputs.float;
	// 1821-1843: the map at fd.uv0 and the mask at fd.uvMain. The parallax offset is 0 without LIL_FEATURE_PARALLAX.
	const color = inputs
		.vec4("_EmissionColor")
		.mul(tslSampleST(inputs, "_EmissionMap", uv()))
		.mul(tslSampleST(inputs, "_EmissionBlendMask", inputs.uvMain));
	// 1859: fd.invLighting = saturate((1.0 - fd.lightColor) * sqrt(fd.lightColor)) (lil_common_macro.hlsl:2311)
	const invLighting = saturate(s.lightColor.oneMinus().mul(sqrt(s.lightColor)));
	const fluorescent = mix(
		color.rgb,
		color.rgb.mul(invLighting),
		p("_EmissionFluorescence"),
	);
	// 1860
	const rgb = mix(
		fluorescent,
		fluorescent.mul(s.albedo),
		p("_EmissionMainStrength"),
	);
	// 1861-1864
	const blend = p("_EmissionBlend")
		.mul(tslBlink(inputs.vec4("_EmissionBlink")))
		.mul(color.a);
	return tslBlendColor(
		col,
		rgb,
		s.transparent ? blend.mul(s.alpha) : blend,
		p("_EmissionBlendMode"),
	);
};

/**
 * The outline position, lilCalcOutlinePosition with `_OutlineVertexR2Width` 0, without `_OutlineVectorTex`, and with
 * `_OutlineZBias` 0, lil_common_functions.hlsl:298-307 and 273-288. It runs in the vertex stage.
 */
export const tslOutlinePosition = (
	inputs: LilToonShadingInputs,
	position: Vec3 = positionLocal,
): Vec3 => {
	const p = inputs.float;
	// 277: LIL_SAMPLE_2D_LOD(outlineWidthMask, samp, uvMain, 0).r
	const texture = inputs.texture("_OutlineWidthMask");
	const mask = texture
		? texture.sample(inputs.uvMain).level(float(0)).r
		: float(1);
	// 300, 287: lerp(1.0, saturate(length(lilHeadDirection(positionWS))), outlineFixWidth)
	const positionWS = modelWorldMatrix.mul(vec4(positionLocal, 1)).xyz;
	const near = saturate(length(cameraPosition.sub(positionWS)));
	// 275, 277
	const width = p("_OutlineWidth")
		.mul(0.01)
		.mul(mask)
		.mul(mix(float(1), near, p("_OutlineFixWidth")));
	// 302, 307: positionOS += outlineN * width
	return position.add(normalize(normalLocal).mul(width));
};

/**
 * The outline color, OVERRIDE_OUTLINE_COLOR of lil_common_frag.hlsl:363-399 without the tone correction and with
 * `_OutlineLitColor.a` 0: `fd.col = _OutlineTex` (1 without LIL_FEATURE_OutlineTex), then `fd.col *= _OutlineColor`.
 */
export const tslOutlineColor = (inputs: LilToonShadingInputs): Vec4 => {
	const texture = inputs.texture("_OutlineTex");
	const color = inputs.vec4("_OutlineColor");
	return texture ? texture.sample(inputs.uvMain).mul(color) : color;
};

/**
 * The outline lighting, lil_pass_forward_normal.hlsl:255:
 * `lerp(fd.col.rgb, fd.col.rgb * min(fd.lightColor + fd.addLightColor, _LightMaxLimit), _OutlineEnableLighting)`.
 * `lightColor` is already within the light limit.
 */
export const tslOutlineLight = (
	albedo: Vec3,
	lightColor: Vec3,
	enable: Float,
): Vec3 => mix(albedo, albedo.mul(lightColor), enable);
