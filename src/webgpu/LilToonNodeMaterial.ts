import {
	BackSide,
	DoubleSide,
	FrontSide,
	Vector2,
	Vector3,
	Vector4,
} from "three";
import type { Side, Texture } from "three";
import { NodeMaterial } from "three/webgpu";
import type {
	LightingModel,
	Node,
	NodeBuilder,
	TextureNode as TextureNodeType,
	UniformNode,
} from "three/webgpu";
import {
	context,
	float,
	normalMap,
	positionLocal,
	texture,
	uniform,
	uv,
	vec4,
} from "three/tsl";
import { LILTOON_DEFAULTS } from "../generated/defaults.js";
import type { LilToonFeatureSet } from "../material/LilToonFeatureSet.js";
import type { LilToonShaderVariant } from "../material/shaderVariants.js";
import type { LilToonWarning } from "../utils/materialWarnings.js";
import {
	getNeutralTexture,
	normalizeLilToonTexture,
} from "../utils/texture.js";
import {
	LilToonLightingModel,
	type LilToonLightingHost,
} from "./LilToonLightingModel.js";
import {
	lilToonShadingInputs,
	tslOutlineColor,
	tslOutlinePosition,
	tslSampleST,
	type LilToonShadingInputs,
} from "./lilToonShading.js";
import {
	LILTOON_NODE_FEATURES,
	enabledNodeFeatures,
	nodeProperties,
	nodeVariant,
	nodeWarnings,
	normalizeNodeValue,
	type LilToonNodeMode,
	type LilToonNodeValue,
	type LilToonScalarOrVector,
} from "./properties.js";

export interface LilToonNodeMaterialParameters {
	name?: string;
	shaderVariant?: string;
	properties?: Record<string, LilToonScalarOrVector>;
	textures?: Record<string, Texture | null>;
}

type VectorValue = Vector2 | Vector3 | Vector4;
type PropertyNodes = {
	float: UniformNode<"float">;
	vec2: UniformNode<"vec2">;
	vec3: UniformNode<"vec3">;
	vec4: UniformNode<"vec4">;
};
type PropertyType = keyof PropertyNodes;
const VECTOR_TYPE: Record<number, PropertyType> = {
	2: "vec2",
	3: "vec3",
	4: "vec4",
};
type TextureNode = TextureNodeType<"vec4">;

const createUniform = (
	value: LilToonNodeValue,
): PropertyNodes[PropertyType] => {
	if (!Array.isArray(value)) return uniform(value);
	if (value.length === 2) return uniform(new Vector2().fromArray(value));
	if (value.length === 3) return uniform(new Vector3().fromArray(value));
	return uniform(new Vector4().fromArray(value));
};

const neutralFor = (name: string): Texture => {
	const entry = (LILTOON_DEFAULTS as Record<string, unknown>)[name];
	const kind =
		typeof entry === "object" && entry !== null && "texture" in entry
			? String((entry as { texture: unknown }).texture)
			: "white";
	return getNeutralTexture(kind);
};

const copyValue = (value: LilToonNodeValue): LilToonNodeValue =>
	Array.isArray(value) ? [...value] : value;

/** `_Cull` is the Unity CullMode: 0 Off, 1 Front, 2 Back. three draws the side that the cull keeps. */
const CULL_SIDE: Record<number, Side> = {
	0: DoubleSide,
	1: BackSide,
	2: FrontSide,
};

export class LilToonNodeMaterial extends NodeMaterial {
	readonly isLilToonNodeMaterial = true;
	/**
	 * The material draws the outline pass: generateLilToonOutlines sets it on the clone it makes. The build reads it,
	 * so set it before the first draw.
	 */
	isOutline = false;

	#variant: LilToonShaderVariant = "lilToon";
	#outline = false;
	#mode: LilToonNodeMode = "opaque";
	#requestedShader: string | undefined;
	#properties: Record<string, LilToonNodeValue> = {};
	#textures: Record<string, Texture | null> = {};
	#propertyNodes = new Map<string, PropertyNodes[PropertyType]>();
	#textureNodes = new Map<string, TextureNode>();
	#shadowed = new Set<object>();

	constructor(parameters: LilToonNodeMaterialParameters = {}) {
		super();
		this.lights = true;
		if (parameters.name !== undefined) this.name = parameters.name;
		this.#select(parameters.shaderVariant);
		this.#properties = nodeProperties(
			this.#variant,
			parameters.properties ?? {},
		);
		for (const [name, value] of Object.entries(parameters.textures ?? {}))
			this.#assignTexture(name, value);
		this.#applyAlphaMode();
		this.#applyCull();
		this.setupNodes();
	}

	get variant(): LilToonShaderVariant {
		return this.#variant;
	}

	/** The requested shader has an outline pass, also when the material falls back to lilToon. */
	get hasOutline(): boolean {
		return this.#outline;
	}

	/** One overridable place for the lighting model. A subclass supplies its own. */
	override setupLightingModel(): LightingModel {
		return new LilToonLightingModel(this, this.#lightingHost());
	}

	override setupLighting(builder: NodeBuilder): Node {
		const shadowed = (this.#shadowed = new Set());
		// r187 AnalyticLightNode.setupShadow multiplies the shadow into the light color unless the context has
		// getShadow. The light nodes build after this method returns, so the hook goes into a context around the
		// lighting. The model reads `lightNode.shadowNode` of each recorded light and folds it in as lilToon folds
		// the attenuation.
		const getShadow = (light: { baseColorNode: Node | null }) => {
			shadowed.add(light);
			return light.baseColorNode;
		};
		return context(super.setupLighting(builder), { getShadow });
	}

	/**
	 * The cast shadow of one light, 1 lit and 0 in shadow, before `_ShadowReceive` folds it into the bands.
	 * A subclass overrides it.
	 */
	protected receivedShadow(shadow: Node<"float">): Node<"float"> {
		return shadow;
	}

	/**
	 * The irradiance of the ambient term. `irradiance` is the scene ambient (ambient, hemisphere, and probe lights);
	 * `iblIrradiance` is what `setupEnvironment()` adds. `null` uses `irradiance`. A subclass overrides it.
	 */
	protected roomIrradiance(
		_irradiance: Node<"vec3">,
		_iblIrradiance: Node<"vec3">,
	): Node<"vec3"> | null {
		return null;
	}

	setProperty(name: string, value: LilToonScalarOrVector): void {
		const before = this.#programKey();
		const next = normalizeNodeValue(value, this.#properties[name]);
		this.#properties[name] = next;
		this.#syncNode(name, next);
		if (name === "_Cutoff") this.#applyAlphaMode();
		if (name === "_Cull") this.#applyCull();
		if (this.#programKey() !== before) this.needsUpdate = true;
	}

	getProperty(name: string): number | number[] | undefined {
		const value = this.#properties[name];
		return value === undefined ? undefined : copyValue(value);
	}

	setTexture(name: string, value: Texture | null): void {
		const before = this.#programKey();
		this.#assignTexture(name, value);
		if (this.#programKey() !== before) this.needsUpdate = true;
	}

	getTexture(name: string): Texture {
		return this.#textures[name] ?? neutralFor(name);
	}

	/** The uniform node that reads one property. Its value follows setProperty. */
	propertyNode<T extends PropertyType>(
		name: string,
		type: T,
	): PropertyNodes[T] {
		const value = this.#properties[name];
		if (value === undefined)
			throw new RangeError(`Unknown lilToon property ${name}`);
		const actual = Array.isArray(value) ? VECTOR_TYPE[value.length] : "float";
		if (actual !== type)
			throw new TypeError(`${name} is a ${actual}, not a ${type}`);
		const existing = this.#propertyNodes.get(name);
		if (existing) return existing as PropertyNodes[T];
		const node = createUniform(value);
		this.#propertyNodes.set(name, node);
		return node as PropertyNodes[T];
	}

	/** The texture node that samples one texture slot. Its value follows setTexture. */
	textureNode(name: string): TextureNode {
		const existing = this.#textureNodes.get(name);
		if (existing) return existing;
		const node = texture(this.getTexture(name)) as unknown as TextureNode;
		this.#textureNodes.set(name, node);
		return node;
	}

	getWarnings(): LilToonWarning[] {
		return nodeWarnings(
			this.name,
			this.#properties,
			this.#textures,
			this.#requestedShader,
		);
	}

	override customProgramCacheKey(): string {
		return `${super.customProgramCacheKey()}|${this.#programKey()}`;
	}

	override copy(source: LilToonNodeMaterial): this {
		super.copy(source);
		this.#requestedShader = source.#requestedShader;
		this.#variant = source.#variant;
		this.#mode = source.#mode;
		this.#outline = source.#outline;
		this.isOutline = source.isOutline;
		this.#properties = Object.fromEntries(
			Object.entries(source.#properties).map(([name, value]) => [
				name,
				copyValue(value),
			]),
		);
		this.#textures = { ...source.#textures };
		this.#propertyNodes.clear();
		this.#textureNodes.clear();
		this.#applyAlphaMode();
		this.setupNodes();
		this.needsUpdate = true;
		return this;
	}

	#select(shader: string | undefined): void {
		const selection = nodeVariant(shader);
		this.#requestedShader = shader;
		this.#variant = selection.variant;
		this.#mode = selection.mode;
		this.#outline = selection.outline;
	}

	#assignTexture(name: string, value: Texture | null): void {
		this.#textures[name] = value ? normalizeLilToonTexture(name, value) : null;
		const node = this.#textureNodes.get(name);
		if (node) node.value = this.getTexture(name);
	}

	#syncNode(name: string, value: LilToonNodeValue): void {
		const node = this.#propertyNodes.get(name);
		if (!node) return;
		if (Array.isArray(value)) (node.value as VectorValue).fromArray(value);
		else node.value = value;
	}

	/**
	 * The build state of the lighting model. `setupLighting` assigns the shadowed set and then calls
	 * `setupLightingModel` synchronously, so the model keeps the set of its own build. r187 buildAsync runs the model
	 * after an await, and another build of this material can replace `#shadowed` in that gap.
	 */
	#lightingHost(): LilToonLightingHost {
		const textures = { ...this.#textures };
		const outline = this.isOutline;
		return {
			shadowed: this.#shadowed,
			// The outline pass draws the outline color only (lil_pass_forward_normal.hlsl, LIL_OUTLINE).
			features: new Set(outline ? [] : this.#features()),
			hasTexture: (name) => textures[name] != null,
			receivedShadow: (shadow) => this.receivedShadow(shadow),
			roomIrradiance: (irradiance, iblIrradiance) =>
				this.roomIrradiance(irradiance, iblIrradiance),
			outline,
			transparent: this.#mode === "transparent",
			normalMapped: this.#normalMapped(),
		};
	}

	/** LIL_FEATURE_NORMAL_1ST with a `_BumpMap`. The outline pass does not map the normal. */
	#normalMapped(): boolean {
		return (
			!this.isOutline &&
			this.#features().includes("normal1st") &&
			this.#textures._BumpMap != null
		);
	}

	#shadingInputs(): LilToonShadingInputs {
		const textures = { ...this.#textures };
		return lilToonShadingInputs(this, (name) => textures[name] != null);
	}

	/**
	 * The normal: lilUnpackNormalScale of `_BumpMap` with `_BumpScale` (lil_common_frag.hlsl:870-881) through the
	 * three tangent frame. Without tangents, NormalMapNode uses the derivative frame. It does not assign
	 * `normalNode`, so a user normalNode and a later build without the map keep working.
	 */
	override setupNormal(): Node<"vec3"> {
		if (this.normalNode !== null || !this.#normalMapped())
			return super.setupNormal() as Node<"vec3">;
		const inputs = this.#shadingInputs();
		const sample = tslSampleST(inputs, "_BumpMap", inputs.uvMain);
		return this.#withNodes(
			{
				normalNode: normalMap(
					sample.rgb,
					this.propertyNode("_BumpScale", "float"),
				),
			},
			() => super.setupNormal() as Node<"vec3">,
		);
	}

	/** The outline pass moves each vertex along its normal (tslOutlinePosition). */
	override setupPosition(builder: NodeBuilder): Node<"vec3"> {
		if (!this.isOutline) return super.setupPosition(builder) as Node<"vec3">;
		const position = tslOutlinePosition(
			this.#shadingInputs(),
			(this.positionNode as Node<"vec3"> | null) ?? positionLocal,
		);
		return this.#withNodes(
			{ positionNode: position },
			() => super.setupPosition(builder) as Node<"vec3">,
		);
	}

	/** The outline pass draws `_OutlineColor` (tslOutlineColor) instead of the main color. */
	override setupDiffuseColor(builder: NodeBuilder): void {
		if (!this.isOutline) return super.setupDiffuseColor(builder);
		const color = tslOutlineColor(this.#shadingInputs());
		this.#withNodes(
			{ colorNode: vec4(color.rgb, 1), opacityNode: color.a },
			() => super.setupDiffuseColor(builder),
		);
	}

	/** Run `build` with some material nodes replaced, then restore them, so the build does not change the material. */
	#withNodes<T>(
		nodes: Partial<
			Pick<this, "colorNode" | "opacityNode" | "positionNode" | "normalNode">
		>,
		build: () => T,
	): T {
		const keys = Object.keys(nodes) as (keyof typeof nodes)[];
		const saved = keys.map((key) => this[key]);
		Object.assign(this, nodes);
		try {
			return build();
		} finally {
			keys.forEach((key, i) => {
				(this as Record<string, unknown>)[key] = saved[i];
			});
		}
	}

	#features(): (keyof LilToonFeatureSet)[] {
		return enabledNodeFeatures(this.#variant, this.#properties)
			.filter((feature) => LILTOON_NODE_FEATURES.has(feature))
			.sort();
	}

	#programKey(): string {
		const features = this.#features();
		const present = Object.keys(this.#textures)
			.filter((name) => this.#textures[name] !== null)
			.sort();
		const pass = this.isOutline ? "|outline" : "";
		return `${this.#variant}|${features.join(",")}|${present.join(",")}${pass}`;
	}

	#applyAlphaMode(): void {
		const cutoff = this.#properties._Cutoff;
		this.alphaTest =
			this.#mode === "cutout" && typeof cutoff === "number" ? cutoff : 0;
		this.transparent = this.#mode === "transparent";
		if (this.#mode === "transparent") this.depthWrite = false;
	}

	/** `_Cull` to the side. The outline pass draws the back side only (lil_pass_forward_normal.hlsl, Cull Front). */
	#applyCull(): void {
		const cull = this.#properties._Cull;
		this.side = this.isOutline
			? BackSide
			: (CULL_SIDE[typeof cull === "number" ? cull : 2] ?? FrontSide);
	}

	/**
	 * Build the nodes that read this material. The constructor and `copy` call it,
	 * because NodeMaterial.copy aliases the source nodes. A subclass overrides it,
	 * calls `super.setupNodes()`, and assigns its own nodes. It runs before the
	 * subclass field initializers, so it must not read subclass fields.
	 */
	protected setupNodes(): void {
		const st = this.propertyNode("_MainTex_ST", "vec4");
		const color = this.propertyNode("_Color", "vec4");
		const main = this.textureNode("_MainTex").sample(
			uv().mul(st.xy).add(st.zw),
		);
		this.colorNode = vec4(color.rgb.mul(main.rgb), 1);
		this.opacityNode = float(color.a).mul(main.a);
	}
}
