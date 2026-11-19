import { Color, Vector2, Vector3, Vector4, Texture } from 'three';
import { NodeMaterial, LightingModel, NodeBuilder, Node, UniformNode, TextureNode as TextureNode$1, LightingModelDirectInput } from 'three/webgpu';

/** Supported Unity shader names and their pass configurations. */
declare const shaderVariants: {
    readonly lilToon: readonly ["opaque", "normal", false];
    readonly "Hidden/lilToonOutline": readonly ["opaque", "normal", true];
    readonly "Hidden/lilToonCutout": readonly ["cutout", "normal", false];
    readonly "Hidden/lilToonCutoutOutline": readonly ["cutout", "normal", true];
    readonly "Hidden/lilToonTransparent": readonly ["transparent", "normal", false];
    readonly "Hidden/lilToonTransparentOutline": readonly ["transparent", "normal", true];
    readonly "Hidden/lilToonOnePassTransparent": readonly ["transparent", "one-pass", false];
    readonly "Hidden/lilToonOnePassTransparentOutline": readonly ["transparent", "one-pass", true];
    readonly "Hidden/lilToonTwoPassTransparent": readonly ["transparent", "two-pass", false];
    readonly "Hidden/lilToonTwoPassTransparentOutline": readonly ["transparent", "two-pass", true];
    readonly "Hidden/lilToonRefraction": readonly ["refraction", "normal", false];
    readonly "Hidden/lilToonRefractionBlur": readonly ["refraction-blur", "normal", false];
    readonly "Hidden/lilToonFur": readonly ["fur", "normal", false];
    readonly "Hidden/lilToonFurCutout": readonly ["fur-cutout", "normal", false];
    readonly "Hidden/lilToonFurTwoPass": readonly ["fur-two-pass", "normal", false];
    readonly "Hidden/lilToonGem": readonly ["gem", "normal", false];
};
type LilToonShaderVariant = keyof typeof shaderVariants;

type LilToonWarningCode = "unsupported-feature" | "unused-texture" | "texture-type-mismatch" | "spec-version-mismatch" | "unsupported-shader-variant" | "shader-mode-conflict";
/** Serializable, non-fatal compatibility diagnostic. */
interface LilToonWarning {
    severity: "warning";
    code: LilToonWarningCode;
    materialName: string;
    materialIndex?: number;
    shaderKey: string;
    property: string;
    message: string;
}

interface LilToonFeatureSet {
    main2nd: boolean;
    main3rd: boolean;
    shadow: boolean;
    shadow3rd: boolean;
    normal1st: boolean;
    normal2nd: boolean;
    matcap: boolean;
    matcap2nd: boolean;
    rim: boolean;
    emission1st: boolean;
    emission2nd: boolean;
    reflection: boolean;
    anisotropy: boolean;
    backlight: boolean;
    outline: boolean;
    dissolve: boolean;
}

type LilToonScalarOrVector = number | boolean | number[] | Color | Vector2 | Vector3 | Vector4;
type LilToonNodeValue = number | number[];
type LilToonNodeMode = "opaque" | "cutout" | "transparent";
interface LilToonNodeVariant {
    variant: LilToonShaderVariant;
    mode: LilToonNodeMode;
    outline: boolean;
    warning: string | null;
}
/** Features the node material draws. Any other enabled feature gives a warning. */
declare const LILTOON_NODE_FEATURES: ReadonlySet<keyof LilToonFeatureSet>;
declare const LILTOON_NODE_VARIANTS: ReadonlySet<LilToonShaderVariant>;
declare function nodeVariant(name: string | undefined): LilToonNodeVariant;
declare function nodeProperties(variant: LilToonShaderVariant, properties: Record<string, LilToonScalarOrVector>): Record<string, LilToonNodeValue>;
declare function nodeWarnings(name: string, properties: Record<string, LilToonScalarOrVector>, _textures: Record<string, Texture | null>, shaderVariant?: string): LilToonWarning[];

interface LilToonNodeMaterialParameters {
    name?: string;
    shaderVariant?: string;
    properties?: Record<string, LilToonScalarOrVector>;
    textures?: Record<string, Texture | null>;
}
type PropertyNodes = {
    float: UniformNode<"float">;
    vec2: UniformNode<"vec2">;
    vec3: UniformNode<"vec3">;
    vec4: UniformNode<"vec4">;
};
type PropertyType = keyof PropertyNodes;
type TextureNode = TextureNode$1<"vec4">;
declare class LilToonNodeMaterial extends NodeMaterial {
    #private;
    readonly isLilToonNodeMaterial = true;
    isOutline: boolean;
    constructor(parameters?: LilToonNodeMaterialParameters);
    get variant(): LilToonShaderVariant;
    /** One overridable place for the lighting model. A subclass supplies its own. */
    setupLightingModel(): LightingModel;
    setupLighting(builder: NodeBuilder): Node;
    /**
     * The cast shadow of one light, 1 lit and 0 in shadow, before `_ShadowReceive` folds it into the bands.
     * A subclass overrides it.
     */
    protected receivedShadow(shadow: Node<"float">): Node<"float">;
    /**
     * The irradiance of the ambient term. `irradiance` is the scene ambient (ambient, hemisphere, and probe lights);
     * `iblIrradiance` is what `setupEnvironment()` adds. `null` uses `irradiance`. A subclass overrides it.
     */
    protected roomIrradiance(_irradiance: Node<"vec3">, _iblIrradiance: Node<"vec3">): Node<"vec3"> | null;
    setProperty(name: string, value: LilToonScalarOrVector): void;
    getProperty(name: string): number | number[] | undefined;
    setTexture(name: string, value: Texture | null): void;
    getTexture(name: string): Texture;
    /** The uniform node that reads one property. Its value follows setProperty. */
    propertyNode<T extends PropertyType>(name: string, type: T): PropertyNodes[T];
    /** The texture node that samples one texture slot. Its value follows setTexture. */
    textureNode(name: string): TextureNode;
    getWarnings(): LilToonWarning[];
    customProgramCacheKey(): string;
    copy(source: LilToonNodeMaterial): this;
    /**
     * Build the nodes that read this material. The constructor and `copy` call it,
     * because NodeMaterial.copy aliases the source nodes. A subclass overrides it,
     * calls `super.setupNodes()`, and assigns its own nodes. It runs before the
     * subclass field initializers, so it must not read subclass fields.
     */
    protected setupNodes(): void;
}

type Float = Node<"float">;
type Vec3 = Node<"vec3">;
/**
 * What the lighting model reads from its material while it builds. `setupLightingModel()` makes a new one for each
 * build, so a later build of the same material does not change the state of a build that is still running.
 */
interface LilToonLightingHost {
    /** The light nodes whose shadow AnalyticLightNode gave to `getShadow` instead of the light color. */
    shadowed: ReadonlySet<object>;
    features: ReadonlySet<keyof LilToonFeatureSet>;
    hasTexture(name: string): boolean;
    receivedShadow(shadow: Float): Float;
    roomIrradiance(irradiance: Vec3, iblIrradiance: Vec3): Vec3 | null;
}
/**
 * The lilToon lighting of LilToonNodeMaterial.
 *
 * Unity lilToon shades one main light (the directional light plus the SH ambient) with the bands. This model shades
 * each three light with its own bands and sums them: `direct()` adds the light color × UNITY_LIGHT_SCALE to a summed
 * light, and its bands × lilGray(light color) to a band sum. `finish()` divides the band sum by the summed weight
 * and shades the summed light once, as lilGetShading shades the main light. With one light this is the Unity result.
 */
declare class LilToonLightingModel extends LightingModel {
    #private;
    readonly material: LilToonNodeMaterial;
    constructor(material: LilToonNodeMaterial, host: LilToonLightingHost);
    start(builder: NodeBuilder): void;
    direct(input: LightingModelDirectInput): void;
    indirect(builder: NodeBuilder): void;
    finish(builder: NodeBuilder): void;
}

type Rgb = readonly [number, number, number];
/**
 * The lilToon light color is the three light color times this scale. Task 10 calibrates it against the Unity
 * reference. The start value makes a three light of intensity PI a Unity light of intensity 1 (the Lambert 1 / PI).
 */
declare const UNITY_LIGHT_SCALE: number;
/** The lilToon shadow band: 1 lit, 0 in shadow. lil_common_functions.hlsl:77-85 (lilTooningScale). */
declare const lilBand: (nl: number, border: number, blur: number, borderRange?: number, aa?: number) => number;
/**
 * LIL_CORRECT_LIGHTCOLOR_VS without `_AsUnlit`, lil_common_macro.hlsl:2086-2087: the clamp to the light limits and the
 * monochrome mix.
 */
declare const lilLimitLight: (color: Rgb, min: number, max: number, monochrome: number) => [number, number, number];

declare class GLTFLilToonNodeExtension {
}
declare const enableLilToonNodeVRM: () => void;

export { GLTFLilToonNodeExtension, LILTOON_NODE_FEATURES, LILTOON_NODE_VARIANTS, type LilToonLightingHost, LilToonLightingModel, LilToonNodeMaterial, type LilToonNodeMaterialParameters, type LilToonNodeMode, type LilToonNodeValue, type LilToonNodeVariant, type LilToonScalarOrVector, UNITY_LIGHT_SCALE, enableLilToonNodeVRM, lilBand, lilLimitLight, nodeProperties, nodeVariant, nodeWarnings };
