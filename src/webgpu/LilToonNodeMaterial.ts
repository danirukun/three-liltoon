import { Vector2, Vector3, Vector4 } from "three";
import type { Texture } from "three";
import { NodeMaterial, PhongLightingModel } from "three/webgpu";
import type {
	LightingModel,
	TextureNode as TextureNodeType,
	UniformNode,
} from "three/webgpu";
import { float, texture, uniform, uv, vec4 } from "three/tsl";
import { LILTOON_DEFAULTS } from "../generated/defaults.js";
import type { LilToonShaderVariant } from "../material/shaderVariants.js";
import type { LilToonWarning } from "../utils/materialWarnings.js";
import {
	getNeutralTexture,
	normalizeLilToonTexture,
} from "../utils/texture.js";
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

export class LilToonNodeMaterial extends NodeMaterial {
	readonly isLilToonNodeMaterial = true;
	isOutline = false;

	#variant: LilToonShaderVariant = "lilToon";
	#mode: LilToonNodeMode = "opaque";
	#requestedShader: string | undefined;
	#properties: Record<string, LilToonNodeValue> = {};
	#textures: Record<string, Texture | null> = {};
	#propertyNodes = new Map<string, PropertyNodes[PropertyType]>();
	#textureNodes = new Map<string, TextureNode>();

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
		this.setupNodes();
	}

	get variant(): LilToonShaderVariant {
		return this.#variant;
	}

	/** One overridable place for the lighting model. A subclass supplies its own. */
	override setupLightingModel(): LightingModel {
		return new PhongLightingModel(false);
	}

	setProperty(name: string, value: LilToonScalarOrVector): void {
		const before = this.#programKey();
		const next = normalizeNodeValue(value, this.#properties[name]);
		this.#properties[name] = next;
		this.#syncNode(name, next);
		if (name === "_Cutoff") this.#applyAlphaMode();
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
		this.isOutline = selection.outline;
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

	#programKey(): string {
		const features = enabledNodeFeatures(this.#variant, this.#properties)
			.filter((feature) => LILTOON_NODE_FEATURES.has(feature))
			.sort();
		const present = Object.keys(this.#textures)
			.filter((name) => this.#textures[name] !== null)
			.sort();
		return `${this.#variant}|${features.join(",")}|${present.join(",")}`;
	}

	#applyAlphaMode(): void {
		const cutoff = this.#properties._Cutoff;
		this.alphaTest =
			this.#mode === "cutout" && typeof cutoff === "number" ? cutoff : 0;
		this.transparent = this.#mode === "transparent";
		if (this.#mode === "transparent") this.depthWrite = false;
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
