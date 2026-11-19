import { Color, Vector2, Vector3, Vector4, Texture } from 'three';
import { NodeMaterial, LightingModel, UniformNode, TextureNode as TextureNode$1 } from 'three/webgpu';

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

declare class GLTFLilToonNodeExtension {
}
declare const enableLilToonNodeVRM: () => void;

export { GLTFLilToonNodeExtension, LILTOON_NODE_FEATURES, LILTOON_NODE_VARIANTS, LilToonNodeMaterial, type LilToonNodeMaterialParameters, type LilToonNodeMode, type LilToonNodeValue, type LilToonNodeVariant, type LilToonScalarOrVector, enableLilToonNodeVRM, nodeProperties, nodeVariant, nodeWarnings };
