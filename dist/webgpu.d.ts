import { Color, Vector2, Vector3, Vector4, Texture, Object3D, Material, Mesh } from 'three';
import { NodeMaterial, LightingModel, NodeBuilder, Node, UniformNode, TextureNode as TextureNode$1, LightingModelDirectInput } from 'three/webgpu';
import { GLTFLoaderPlugin, GLTFParser, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';

type LilToonRenderMode = "opaque" | "cutout" | "transparent" | "refraction" | "refraction-blur" | "fur" | "fur-cutout" | "fur-two-pass" | "gem";
type LilToonTransparencyMode = "normal" | "one-pass" | "two-pass";

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

type LilToonWarningCode = "unsupported-feature" | "unused-texture" | "texture-type-mismatch" | "spec-version-mismatch" | "unsupported-shader-variant" | "shader-mode-conflict"
/** A property value of a wrong type or length. The material uses the default of the property (WebGPU). */
 | "invalid-property-value";
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
/** Called once for each property whose value does not fit, with the message of checkNodeValue. */
type InvalidNodeValue = (name: string, message: string) => void;
/**
 * The defaults of the variant with the given values over them. A value of a wrong shape keeps the default and goes to
 * `onInvalid`, so an untrusted file never fails the load.
 */
declare function nodeProperties(variant: LilToonShaderVariant, properties: Record<string, LilToonScalarOrVector>, onInvalid?: InvalidNodeValue): Record<string, LilToonNodeValue>;
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
    constructor(parameters?: LilToonNodeMaterialParameters);
    get variant(): LilToonShaderVariant;
    /**
     * The material draws the outline pass: generateLilToonOutlines sets it on the clone it makes. A change sets the
     * side (BackSide for the outline, `_Cull` for the surface) and rebuilds the program.
     */
    get isOutline(): boolean;
    set isOutline(value: boolean);
    /** The requested shader has an outline pass, also when the material falls back to lilToon. */
    get hasOutline(): boolean;
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
    /** Set one property. A value of a wrong shape is ignored, and getWarnings names it until a value fits. */
    setProperty(name: string, value: LilToonScalarOrVector): void;
    getProperty(name: string): number | number[] | undefined;
    setTexture(name: string, value: Texture | null): void;
    getTexture(name: string): Texture;
    /** The uniform node that reads one property. Its value follows setProperty. */
    propertyNode<T extends PropertyType>(name: string, type: T): PropertyNodes[T];
    /** The texture node that samples one texture slot. Its value follows setTexture. */
    textureNode(name: string): TextureNode;
    /** The compatibility warnings: first each property value of a wrong shape, then the feature warnings. */
    getWarnings(): LilToonWarning[];
    customProgramCacheKey(): string;
    copy(source: LilToonNodeMaterial): this;
    /**
     * The normal: lilUnpackNormalScale of `_BumpMap` with `_BumpScale` (lil_common_frag.hlsl:870-881) through the
     * three tangent frame. Without a `tangent` attribute, NormalMapNode uses the derivative frame, and the textures
     * have flipY false, so Y is negated as GLTFLoader negates `normalScale.y` (GLTFLoader.js:3642-3645). The geometry
     * attributes are in the render object cache key, so the program key does not need the tangent. It does not
     * assign `normalNode`, so a user normalNode and a later build without the map keep working.
     */
    setupNormal(builder?: NodeBuilder): Node<"vec3">;
    /** The outline pass moves each vertex along its normal (tslOutlinePosition). */
    setupPosition(builder: NodeBuilder): Node<"vec3">;
    /** The outline pass draws `_OutlineColor` (tslOutlineColor) instead of the main color. */
    setupDiffuseColor(builder: NodeBuilder): void;
    /**
     * Build the nodes that read this material. The constructor and `copy` call it,
     * because NodeMaterial.copy aliases the source nodes. A subclass overrides it,
     * calls `super.setupNodes()`, and assigns its own nodes. It runs before the
     * subclass field initializers, so it must not read subclass fields.
     */
    protected setupNodes(): void;
}

type Float$1 = Node<"float">;
type Vec3$1 = Node<"vec3">;
/**
 * What the lighting model reads from its material while it builds. `setupLightingModel()` makes a new one for each
 * build, so a later build of the same material does not change the state of a build that is still running.
 */
interface LilToonLightingHost {
    /** The light nodes whose shadow AnalyticLightNode gave to `getShadow` instead of the light color. */
    shadowed: ReadonlySet<object>;
    features: ReadonlySet<keyof LilToonFeatureSet>;
    hasTexture(name: string): boolean;
    receivedShadow(shadow: Float$1): Float$1;
    roomIrradiance(irradiance: Vec3$1, iblIrradiance: Vec3$1): Vec3$1 | null;
    /** The material is the outline of generateLilToonOutlines. It draws the outline color only. */
    outline: boolean;
    /** LIL_RENDER == 2. */
    transparent: boolean;
    /** LIL_FEATURE_NORMAL_1ST with a `_BumpMap`: the material maps the normal, so the normal strengths apply. */
    normalMapped: boolean;
}
/**
 * The lilToon lighting of LilToonNodeMaterial.
 *
 * Unity lilToon shades one main light (the directional light plus the SH ambient) with the bands. This model shades
 * each three light with its own bands and sums them: `direct()` adds the light color × UNITY_LIGHT_SCALE to a summed
 * light, and its bands × lilGray(light color) to a band sum. `finish()` divides the band sum by the summed weight
 * and shades the summed light once, as lilGetShading shades the main light. With one light this is the Unity result.
 * The backlight factor of each light has the same weight. Rim light, matcap, and emission do not depend on the light
 * direction; `finish()` applies them once to the shaded color, with the summed light, as lilToon does.
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
/**
 * lilBlendColor, lil_common_functions.hlsl:325-340. The HLSL leaves `outCol` unset for a mode outside 0-3. This
 * port draws such a mode as 0, and nodeWarnings reports it.
 */
declare const lilBlendColor: (dst: Rgb, src: Rgb, srcA: number | Rgb, mode: number) => [number, number, number];
/**
 * lilGetOutlineWidth with `_OutlineVertexR2Width` 0, lil_common_functions.hlsl:273-290: `_OutlineWidth` is in
 * centimetres, times the `_OutlineWidthMask` red channel. `_OutlineFixWidth` narrows it within 1 m of the camera.
 */
declare const lilOutlineWidth: (width: number, mask: number, fixWidth: number, cameraDistance: number) => number;

type Float = Node<"float">;
type Vec2 = Node<"vec2">;
type Vec3 = Node<"vec3">;
type Vec4 = Node<"vec4">;
/** What the shading functions read from the material. */
interface LilToonShadingInputs {
    float(name: string): Float;
    vec4(name: string): Vec4;
    /** The texture of one slot, or null when the slot has no texture. */
    texture(name: string): TextureNode$1<"vec4"> | null;
    /** fd.uvMain: uv0 × `_MainTex_ST`. */
    uvMain: Vec2;
}
/** The part of LilToonNodeMaterial that the shading inputs read. */
interface LilToonShadingSource {
    propertyNode(name: string, type: "float"): Float;
    propertyNode(name: string, type: "vec4"): Vec4;
    textureNode(name: string): TextureNode$1<"vec4">;
}
/** The shading inputs of a material. `hasTexture` is the texture state of one build. */
declare const lilToonShadingInputs: (source: LilToonShadingSource, hasTexture: (name: string) => boolean) => LilToonShadingInputs;
/** The state of lilFragData after the lighting, which the effects read. */
interface LilToonSurface {
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
/** lilBlendColor, lil_common_functions.hlsl:325-340. A mode outside 0-3 is 0, as lilBlendColor of lilToonMath.ts. */
declare const tslBlendColor: (dst: Vec3, src: Vec3, srcA: Float | Vec3, mode: Float) => Vec3;
interface TslBacklightInput {
    inputs: LilToonShadingInputs;
    /** fd.N after `_BacklightNormalStrength` (lil_common_frag.hlsl:1238-1241). */
    normal: Vec3;
    /** fd.L of this light. */
    lightDirection: Vec3;
    /** The cast shadow of this light after receivedShadow, 1 lit. */
    shadow: Float;
}
/** The backlight of one light, lilBacklight of lil_common_frag.hlsl:1250-1257. */
declare const tslBacklight: (input: TslBacklightInput) => Float;
/** The backlight color for the factor of tslBacklight, lil_common_frag.hlsl:1244-1247 and 1260-1261. */
declare const tslBacklightColor: (s: LilToonSurface, backlight: Float) => Vec3;
/** lilGetMatCap without `_MatCapCustomNormal`, lil_common_frag.hlsl:1522-1562. */
declare const tslMatCap: (col: Vec3, s: LilToonSurface) => Vec3;
/**
 * lilGetRim, lil_common_frag.hlsl:1700-1728. The shipped passes define LIL_FEATURE_RIMLIGHT_DIRECTION
 * (ltspass_opaque.shader:671), which compiles 1647-1695. With `_RimDirStrength` 0 that branch is this one: rimDir is
 * the rim, rimIndir is 0, and `1 - E + lightColor * E` is the `_RimEnableLighting` lerp. nodeWarnings reports a
 * non-zero `_RimDirStrength`.
 */
declare const tslRim: (col: Vec3, s: LilToonSurface) => Vec3;
/**
 * lilEmission with `_EmissionMap_UVMode` 0, without the UV animation, the gradation, and AudioLink,
 * lil_common_frag.hlsl:1819-1865.
 */
declare const tslEmission: (col: Vec3, s: LilToonSurface) => Vec3;
/**
 * The outline position, lilCalcOutlinePosition with `_OutlineVertexR2Width` 0, without `_OutlineVectorTex`, and with
 * `_OutlineZBias` 0, lil_common_functions.hlsl:298-307 and 273-288. It runs in the vertex stage.
 */
declare const tslOutlinePosition: (inputs: LilToonShadingInputs, position?: Vec3) => Vec3;
/**
 * The outline color, OVERRIDE_OUTLINE_COLOR of lil_common_frag.hlsl:363-399 without the tone correction and with
 * `_OutlineLitColor.a` 0: `fd.col = _OutlineTex` (1 without LIL_FEATURE_OutlineTex), then `fd.col *= _OutlineColor`.
 * The outline pass runs OVERRIDE_ANIMATE_OUTLINE_UV first (lil_pass_forward_normal.hlsl:175-176), so fd.uvMain is
 * lilCalcUV(fd.uv0, _OutlineTex_ST, _OutlineTex_ScrollRotate) (lil_common_frag.hlsl:276-283), not the `_MainTex_ST`
 * UV. The scroll and rotation are 0 here.
 */
declare const tslOutlineColor: (inputs: LilToonShadingInputs) => Vec4;

/**
 * Give each mesh with an outline lilToon material a second material that draws the outline, as three-vrm 3.5.5
 * MToonMaterialLoaderPlugin._generateOutline does: `mesh.material = [surface, outline]`, with one geometry group for
 * each material. The outline is a clone of the surface with `isOutline` true, which also sets the back side. The material keys on
 * the outline flag of the shader variant, not on `_OutlineWidth`. A mesh whose material is already an array is left
 * unchanged, so a second call does nothing. three-vrm draws a third of the index count; this draws all of it, so the
 * count is correct for a geometry without an index too.
 */
declare function generateLilToonOutlines(root: Object3D): void;

declare const LILTOON_GLTF_EXTENSION = "MOCHIYA_materials_liltoon";
declare const LILTOON_GLTF_SPEC_VERSION = "1.3";
/**
 * A zero-based glTF index.
 * @asType integer
 * @minimum 0
 */
type GLTFIndex = number;
/** JSON property values. Colors and vectors use numeric arrays, not Three.js objects. */
type GLTFLilToonPropertyValue = number | boolean | number[];
/** A reference to a texture in the enclosing glTF document. */
interface GLTFLilToonTextureInfo {
    /** Index into the glTF textures array. */
    index: GLTFIndex;
    /**
     * Texture coordinate set. The current renderer uses TEXCOORD_0 only.
     * @default 0
     */
    texCoord?: GLTFIndex;
}
/** Linear, little-endian RGBA binary16 cubemap in glTF world coordinates. */
interface GLTFLilToonCubeTextureInfo {
    encoding: "rgba16f-linear";
    /** Square base face size; power of two. @asType integer @minimum 1 */
    size: number;
    /** Base level followed by every authored level down to 1x1, or base only.
     * Each bufferView contains six tightly packed faces: +X,-X,+Y,-Y,+Z,-Z.
     * @minItems 1
     */
    mipmaps: GLTFIndex[];
}
/** Material extension payload at materials[i].extensions.MOCHIYA_materials_liltoon. */
interface GLTFLilToonMaterialDefinition {
    /** Extension version. When omitted, the current version is assumed. */
    specVersion?: "1.0" | "1.1" | "1.2" | typeof LILTOON_GLTF_SPEC_VERSION;
    /** Source lilToon version, retained as metadata. */
    lilToonVersion?: string | number;
    /** Original Unity shader name. Supported regular names select surface, transparency and outline passes; unsupported names warn and use fallback. */
    shaderVariant?: string;
    /** Effective Unity material queue. Does not change blending or depth state.
     * @asType integer
     * @minimum 0
     * @maximum 5000
     */
    renderQueue?: number;
    /** Legacy fallback without a supported shaderVariant. Recognized shader names take precedence; new writers omit this field.
     * @deprecated
     */
    renderMode?: LilToonRenderMode;
    /** Legacy fallback without a supported shaderVariant. Recognized shader names take precedence; new writers omit this field.
     * @deprecated
     */
    transparencyMode?: LilToonTransparencyMode;
    /** Original property names and linear values, including per-texture <name>_ST transforms. */
    properties?: Record<string, GLTFLilToonPropertyValue>;
    /** Original texture property names mapped to glTF texture indices or texture-info objects. */
    textures?: Record<string, GLTFLilToonTextureInfo | GLTFIndex>;
    /** Direction-sampled resources, separate from ordinary glTF 2D textures. */
    cubeTextures?: Record<string, GLTFLilToonCubeTextureInfo>;
}

/** The default Unity queue of a transparent lilToon shader ("Queue" = "Transparent"). */
declare const LILTOON_TRANSPARENT_QUEUE = 3000;
/** A mesh that another loader ordered: its Unity render queue and the `renderOrder` it got. */
interface RenderOrderAnchor {
    queue: number;
    renderOrder: number;
}
/**
 * The `renderOrder` of a transparent mesh with a Unity render queue.
 *
 * Without anchors it is `queue - 2981`, the scheme of three-vrm 3.5.5 MToonMaterialLoaderPlugin._parseRenderOrder
 * for a VRM 1 transparent material (queue 3000 + offset gives 19 + offset). So queue 3000 gives 19, as a default
 * MToon transparent mesh.
 *
 * With anchors (the MToon meshes of the same file), the order goes between the anchors by queue. A queue equal to an
 * anchor queue gets its order. A queue between two anchors gets an order between theirs, in proportion to the queue.
 * A queue below or above all anchors gets an order less than 1 below the lowest or above the highest. Three-vrm
 * gives VRM 0 queues consecutive orders by rank, so the result is often a fraction; `renderOrder` sorts as a number.
 */
declare function lilToonRenderOrder(queue: number, anchors?: readonly RenderOrderAnchor[]): number;

/** `missing-texture`: a texture index that is not in the file or did not load. The material uses the neutral texture. */
type LilToonNodeWarningCode = LilToonWarningCode | "missing-texture";
interface LilToonNodeWarning extends Omit<LilToonWarning, "code"> {
    code: LilToonNodeWarningCode;
}
type LilToonNodeMaterialType = new (parameters?: LilToonNodeMaterialParameters) => LilToonNodeMaterial;
interface GLTFLilToonNodeExtensionOptions {
    /** The class to construct. A subclass of LilToonNodeMaterial. */
    materialType?: LilToonNodeMaterialType;
    /** Non-fatal compatibility warnings. Omit to log them to the console. */
    onWarning?: (warning: LilToonNodeWarning) => void;
}
/**
 * Loads `MOCHIYA_materials_liltoon` materials as LilToonNodeMaterial. A material without the extension falls through
 * to the next plugin. After the scene loads, it adds tangents for the normal map, adds the outline pass, sets the
 * `renderOrder` of each transparent lilToon mesh from its `renderQueue`, and publishes the warnings to `onWarning`
 * and `gltf.userData.lilToonWarnings`.
 *
 * For a VRM, register only `enableLilToonNodeVRM(new VRMLoaderPlugin(parser))`, not this plugin. Registered
 * separately next to `VRMLoaderPlugin`, the three-vrm MToon plugin also sets the render order of a lilToon mesh
 * that has an MToon fallback and lists its material in `vrm.materials`.
 */
declare class GLTFLilToonNodeExtension implements GLTFLoaderPlugin {
    #private;
    readonly parser: GLTFParser;
    readonly options: GLTFLilToonNodeExtensionOptions;
    readonly name = "MOCHIYA_materials_liltoon";
    constructor(parser: GLTFParser, options?: GLTFLilToonNodeExtensionOptions);
    /** The material has the extension. An index from untrusted JSON that is not an integer, such as "length", has none. */
    isLilToonMaterial(materialIndex: number): boolean;
    /** The extension of the material as the file had it, or undefined. */
    definition(materialIndex: number): GLTFLilToonMaterialDefinition | undefined;
    /** The glTF name of the material. */
    materialName(materialIndex: number): string;
    /** Add a warning for a lilToon material. afterRoot publishes it with the material warnings. */
    addWarning(materialIndex: number, code: LilToonNodeWarningCode, property: string, message: string): void;
    /** The queues and orders of the meshes that another loader ordered. afterRoot puts lilToon meshes between them. */
    useRenderOrderAnchors(anchors: readonly RenderOrderAnchor[]): void;
    loadMaterial(materialIndex: number): Promise<Material> | null;
    afterRoot(gltf: GLTF): Promise<void>;
}

/**
 * Add MikkTSpace tangents to each geometry that a material of `needsTangents` draws. UniVRM omits TANGENT, and
 * the tangent frame of three is more stable than the derivative frame. A geometry that has tangents is left
 * unchanged, and a shared geometry is generated once. When a normal-mapped material that does not need tangents
 * shares the geometry, the lilToon meshes get a copy, because a tangent attribute would change that material.
 *
 * generateIndexedTangents negates the MikkTSpace sign, so `cross(normal, tangent) * w` points to decreasing glTF V
 * (image up). The material then maps the normal without the Y negation of the derivative path, and both paths give
 * the same normal.
 */
declare function ensureLilToonNodeTangents(meshes: readonly Mesh[], needsTangents: (material: Material) => boolean): Promise<void>;

/**
 * Add lilToon node materials to a three-vrm VRMLoaderPlugin and return the same instance. A material with the
 * lilToon extension loads as LilToonNodeMaterial before GLTFLoader reaches the MToon plugin, and the MToon plugin
 * does not see that material. The tangents and the outline pass are added after the three-vrm afterRoot. Expression
 * material binds on a lilToon material give a warning; they are not applied. Plain glTF also loads. A second call
 * on the same plugin does nothing; the options of the first call apply.
 */
declare function enableLilToonNodeVRM<T extends VRMLoaderPlugin>(plugin: T, options?: GLTFLilToonNodeExtensionOptions): T & Pick<GLTFLilToonNodeExtension, "loadMaterial">;

export { type GLTFLilToonMaterialDefinition, GLTFLilToonNodeExtension, type GLTFLilToonNodeExtensionOptions, LILTOON_GLTF_EXTENSION, LILTOON_GLTF_SPEC_VERSION, LILTOON_NODE_FEATURES, LILTOON_NODE_VARIANTS, LILTOON_TRANSPARENT_QUEUE, type LilToonLightingHost, LilToonLightingModel, LilToonNodeMaterial, type LilToonNodeMaterialParameters, type LilToonNodeMaterialType, type LilToonNodeMode, type LilToonNodeValue, type LilToonNodeVariant, type LilToonNodeWarning, type LilToonNodeWarningCode, type LilToonScalarOrVector, type LilToonShadingInputs, type LilToonSurface, type RenderOrderAnchor, UNITY_LIGHT_SCALE, enableLilToonNodeVRM, ensureLilToonNodeTangents, generateLilToonOutlines, lilBand, lilBlendColor, lilLimitLight, lilOutlineWidth, lilToonRenderOrder, lilToonShadingInputs, nodeProperties, nodeVariant, nodeWarnings, tslBacklight, tslBacklightColor, tslBlendColor, tslEmission, tslMatCap, tslOutlineColor, tslOutlinePosition, tslRim };
