// Ports lilGetShading of lilToon 2.3.4 lil_common_frag.hlsl and LIL_CORRECT_LIGHTCOLOR of lil_common_macro.hlsl to TSL.
import { LightingModel } from "three/webgpu";
import type {
	LightingModelDirectInput,
	Node,
	NodeBuilder,
	TextureNode,
} from "three/webgpu";
import {
	abs,
	clamp,
	dFdx,
	dFdy,
	diffuseColor,
	dot,
	float,
	frontFacing,
	fwidth,
	max,
	min,
	mix,
	normalView,
	saturate,
	select,
	uv,
	vec2,
	vec3,
	vec4,
} from "three/tsl";
import type { LilToonFeatureSet } from "../material/LilToonFeatureSet.js";
import type { LilToonNodeMaterial } from "./LilToonNodeMaterial.js";
import { BAND_EPSILON, UNITY_LIGHT_SCALE } from "./lilToonMath.js";

type Float = Node<"float">;
type Vec3 = Node<"vec3">;
type Vec4 = Node<"vec4">;
type Scalar = Float | number;

/**
 * What the lighting model reads from its material while it builds. `setupLightingModel()` makes a new one for each
 * build, so a later build of the same material does not change the state of a build that is still running.
 */
export interface LilToonLightingHost {
	/** The light nodes whose shadow AnalyticLightNode gave to `getShadow` instead of the light color. */
	shadowed: ReadonlySet<object>;
	features: ReadonlySet<keyof LilToonFeatureSet>;
	hasTexture(name: string): boolean;
	receivedShadow(shadow: Float): Float;
	roomIrradiance(irradiance: Vec3, iblIrradiance: Vec3): Vec3 | null;
}

type LightNode = { shadowNode?: Float | null };
type Context = {
	irradiance: Vec3;
	iblIrradiance: Vec3;
	outgoingLight: Vec3;
};

// One TSL function for each function of lilToonMath.ts.

/** lilHalfLambert. */
export const tslHalfLambert = (nDotL: Float): Float =>
	saturate(nDotL.mul(0.5).add(0.5));

/** lilReceive. */
export const tslReceive = (ln: Float, shadow: Float, receive: Float): Float =>
	ln.mul(mix(float(1), saturate(shadow), receive));

/** lilBandNoSaturate. */
export const tslBandNoSaturate = (
	nl: Float,
	border: Float,
	blur: Float,
	borderRange: Scalar = 0,
	aa: Scalar = 0,
): Float => {
	const borderMin = saturate(border.sub(blur.mul(0.5)).sub(borderRange));
	const borderMax = saturate(border.add(blur.mul(0.5)));
	return nl
		.sub(borderMin)
		.div(max(saturate(borderMax.sub(borderMin).add(aa)), BAND_EPSILON));
};

/** lilBand. For the LIL_ANTIALIAS_MODE 1 term, pass `aa = fwidth(nl).mul(_AAStrength)`. */
export const tslBand = (
	nl: Float,
	border: Float,
	blur: Float,
	borderRange: Scalar = 0,
	aa: Scalar = 0,
): Float => saturate(tslBandNoSaturate(nl, border, blur, borderRange, aa));

/** lilAOShift. */
export const tslAOShift = (mask: Vec3, shift: Vec4, shift2: Vec4): Vec3 =>
	vec3(
		saturate(mask.x.mul(shift.x).add(shift.y)),
		saturate(mask.y.mul(shift.z).add(shift.w)),
		saturate(mask.z.mul(shift2.x).add(shift2.y)),
	);

type Three<T> = readonly [T, T, T];

export interface TslShadowBandsInput {
	ln: Three<Float>;
	border: Three<Float>;
	blur: Three<Float>;
	blurMask: Vec3;
	borderRange: Float;
	ao: Vec3;
	/** `_ShadowPostAO`; not 0 is true. */
	postAO: Float;
	/** `_AAStrength`. The anti-aliasing term of each band is `fwidth(value) * _AAStrength`, as in the HLSL. */
	aaStrength: Float;
	/** LIL_FEATURE_SHADOW_3RD. Without it the third band stays 1, as lns.z does. */
	third: boolean;
}

/** lilShadowBands. The line numbers are in lilToonMath.ts. */
export const tslShadowBands = (input: TslShadowBandsInput): Vec4 => {
	const { ao, blurMask } = input;
	const post = input.postAO.notEqual(0);
	const masks = [ao.x, ao.y, ao.z] as const;
	const scales = [blurMask.x, blurMask.y, blurMask.z] as const;
	const ln = input.ln.map((value, i) =>
		select(post, value, value.mul(masks[i]!)),
	);
	const band = (i: number, range: Scalar = 0): Float =>
		tslBandNoSaturate(
			ln[i]!,
			input.border[i]!,
			input.blur[i]!.mul(scales[i]!),
			range,
			fwidth(ln[i]!).mul(input.aaStrength),
		);
	const bands = vec4(
		band(0),
		band(1),
		input.third ? band(2) : float(1),
		band(0, input.borderRange),
	);
	return saturate(
		bands.mul(select(post, vec4(ao.x, ao.y, ao.z, ao.x), vec4(1))),
	);
};

/** lilGray. */
export const tslGray = (color: Vec3): Float => dot(color, vec3(1 / 3));

/** lilLimitLight. */
export const tslLimitLight = (
	color: Vec3,
	minLimit: Float,
	maxLimit: Float,
	monochrome: Float,
): Vec3 => {
	const clamped = clamp(color, vec3(minLimit), vec3(maxLimit));
	return mix(clamped, vec3(tslGray(clamped)), monochrome);
};

export interface TslShadeInput {
	albedo: Vec3;
	light: Vec3;
	environment: Vec3;
	bands: Vec4;
	shadowStrength: Float;
	shadowColor: Vec3;
	shadowColorTex: Vec4;
	shadow2ndColor: Vec4;
	shadow2ndColorTex: Vec4;
	shadow3rdColor: Vec4 | null;
	shadow3rdColorTex: Vec4;
	shadowMainStrength: Float;
	shadowEnvStrength: Float;
	shadowBorderColor: Vec3;
}

/** lilShade. The line numbers are in lilToonMath.ts. */
export const tslShade = (input: TslShadeInput): Vec3 => {
	const { albedo, light, bands } = input;
	const first = mix(float(1), bands.x, input.shadowStrength);
	const tinted = (color: Vec3, tex: Vec4): Vec3 =>
		mix(albedo, tex.rgb, tex.a).mul(color);
	let indirect = tinted(input.shadowColor, input.shadowColorTex);
	indirect = mix(
		indirect,
		tinted(input.shadow2ndColor.rgb, input.shadow2ndColorTex),
		input.shadow2ndColor.a.sub(bands.y.mul(input.shadow2ndColor.a)),
	);
	if (input.shadow3rdColor)
		indirect = mix(
			indirect,
			tinted(input.shadow3rdColor.rgb, input.shadow3rdColorTex),
			input.shadow3rdColor.a.sub(bands.z.mul(input.shadow3rdColor.a)),
		);
	indirect = mix(indirect, indirect.mul(albedo), input.shadowMainStrength);
	const direct = albedo.mul(light);
	indirect = indirect.mul(light);
	indirect = mix(
		indirect,
		albedo,
		saturate(input.environment.mul(input.shadowEnvStrength)),
	);
	indirect = min(indirect, direct);
	indirect = mix(indirect, direct, input.shadowBorderColor.mul(bands.w));
	return mix(indirect, direct, first);
};

/**
 * The lilToon lighting of LilToonNodeMaterial.
 *
 * Unity lilToon shades one main light (the directional light plus the SH ambient) with the bands. This model shades
 * each three light with its own bands and sums them: `direct()` adds the light color × UNITY_LIGHT_SCALE to a summed
 * light, and its bands × lilGray(light color) to a band sum. `finish()` divides the band sum by the summed weight
 * and shades the summed light once, as lilGetShading shades the main light. With one light this is the Unity result.
 */
export class LilToonLightingModel extends LightingModel {
	readonly material: LilToonNodeMaterial;
	readonly #host: LilToonLightingHost;
	#light: Vec3 = vec3();
	#weight: Float = float();
	#bands: Vec4 = vec4();
	#ambient: Vec3 = vec3();
	#blurMask: Vec4 = vec4(1);
	#borderMask: Vec4 = vec4(1);

	constructor(material: LilToonNodeMaterial, host: LilToonLightingHost) {
		super();
		this.material = material;
		this.#host = host;
	}

	override start(builder: NodeBuilder): void {
		this.#light = vec3().toVar("lilLight");
		this.#weight = float().toVar("lilLightWeight");
		this.#bands = vec4().toVar("lilBands");
		this.#ambient = vec3().toVar("lilAmbient");
		if (this.#host.features.has("shadow")) {
			// One sample of each mask for all lights.
			this.#blurMask = this.#maskVar("_ShadowBlurMask", "lilShadowBlurMask");
			this.#borderMask = this.#maskVar(
				"_ShadowBorderMask",
				"lilShadowBorderMask",
			);
		}
		super.start(builder);
	}

	override direct(input: LightingModelDirectInput): void {
		const { lightDirection, lightColor } = input as unknown as {
			lightDirection: Vec3;
			lightColor: Vec3;
		};
		const host = this.#host;
		const color = lightColor.mul(UNITY_LIGHT_SCALE);
		this.#light.addAssign(color);
		if (!host.features.has("shadow")) return;

		const p = this.#float;
		const v4 = this.#vec4;
		const lightNode = input.lightNode as unknown as LightNode;
		const shadowNode = host.shadowed.has(lightNode)
			? lightNode.shadowNode
			: null;
		const shadow = shadowNode ? host.receivedShadow(shadowNode) : float(1);
		const third = host.features.has("shadow3rd");
		// lil_common_frag.hlsl:948-951
		const ln = tslHalfLambert(normalView.dot(lightDirection));
		// lil_common_frag.hlsl:975-979
		const receive = (name: string) => tslReceive(ln, shadow, p(name));
		// lil_common_frag.hlsl:983-1033
		const bands = tslShadowBands({
			ln: [
				receive("_ShadowReceive"),
				receive("_Shadow2ndReceive"),
				third ? receive("_Shadow3rdReceive") : float(1),
			],
			border: [
				p("_ShadowBorder"),
				p("_Shadow2ndBorder"),
				p("_Shadow3rdBorder"),
			],
			blur: [p("_ShadowBlur"), p("_Shadow2ndBlur"), p("_Shadow3rdBlur")],
			blurMask: this.#blurMask.rgb,
			borderRange: p("_ShadowBorderRange"),
			ao: tslAOShift(
				this.#borderMask.rgb,
				v4("_ShadowAOShift"),
				v4("_ShadowAOShift2"),
			),
			postAO: p("_ShadowPostAO"),
			aaStrength: p("_AAStrength"),
			third,
		});
		// lil_common_frag.hlsl:1038-1044
		const facing = select(
			frontFacing,
			float(1),
			float(1).sub(p("_BackfaceForceShadow")),
		);
		const weight = tslGray(color);
		this.#weight.addAssign(weight);
		this.#bands.addAssign(bands.mul(facing).mul(weight));
		// Task 6 adds the backlight of this light (lilGetBacklight) here.
	}

	override indirect(builder: NodeBuilder): void {
		const { irradiance, iblIrradiance } = builder.context as unknown as Context;
		const room =
			this.#host.roomIrradiance(irradiance, iblIrradiance) ?? irradiance;
		// The ambient in lilToon light units: BRDF_Lambert, irradiance / PI, as the MToon indirectDiffuse.
		this.#ambient.assign(room.mul(1 / Math.PI));
	}

	override finish(builder: NodeBuilder): void {
		const p = this.#float;
		const albedo = (diffuseColor as unknown as Vec4).rgb;
		const asUnlit = p("_AsUnlit");
		// lil_common_macro.hlsl:2086-2088
		const light = mix(
			tslLimitLight(
				this.#light,
				p("_LightMinLimit"),
				p("_LightMaxLimit"),
				p("_MonochromeLighting"),
			),
			vec3(1),
			asUnlit,
		);
		// lil_common_frag.hlsl:1137 without `_UseShadow`.
		const lit = this.#host.features.has("shadow")
			? this.#shade(albedo, light)
			: albedo.mul(light);
		// Unity lilToon adds the SH ambient to the main light before the limit. Here it is a separate Lambert term,
		// so a subclass can change it through roomIrradiance(). `_AsUnlit` removes it, as the lerp to 1 does in Unity.
		const ambient = albedo.mul(this.#ambient).mul(float(1).sub(asUnlit));
		const { outgoingLight } = builder.context as unknown as Context;
		outgoingLight.addAssign(lit.add(ambient));
	}

	#shade(albedo: Vec3, light: Vec3): Vec3 {
		const p = this.#float;
		const v4 = this.#vec4;
		// lil_common_frag.hlsl:1069-1099: a slot without a texture is 0, as without LIL_FEATURE_ShadowColorTex.
		const color = (name: string): Vec4 =>
			this.#host.hasTexture(name)
				? this.#texture(name).sample(this.#uvMain())
				: vec4(0);
		// The band sum over the weight. A scene without a direct light is lit.
		const bands = select(
			this.#weight.greaterThan(0),
			this.#bands.div(max(this.#weight, BAND_EPSILON)),
			vec4(1),
		);
		return tslShade({
			albedo,
			light,
			environment: this.#ambient,
			bands,
			// lil_common_frag.hlsl:1049 and 1064 (`_ShadowMaskType` 0).
			shadowStrength: p("_ShadowStrength").mul(
				this.#mask("_ShadowStrengthMask").r,
			),
			shadowColor: v4("_ShadowColor").rgb,
			shadowColorTex: color("_ShadowColorTex"),
			shadow2ndColor: v4("_Shadow2ndColor"),
			shadow2ndColorTex: color("_Shadow2ndColorTex"),
			shadow3rdColor: this.#host.features.has("shadow3rd")
				? v4("_Shadow3rdColor")
				: null,
			shadow3rdColorTex: color("_Shadow3rdColorTex"),
			shadowMainStrength: p("_ShadowMainStrength"),
			shadowEnvStrength: p("_ShadowEnvStrength"),
			shadowBorderColor: v4("_ShadowBorderColor").rgb,
		});
	}

	/**
	 * A shadow mask at the main UV, with the gradient clamp of its LOD property, lil_common_frag.hlsl:935-943,
	 * 989-995, and 1004-1010: `LIL_SAMPLE_2D_GRAD(tex, uvMain, max(fd.ddxMain, LOD), max(fd.ddyMain, LOD))`, where
	 * `fd.ddxMain = abs(ddx(fd.uvMain))` (289). A slot without a texture is the white neutral texture, 1.
	 */
	#mask(name: string): Vec4 {
		if (!this.#host.hasTexture(name)) return vec4(1);
		const uvMain = this.#uvMain();
		const lod = vec2(this.#float(`${name}LOD`));
		return this.#texture(name)
			.sample(uvMain)
			.grad(max(abs(dFdx(uvMain)), lod), max(abs(dFdy(uvMain)), lod));
	}

	#maskVar(name: string, variable: string): Vec4 {
		if (!this.#host.hasTexture(name)) return vec4(1);
		const value = vec4().toVar(variable);
		value.assign(this.#mask(name));
		return value;
	}

	#uvMain(): Node<"vec2"> {
		const st = this.#vec4("_MainTex_ST");
		return uv().mul(st.xy).add(st.zw);
	}

	#texture = (name: string): TextureNode<"vec4"> =>
		this.material.textureNode(name) as TextureNode<"vec4">;
	#float = (name: string): Float => this.material.propertyNode(name, "float");
	#vec4 = (name: string): Vec4 => this.material.propertyNode(name, "vec4");
}
