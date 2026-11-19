// Ports lilGetShading of lilToon 2.3.4 lil_common_frag.hlsl and LIL_CORRECT_LIGHTCOLOR of lil_common_macro.hlsl to TSL.
import { LightingModel } from "three/webgpu";
import type {
	LightingModelDirectInput,
	Node,
	NodeBuilder,
	TextureNode,
} from "three/webgpu";
import {
	clamp,
	diffuseColor,
	dot,
	float,
	frontFacing,
	max,
	min,
	mix,
	normalView,
	saturate,
	select,
	uv,
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

/** What the lighting model reads from its material while it builds. The material makes a new one for each build. */
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

/** lilBand. */
export const tslBand = (
	nl: Float,
	border: Float,
	blur: Float,
	borderRange: Scalar = 0,
): Float => {
	const borderMin = saturate(border.sub(blur.mul(0.5)).sub(borderRange));
	const borderMax = saturate(border.add(blur.mul(0.5)));
	return saturate(
		nl
			.sub(borderMin)
			.div(max(saturate(borderMax.sub(borderMin)), BAND_EPSILON)),
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
	#host: LilToonLightingHost | null = null;
	#light: Vec3 = vec3();
	#weight: Float = float();
	#bands: Vec4 = vec4();
	#ambient: Vec3 = vec3();

	constructor(material: LilToonNodeMaterial) {
		super();
		this.material = material;
	}

	override start(builder: NodeBuilder): void {
		this.#host = this.material.lightingHost();
		this.#light = vec3().toVar("lilLight");
		this.#weight = float().toVar("lilLightWeight");
		this.#bands = vec4().toVar("lilBands");
		this.#ambient = vec3().toVar("lilAmbient");
		super.start(builder);
	}

	override direct(input: LightingModelDirectInput): void {
		const { lightDirection, lightColor } = input as unknown as {
			lightDirection: Vec3;
			lightColor: Vec3;
		};
		const host = this.#requireHost();
		const color = lightColor.mul(UNITY_LIGHT_SCALE);
		this.#light.addAssign(color);
		if (!host.features.has("shadow")) return;

		const p = this.#float;
		const lightNode = input.lightNode as unknown as LightNode;
		const shadowNode = host.shadowed.has(lightNode)
			? lightNode.shadowNode
			: null;
		const shadow = shadowNode ? host.receivedShadow(shadowNode) : float(1);
		// lil_common_frag.hlsl:948-951
		const ln = tslHalfLambert(normalView.dot(lightDirection));
		// lil_common_frag.hlsl:975-979
		const ln1 = tslReceive(ln, shadow, p("_ShadowReceive"));
		const ln2 = tslReceive(ln, shadow, p("_Shadow2ndReceive"));
		// lil_common_frag.hlsl:1028-1033
		const first = tslBand(ln1, p("_ShadowBorder"), p("_ShadowBlur"));
		const second = tslBand(ln2, p("_Shadow2ndBorder"), p("_Shadow2ndBlur"));
		const range = tslBand(
			ln1,
			p("_ShadowBorder"),
			p("_ShadowBlur"),
			p("_ShadowBorderRange"),
		);
		const third = host.features.has("shadow3rd")
			? tslBand(
					tslReceive(ln, shadow, p("_Shadow3rdReceive")),
					p("_Shadow3rdBorder"),
					p("_Shadow3rdBlur"),
				)
			: float(1);
		// lil_common_frag.hlsl:1038-1044
		const facing = select(
			frontFacing,
			float(1),
			float(1).sub(p("_BackfaceForceShadow")),
		);
		const weight = tslGray(color);
		this.#weight.addAssign(weight);
		this.#bands.addAssign(
			vec4(first, second, third, range).mul(facing).mul(weight),
		);
		// Task 6 adds the backlight of this light (lilGetBacklight) here.
	}

	override indirect(builder: NodeBuilder): void {
		const { irradiance, iblIrradiance } = builder.context as unknown as Context;
		const host = this.#requireHost();
		const room = host.roomIrradiance(irradiance, iblIrradiance) ?? irradiance;
		// The ambient in lilToon light units: BRDF_Lambert, irradiance / PI, as the MToon indirectDiffuse.
		this.#ambient.assign(room.mul(1 / Math.PI));
	}

	override finish(builder: NodeBuilder): void {
		const host = this.#requireHost();
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
		const lit = host.features.has("shadow")
			? this.#shade(host, albedo, light)
			: albedo.mul(light);
		// Unity lilToon adds the SH ambient to the main light before the limit. Here it is a separate Lambert term,
		// so a subclass can change it through roomIrradiance(). `_AsUnlit` removes it, as the lerp to 1 does in Unity.
		const ambient = albedo.mul(this.#ambient).mul(float(1).sub(asUnlit));
		const { outgoingLight } = builder.context as unknown as Context;
		outgoingLight.addAssign(lit.add(ambient));
	}

	#shade(host: LilToonLightingHost, albedo: Vec3, light: Vec3): Vec3 {
		const p = this.#float;
		const v4 = (name: string) => this.material.propertyNode(name, "vec4");
		const uvMain = uv().mul(v4("_MainTex_ST").xy).add(v4("_MainTex_ST").zw);
		// lil_common_frag.hlsl:1069-1099: a slot without a texture is 0, as without LIL_FEATURE_ShadowColorTex.
		const sample = (name: string): Vec4 =>
			host.hasTexture(name)
				? (this.material.textureNode(name) as TextureNode<"vec4">).sample(
						uvMain,
					)
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
			shadowStrength: p("_ShadowStrength"),
			shadowColor: v4("_ShadowColor").rgb,
			shadowColorTex: sample("_ShadowColorTex"),
			shadow2ndColor: v4("_Shadow2ndColor"),
			shadow2ndColorTex: sample("_Shadow2ndColorTex"),
			shadow3rdColor: host.features.has("shadow3rd")
				? v4("_Shadow3rdColor")
				: null,
			shadow3rdColorTex: sample("_Shadow3rdColorTex"),
			shadowMainStrength: p("_ShadowMainStrength"),
			shadowEnvStrength: p("_ShadowEnvStrength"),
			shadowBorderColor: v4("_ShadowBorderColor").rgb,
		});
	}

	#float = (name: string): Float => this.material.propertyNode(name, "float");

	#requireHost(): LilToonLightingHost {
		if (!this.#host)
			throw new Error("LilToonLightingModel.start was not called");
		return this.#host;
	}
}
