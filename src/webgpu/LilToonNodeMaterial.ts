import {
	BackSide,
	DoubleSide,
	FrontSide,
	Vector2,
	Vector3,
	Vector4,
} from "three";
import type { Side, Texture } from "three";
import {
	NodeMaterial,
	NodeUpdateType,
	TextureNode as TextureNodeBase,
} from "three/webgpu";
import type {
	LightingModel,
	Node,
	NodeBuilder,
	NodeFrame,
	TextureNode as TextureNodeType,
	UniformNode,
} from "three/webgpu";
import {
	context,
	float,
	normalMap,
	positionLocal,
	uniform,
	uv,
	vec2,
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
	checkNodeValue,
	enabledNodeFeatures,
	nodeProperties,
	nodeVariant,
	nodeWarnings,
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

const createVector = (value: number[]): VectorValue => {
	if (value.length === 2) return new Vector2().fromArray(value);
	if (value.length === 3) return new Vector3().fromArray(value);
	return new Vector4().fromArray(value);
};

const createUniform = (
	value: LilToonNodeValue,
): PropertyNodes[PropertyType] => {
	if (!Array.isArray(value)) return uniform(value);
	if (value.length === 2) return uniform(new Vector2().fromArray(value));
	if (value.length === 3) return uniform(new Vector3().fromArray(value));
	return uniform(new Vector4().fromArray(value));
};

const typeOf = (value: LilToonNodeValue): PropertyType =>
	Array.isArray(value) ? VECTOR_TYPE[value.length]! : "float";

/** A node frame or a node builder: the material it draws, and in a shadow pass the material the override stands in for. */
type DrawState = {
	material?: unknown;
	renderer?: { _currentSourceMaterial?: unknown } | null;
};

/**
 * The shared texture node of one slot. The nodes that `sample` and `level` clone from it read its value, so one
 * update in each draw sets the texture for all of them. The sampler state is in the program key, so the node key
 * is the node id only: the texture of the last draw must not change the key.
 */
class LilToonTextureNode extends TextureNodeBase {
	slot = "";
	read: (state: DrawState, slot: string) => Texture | undefined = () =>
		undefined;

	#sync(state: DrawState): void {
		const base = this.getBase() as LilToonTextureNode;
		const value = base.read(state, base.slot);
		if (value !== undefined) base.value = value;
	}

	override setup(builder: NodeBuilder) {
		this.#sync(builder as unknown as DrawState);
		return super.setup(builder);
	}

	// The update phase, not the update-before phase: three r187 renders a shadow map in the update-before phase of
	// the first draw, and its caster draws sync this node to their own textures.
	override update(frame: NodeFrame): undefined {
		this.#sync(frame as unknown as DrawState);
		return undefined;
	}

	override customCacheKey(): number {
		return this.id;
	}
}

/** The texture fields that three adds to the key of a top-level material texture, and the ones a program bakes in. */
const textureKey = (value: Texture): string =>
	[
		value.mapping,
		value.channel,
		value.magFilter,
		value.minFilter,
		value.wrapS,
		value.wrapT,
		(value as { wrapR?: number }).wrapR,
		value.type,
		value.colorSpace,
	].join(":");

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
	#isOutline = false;
	#variant: LilToonShaderVariant = "lilToon";
	#outline = false;
	#mode: LilToonNodeMode = "opaque";
	#requestedShader: string | undefined;
	#properties: Record<string, LilToonNodeValue> = {};
	/** The message of each property whose last given value had a wrong shape. getWarnings reports them. */
	#invalid = new Map<string, string>();
	#textures: Record<string, Texture | null> = {};
	/** The vector of each vector property that the shared nodes read. setProperty updates it in place. */
	#vectors = new Map<string, VectorValue>();
	#shadowed = new Set<object>();

	/**
	 * One node for each property and texture slot, shared by all materials. three keys a program by the node ids,
	 * so per-material nodes would give each material its own program. Each node reads the material it draws.
	 */
	static #propertyNodes = new Map<string, PropertyNodes[PropertyType]>();
	static #textureNodes = new Map<string, LilToonTextureNode>();
	/** The main color and opacity of setupNodes, built once from the shared nodes. */
	static #mainNodes: { color: Node<"vec4">; opacity: Node<"float"> } | null =
		null;

	/** The lilToon material of a draw or a build. A shadow pass draws an override material in place of it. */
	static #drawn(state: DrawState): LilToonNodeMaterial | undefined {
		const isLilToon = (value: unknown): value is LilToonNodeMaterial =>
			typeof value === "object" && value !== null && #vectors in value;
		if (isLilToon(state.material)) return state.material;
		const source = state.renderer?._currentSourceMaterial;
		return isLilToon(source) ? source : undefined;
	}

	constructor(parameters: LilToonNodeMaterialParameters = {}) {
		super();
		this.lights = true;
		if (parameters.name !== undefined) this.name = parameters.name;
		this.#select(parameters.shaderVariant);
		this.#properties = nodeProperties(
			this.#variant,
			parameters.properties ?? {},
			(name, message) => this.#invalid.set(name, message),
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

	/**
	 * The material draws the outline pass: generateLilToonOutlines sets it on the clone it makes. A change sets the
	 * side (BackSide for the outline, `_Cull` for the surface) and rebuilds the program.
	 */
	get isOutline(): boolean {
		return this.#isOutline;
	}

	set isOutline(value: boolean) {
		if (value === this.#isOutline) return;
		this.#isOutline = value;
		this.#applyCull();
		this.needsUpdate = true;
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

	/** Set one property. A value of a wrong shape is ignored, and getWarnings names it until a value fits. */
	setProperty(name: string, value: LilToonScalarOrVector): void {
		const checked = checkNodeValue(name, value, this.#properties[name]);
		if (checked.message !== undefined) {
			this.#invalid.set(name, checked.message);
			return;
		}
		this.#invalid.delete(name);
		const before = this.#programKey();
		const next = checked.value;
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

	/**
	 * The uniform node that reads one property. All materials share it, and it reads the material that it draws.
	 * Its value is the value of this material until another material is drawn or asks for the node.
	 */
	propertyNode<T extends PropertyType>(
		name: string,
		type: T,
	): PropertyNodes[T] {
		const value = this.#properties[name];
		if (value === undefined)
			throw new RangeError(`Unknown lilToon property ${name}`);
		const actual = typeOf(value);
		if (actual !== type)
			throw new TypeError(`${name} is a ${actual}, not a ${type}`);
		const nodes = LilToonNodeMaterial.#propertyNodes;
		const key = `${name}|${type}`;
		let node = nodes.get(key);
		if (!node) {
			node = (
				createUniform(value) as UniformNode<"float", unknown>
			).onObjectUpdate((frame) => {
				const drawn = LilToonNodeMaterial.#drawn(frame as unknown as DrawState);
				return drawn && drawn.#uniform(name);
			}) as PropertyNodes[PropertyType];
			nodes.set(key, node);
		}
		node.value = this.#uniform(name)!;
		return node as PropertyNodes[T];
	}

	/**
	 * The texture node that samples one texture slot. All materials share it, and it reads the texture of the material
	 * that it draws. Its value is the texture of this material until another material is drawn or asks for the node.
	 */
	textureNode(name: string): TextureNode {
		const nodes = LilToonNodeMaterial.#textureNodes;
		let node = nodes.get(name);
		if (!node) {
			node = new LilToonTextureNode(this.getTexture(name));
			node.slot = name;
			node.read = (state, slot) =>
				LilToonNodeMaterial.#drawn(state)?.getTexture(slot);
			// Not merged with another slot that has the same texture at build time.
			node.mergeable = false;
			node.updateType = NodeUpdateType.OBJECT;
			nodes.set(name, node);
		}
		node.value = this.getTexture(name);
		return node as unknown as TextureNode;
	}

	/** The compatibility warnings: first each property value of a wrong shape, then the feature warnings. */
	getWarnings(): LilToonWarning[] {
		const shaderKey = this.#requestedShader ?? this.#variant;
		const invalid: LilToonWarning[] = [...this.#invalid].map(
			([property, message]) => ({
				severity: "warning",
				code: "invalid-property-value",
				materialName: this.name,
				shaderKey,
				property,
				message,
			}),
		);
		return [
			...invalid,
			...nodeWarnings(
				this.name,
				this.#properties,
				this.#textures,
				this.#requestedShader,
			),
		];
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
		this.#invalid = new Map(source.#invalid);
		this.#textures = { ...source.#textures };
		this.#vectors = new Map();
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
		const node = LilToonNodeMaterial.#textureNodes.get(name);
		if (node) node.value = this.getTexture(name);
	}

	/** The value that the shared node of one property reads: the number, or the vector of this material. */
	#uniform(name: string): number | VectorValue | undefined {
		const value = this.#properties[name];
		if (!Array.isArray(value)) return value;
		let vector = this.#vectors.get(name);
		if (!vector) {
			vector = createVector(value);
			this.#vectors.set(name, vector);
		}
		return vector;
	}

	#syncNode(name: string, value: LilToonNodeValue): void {
		if (Array.isArray(value)) this.#vectors.get(name)?.fromArray(value);
		const node = LilToonNodeMaterial.#propertyNodes.get(
			`${name}|${typeOf(value)}`,
		);
		if (node) node.value = this.#uniform(name)!;
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
	 * three tangent frame. Without a `tangent` attribute, NormalMapNode uses the derivative frame, and the textures
	 * have flipY false, so Y is negated as GLTFLoader negates `normalScale.y` (GLTFLoader.js:3642-3645). The geometry
	 * attributes are in the render object cache key, so the program key does not need the tangent. It does not
	 * assign `normalNode`, so a user normalNode and a later build without the map keep working.
	 */
	override setupNormal(builder?: NodeBuilder): Node<"vec3"> {
		if (this.normalNode !== null || !this.#normalMapped())
			return super.setupNormal() as Node<"vec3">;
		const inputs = this.#shadingInputs();
		const sample = tslSampleST(inputs, "_BumpMap", inputs.uvMain);
		const scale = this.propertyNode("_BumpScale", "float");
		const hasTangent = builder?.geometry?.hasAttribute("tangent") === true;
		return this.#withNodes(
			{
				normalNode: normalMap(
					sample.rgb,
					vec2(scale, hasTangent ? scale : scale.negate()),
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

	/**
	 * The features, the texture slots with a texture, and the sampler state of each texture. The shared texture nodes
	 * are not top-level material textures, so three does not add their sampler state to the material key.
	 */
	#programKey(): string {
		const features = this.#features();
		const present = Object.keys(this.#textures)
			.filter((name) => this.#textures[name] != null)
			.sort()
			.map((name) => `${name}{${textureKey(this.#textures[name]!)}}`);
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
		const texture = this.textureNode("_MainTex");
		// Built once: the program key hashes the node ids of colorNode and opacityNode.
		LilToonNodeMaterial.#mainNodes ??= (() => {
			const main = texture.sample(uv().mul(st.xy).add(st.zw));
			return {
				color: vec4(color.rgb.mul(main.rgb), 1),
				opacity: float(color.a).mul(main.a),
			};
		})();
		this.colorNode = LilToonNodeMaterial.#mainNodes.color;
		this.opacityNode = LilToonNodeMaterial.#mainNodes.opacity;
	}
}
