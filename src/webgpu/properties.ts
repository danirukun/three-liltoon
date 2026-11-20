import {
	LILTOON_DEFAULTS,
	LILTOON_MODE_DEFAULTS,
} from "../generated/defaults.js";
import {
	detectLilToonFeatures,
	type LilToonFeatureSet,
} from "../material/LilToonFeatureSet.js";
import {
	isShaderVariant,
	shaderVariants,
	type LilToonShaderVariant,
} from "../material/shaderVariants.js";
import type { LilToonWarning } from "../utils/materialWarnings.js";
import type { Color, Texture, Vector2, Vector3, Vector4 } from "three";
import { isLilBlendMode } from "./lilToonMath.js";

// Same shape as the WebGL material type. That module name is banned in src/webgpu.
export type LilToonScalarOrVector =
	number | boolean | number[] | Color | Vector2 | Vector3 | Vector4;
export type LilToonNodeValue = number | number[];
export type LilToonNodeMode = "opaque" | "cutout" | "transparent";

export interface LilToonNodeVariant {
	variant: LilToonShaderVariant;
	mode: LilToonNodeMode;
	outline: boolean;
	warning: string | null;
}

/** Features the node material draws. Any other enabled feature gives a warning. */
export const LILTOON_NODE_FEATURES: ReadonlySet<keyof LilToonFeatureSet> =
	new Set<keyof LilToonFeatureSet>([
		"shadow",
		"shadow3rd",
		"normal1st",
		"matcap",
		"rim",
		"emission1st",
		"backlight",
		"outline",
	]);

export const LILTOON_NODE_VARIANTS: ReadonlySet<LilToonShaderVariant> =
	new Set<LilToonShaderVariant>([
		"lilToon",
		"Hidden/lilToonOutline",
		"Hidden/lilToonCutout",
		"Hidden/lilToonCutoutOutline",
		"Hidden/lilToonTransparent",
		"Hidden/lilToonTransparentOutline",
		"Hidden/lilToonOnePassTransparent",
		"Hidden/lilToonOnePassTransparentOutline",
	]);

const FEATURE_PROPERTY: Record<keyof LilToonFeatureSet, string> = {
	main2nd: "_UseMain2ndTex",
	main3rd: "_UseMain3rdTex",
	shadow: "_UseShadow",
	shadow3rd: "_UseShadow",
	normal1st: "_UseBumpMap",
	normal2nd: "_UseBump2ndMap",
	matcap: "_UseMatCap",
	matcap2nd: "_UseMatCap2nd",
	rim: "_UseRim",
	emission1st: "_UseEmission",
	emission2nd: "_UseEmission2nd",
	reflection: "_UseReflection",
	anisotropy: "_UseAnisotropy",
	backlight: "_UseBacklight",
	outline: "shaderVariant",
	dissolve: "_DissolveParams",
};

/**
 * Properties whose non-zero values the node path does not draw, by the feature that reads them: the shadow types
 * (lil_common_frag.hlsl:953-971, 1053-1061, 1072-1087), the rim direction (LIL_FEATURE_RIMLIGHT_DIRECTION,
 * 1647-1695), the matcap normal map (1527-1535), and the emission UV mode and gradation (1823-1857).
 */
const UNSUPPORTED_VALUES: readonly (readonly [
	keyof LilToonFeatureSet,
	string,
])[] = [
	["shadow", "_ShadowMaskType"],
	["shadow", "_ShadowColorType"],
	["rim", "_RimDirStrength"],
	["matcap", "_MatCapCustomNormal"],
	["emission1st", "_EmissionMap_UVMode"],
	["emission1st", "_EmissionUseGrad"],
];

const OUTLINE_UNSUPPORTED_VALUES = ["_OutlineVertexR2Width", "_OutlineZBias"];

/** The lilBlendColor mode of each feature (lil_common_functions.hlsl:325-335). */
const BLEND_MODES: readonly (readonly [keyof LilToonFeatureSet, string])[] = [
	["matcap", "_MatCapBlendMode"],
	["rim", "_RimBlendMode"],
	["emission1st", "_EmissionBlendMode"],
];

const IDENTITY_ST = [1, 1, 0, 0] as const;

/** Properties the node path reads that the generated defaults do not list: the `<texture>_ST` of LIL_SAMPLE_2D_ST. */
const NODE_EXTRA_DEFAULTS: Readonly<Record<string, readonly number[]>> = {
	_MainTex_ST: IDENTITY_ST,
	_BumpMap_ST: IDENTITY_ST,
	_MatCapTex_ST: IDENTITY_ST,
	_MatCapBlendMask_ST: IDENTITY_ST,
	_RimColorTex_ST: IDENTITY_ST,
	_BacklightColorTex_ST: IDENTITY_ST,
	_EmissionMap_ST: IDENTITY_ST,
	_EmissionBlendMask_ST: IDENTITY_ST,
	_OutlineTex_ST: IDENTITY_ST,
};

export function nodeVariant(name: string | undefined): LilToonNodeVariant {
	if (name === undefined)
		return {
			variant: "lilToon",
			mode: "opaque",
			outline: false,
			warning: null,
		};
	if (!isShaderVariant(name))
		return {
			variant: "lilToon",
			mode: "opaque",
			outline: false,
			warning: `Unknown lilToon shader ${name}. The material uses lilToon.`,
		};
	const [renderMode, , outline] = shaderVariants[name];
	if (LILTOON_NODE_VARIANTS.has(name))
		return {
			variant: name,
			mode: renderMode as LilToonNodeMode,
			outline,
			warning: null,
		};
	return {
		variant: "lilToon",
		mode: "opaque",
		outline,
		warning: `${name} is not implemented for WebGPU. The material uses lilToon.`,
	};
}

const isFiniteNumber = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value);

/** The value as a number or a number array, or null when it has no shape the node path reads. */
const toArray = (value: unknown): LilToonNodeValue | null => {
	if (typeof value === "boolean") return value ? 1 : 0;
	if (isFiniteNumber(value)) return value;
	if (Array.isArray(value))
		return value.every(isFiniteNumber) ? [...value] : null;
	if (value === null || typeof value !== "object") return null;
	if ((value as Color).isColor === true) {
		const color = value as Color;
		return [color.r, color.g, color.b];
	}
	if (typeof (value as Vector4).toArray !== "function") return null;
	const array: unknown = (value as Vector4).toArray();
	return Array.isArray(array) && array.every(isFiniteNumber) ? array : null;
};

const describeValue = (value: unknown): string => {
	if (value === null) return "null";
	if (Array.isArray(value)) return `an array of ${value.length}`;
	if (typeof value === "string") return `the string "${value}"`;
	if (typeof value === "number") return `the number ${value}`;
	if (typeof value === "object") return "an object";
	return `a ${typeof value}`;
};

const describeTemplate = (template: LilToonNodeValue): string =>
	Array.isArray(template)
		? `a vector of ${template.length} (${template.join(", ")})`
		: `the number ${template}`;

export type NodeValueCheck =
	| { value: LilToonNodeValue; message?: undefined }
	| { value?: undefined; message: string };

/**
 * The node value of an untrusted property value against the default of the property, or the message that says why the
 * value does not fit. A boolean is 0 or 1, a Color or a Vector is its components, and a short array keeps the rest of
 * the default. A value of another type, an array with an entry that is not a finite number, a scalar for a vector,
 * a vector for a scalar, or an array longer than the default does not fit. A name without a default takes a finite
 * number or an array of 2 to 4.
 */
export function checkNodeValue(
	name: string,
	value: unknown,
	template: LilToonNodeValue | undefined,
): NodeValueCheck {
	const result = toArray(value);
	const given = describeValue(value);
	if (template === undefined) {
		if (
			result !== null &&
			(!Array.isArray(result) || (result.length >= 2 && result.length <= 4))
		)
			return { value: result };
		return {
			message: `${name} is ${given}, and a lilToon property is a number or a vector of 2 to 4. The material ignores it.`,
		};
	}
	const fallback = `The material uses the default ${describeTemplate(template)}.`;
	if (result === null)
		return {
			message: `${name} is ${given}, and the property is ${describeTemplate(template)}. ${fallback}`,
		};
	if (!Array.isArray(template)) {
		if (!Array.isArray(result)) return { value: result };
		return {
			message: `${name} is ${given}, and the property is a number. ${fallback}`,
		};
	}
	if (!Array.isArray(result) || result.length > template.length)
		return {
			message: `${name} is ${given}, and the property is a vector of ${template.length}. ${fallback}`,
		};
	for (let i = result.length; i < template.length; i++)
		result.push(template[i]!);
	return { value: result };
}

/** Convert to a number or array. A short array keeps the rest of the template. A value of a wrong shape throws. */
export function normalizeNodeValue(
	value: LilToonScalarOrVector,
	template?: LilToonNodeValue,
): LilToonNodeValue {
	const checked = checkNodeValue("The value", value, template);
	if (checked.message !== undefined) throw new TypeError(checked.message);
	return checked.value;
}

/** Called once for each property whose value does not fit, with the message of checkNodeValue. */
export type InvalidNodeValue = (name: string, message: string) => void;

const modeDefaults = (mode: string): Record<string, LilToonNodeValue> => {
	const defaults: Record<string, LilToonNodeValue> = {};
	const sources: Record<string, unknown>[] = [
		LILTOON_DEFAULTS,
		LILTOON_MODE_DEFAULTS[mode] ?? {},
		NODE_EXTRA_DEFAULTS,
	];
	for (const source of sources)
		for (const [name, value] of Object.entries(source))
			if (typeof value === "number" || Array.isArray(value))
				defaults[name] = Array.isArray(value) ? [...value] : value;
	return defaults;
};

/**
 * The defaults of the variant with the given values over them. A value of a wrong shape keeps the default and goes to
 * `onInvalid`, so an untrusted file never fails the load.
 */
export function nodeProperties(
	variant: LilToonShaderVariant,
	properties: Record<string, LilToonScalarOrVector>,
	onInvalid?: InvalidNodeValue,
): Record<string, LilToonNodeValue> {
	const result = modeDefaults(shaderVariants[variant][0]);
	for (const [name, value] of Object.entries(properties)) {
		const checked = checkNodeValue(name, value, result[name]);
		if (checked.message !== undefined) onInvalid?.(name, checked.message);
		else result[name] = checked.value;
	}
	return result;
}

export function enabledNodeFeatures(
	variant: LilToonShaderVariant,
	properties: Record<string, LilToonNodeValue>,
): (keyof LilToonFeatureSet)[] {
	const features = detectLilToonFeatures(properties as never, variant);
	return (Object.keys(features) as (keyof LilToonFeatureSet)[]).filter(
		(name) => features[name],
	);
}

export function nodeWarnings(
	name: string,
	properties: Record<string, LilToonScalarOrVector>,
	_textures: Record<string, Texture | null>,
	shaderVariant?: string,
): LilToonWarning[] {
	const selection = nodeVariant(shaderVariant);
	const shaderKey = shaderVariant ?? selection.variant;
	const warnings: LilToonWarning[] = [];
	if (selection.warning)
		warnings.push({
			severity: "warning",
			code: "unsupported-shader-variant",
			materialName: name,
			shaderKey,
			property: "shaderVariant",
			message: selection.warning,
		});
	const merged = nodeProperties(selection.variant, properties);
	for (const feature of enabledNodeFeatures(selection.variant, merged)) {
		if (LILTOON_NODE_FEATURES.has(feature)) continue;
		const property = FEATURE_PROPERTY[feature];
		warnings.push({
			severity: "warning",
			code: "unsupported-feature",
			materialName: name,
			shaderKey,
			property,
			message: `${property} is enabled, but the WebGPU material does not implement it. The model will load without this feature.`,
		});
	}
	const enabled = new Set(enabledNodeFeatures(selection.variant, merged));
	const warn = (property: string, message: string) =>
		warnings.push({
			severity: "warning",
			code: "unsupported-feature",
			materialName: name,
			shaderKey,
			property,
			message,
		});
	// Values the node path draws as 0, such as the flat and face (SDF) shadow mask types.
	for (const [feature, property] of UNSUPPORTED_VALUES) {
		const value = merged[property];
		if (!enabled.has(feature) || typeof value !== "number" || value === 0)
			continue;
		warn(
			property,
			`${property} ${value} is not implemented for WebGPU. The material draws it as ${property} 0.`,
		);
	}
	// lilCalcOutlinePosition, lil_common_functions.hlsl:298-310: the vertex color width and the view bias.
	for (const property of OUTLINE_UNSUPPORTED_VALUES) {
		const value = merged[property];
		if (!selection.outline || typeof value !== "number" || value === 0)
			continue;
		warn(
			property,
			`${property} ${value} is not implemented for WebGPU. The outline draws it as ${property} 0.`,
		);
	}
	for (const [feature, property] of BLEND_MODES) {
		const value = merged[property];
		if (!enabled.has(feature) || typeof value !== "number") continue;
		if (isLilBlendMode(value)) continue;
		warn(
			property,
			`${property} ${value} is not a lilToon blend mode (0-3). The material uses 0.`,
		);
	}
	return warnings;
}
