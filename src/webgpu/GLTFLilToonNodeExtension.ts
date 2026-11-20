import type { Material, Mesh, Object3D, Texture } from "three";
import type {
	GLTF,
	GLTFLoaderPlugin,
	GLTFParser,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import {
	LILTOON_GLTF_EXTENSION,
	LILTOON_GLTF_SPEC_VERSION,
	type GLTFLilToonMaterialDefinition,
	type GLTFLilToonTextureInfo,
} from "../loaders/types.js";
import { warnLilToon } from "../utils/diagnostics.js";
import type {
	LilToonWarning,
	LilToonWarningCode,
} from "../utils/materialWarnings.js";
import {
	LilToonNodeMaterial,
	type LilToonNodeMaterialParameters,
} from "./LilToonNodeMaterial.js";
import { generateLilToonOutlines } from "./outlines.js";
import {
	LILTOON_TRANSPARENT_QUEUE,
	lilToonRenderOrder,
	type RenderOrderAnchor,
} from "./renderOrder.js";
import { ensureLilToonNodeTangents } from "./tangents.js";

/** `missing-texture`: a texture index that is not in the file or did not load. The material uses the neutral texture. */
export type LilToonNodeWarningCode = LilToonWarningCode | "missing-texture";

export interface LilToonNodeWarning extends Omit<LilToonWarning, "code"> {
	code: LilToonNodeWarningCode;
}

export type LilToonNodeMaterialType = new (
	parameters?: LilToonNodeMaterialParameters,
) => LilToonNodeMaterial;

export interface GLTFLilToonNodeExtensionOptions {
	/** The class to construct. A subclass of LilToonNodeMaterial. */
	materialType?: LilToonNodeMaterialType;
	/** Non-fatal compatibility warnings. Omit to log them to the console. */
	onWarning?: (warning: LilToonNodeWarning) => void;
}

const SPEC_VERSIONS: ReadonlySet<string> = new Set([
	"1.0",
	"1.1",
	"1.2",
	LILTOON_GLTF_SPEC_VERSION,
]);

/** The shader of a legacy file that has a renderMode and no shaderVariant. */
const LEGACY_VARIANTS: Readonly<Record<string, string | undefined>> = {
	opaque: undefined,
	cutout: "Hidden/lilToonCutout",
	transparent: "Hidden/lilToonTransparent",
};

const isMesh = (object: Object3D): object is Mesh =>
	(object as Mesh).isMesh === true;

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
export class GLTFLilToonNodeExtension implements GLTFLoaderPlugin {
	readonly name = LILTOON_GLTF_EXTENSION;
	/**
	 * The extension and name of each material, read when the plugin is made. The VRM 0 plugin of three-vrm replaces
	 * the material JSON of an MToon material in beforeRoot and drops the other extensions.
	 */
	readonly #definitions: readonly (GLTFLilToonMaterialDefinition | undefined)[];
	readonly #names: readonly string[];
	readonly #warnings = new Map<number, LilToonNodeWarning[]>();
	readonly #tangentIndices = new Set<number>();
	#anchors: readonly RenderOrderAnchor[] = [];

	constructor(
		readonly parser: GLTFParser,
		readonly options: GLTFLilToonNodeExtensionOptions = {},
	) {
		const list: unknown = parser.json?.materials;
		const materials = (Array.isArray(list) ? list : []) as {
			name?: string;
			extensions?: Record<string, unknown>;
		}[];
		this.#definitions = materials.map(
			(material) =>
				material?.extensions?.[this.name] as
					GLTFLilToonMaterialDefinition | undefined,
		);
		this.#names = materials.map((material) => material?.name ?? "");
	}

	/** The material has the extension. An index from untrusted JSON that is not an integer, such as "length", has none. */
	isLilToonMaterial(materialIndex: number): boolean {
		return this.definition(materialIndex) !== undefined;
	}

	/** The extension of the material as the file had it, or undefined. */
	definition(materialIndex: number): GLTFLilToonMaterialDefinition | undefined {
		return Number.isInteger(materialIndex)
			? this.#definitions[materialIndex]
			: undefined;
	}

	/** The glTF name of the material. */
	materialName(materialIndex: number): string {
		return (
			(Number.isInteger(materialIndex) && this.#names[materialIndex]) || ""
		);
	}

	/** Add a warning for a lilToon material. afterRoot publishes it with the material warnings. */
	addWarning(
		materialIndex: number,
		code: LilToonNodeWarningCode,
		property: string,
		message: string,
	): void {
		const list = this.#warnings.get(materialIndex) ?? [];
		list.push({
			severity: "warning",
			code,
			materialName: this.materialName(materialIndex),
			materialIndex,
			shaderKey: this.definition(materialIndex)?.shaderVariant ?? "lilToon",
			property,
			message,
		});
		this.#warnings.set(materialIndex, list);
	}

	/** The queues and orders of the meshes that another loader ordered. afterRoot puts lilToon meshes between them. */
	useRenderOrderAnchors(anchors: readonly RenderOrderAnchor[]): void {
		this.#anchors = [...anchors];
	}

	loadMaterial(materialIndex: number): Promise<Material> | null {
		const definition = this.#definitions[materialIndex];
		if (!definition) return null;
		return this.#load(materialIndex, definition);
	}

	async afterRoot(gltf: GLTF): Promise<void> {
		const roots = gltf.scenes?.length ? gltf.scenes : [gltf.scene];
		const meshes = new Set<Mesh>();
		for (const root of roots)
			root.traverse((object) => {
				if (isMesh(object)) meshes.add(object);
			});
		await ensureLilToonNodeTangents([...meshes], (material) =>
			this.#needsTangents(material),
		);
		for (const root of roots) generateLilToonOutlines(root);
		for (const mesh of meshes) this.#applyRenderOrder(mesh);
		// Material indices order the warnings and remove the copies that GLTFLoader makes of a material.
		const warnings = [...this.#warnings]
			.sort(([a], [b]) => a - b)
			.flatMap(([, entries]) => entries);
		gltf.userData ??= {};
		gltf.userData.lilToonWarnings = warnings;
		for (const warning of warnings) {
			if (this.options.onWarning) this.options.onWarning({ ...warning });
			else
				warnLilToon(
					`${warning.materialName} (material ${warning.materialIndex}, ${warning.property}): ${warning.message}`,
				);
		}
	}

	async #load(
		materialIndex: number,
		definition: GLTFLilToonMaterialDefinition,
	): Promise<Material> {
		const textures: Record<string, Texture | null> = {};
		const missing: [property: string, message: string][] = [];
		await Promise.all(
			Object.entries(definition.textures ?? {}).map(
				async ([property, info]) => {
					const result = await this.#texture(property, info);
					textures[property] = result.texture;
					if (result.warning) missing.push([property, result.warning]);
				},
			),
		);
		const { shaderVariant, renderMode } = definition;
		const legacy =
			shaderVariant === undefined && renderMode !== undefined
				? LEGACY_VARIANTS[renderMode]
				: undefined;
		const MaterialType = this.options.materialType ?? LilToonNodeMaterial;
		const material = new MaterialType({
			name: this.materialName(materialIndex),
			shaderVariant: shaderVariant ?? legacy,
			properties: definition.properties ?? {},
			textures,
		});
		this.parser.associations.set(material, { materials: materialIndex });
		if (
			Number(material.getProperty("_UseBumpMap") ?? 0) !== 0 &&
			textures._BumpMap != null
		)
			this.#tangentIndices.add(materialIndex);

		const { specVersion } = definition;
		if (specVersion !== undefined && !SPEC_VERSIONS.has(String(specVersion)))
			this.addWarning(
				materialIndex,
				"spec-version-mismatch",
				"specVersion",
				`The material uses ${this.name} spec ${String(specVersion)}. This build reads 1.0 to ${LILTOON_GLTF_SPEC_VERSION}. The material loads with the properties it knows.`,
			);
		if (
			shaderVariant === undefined &&
			renderMode !== undefined &&
			!Object.hasOwn(LEGACY_VARIANTS, renderMode)
		)
			this.addWarning(
				materialIndex,
				"unsupported-shader-variant",
				"renderMode",
				`renderMode ${renderMode} is not implemented for WebGPU. The material uses lilToon.`,
			);
		for (const warning of material.getWarnings()) {
			const list = this.#warnings.get(materialIndex) ?? [];
			list.push({ ...warning, materialIndex });
			this.#warnings.set(materialIndex, list);
		}
		for (const [property, message] of missing)
			this.addWarning(materialIndex, "missing-texture", property, message);
		return material;
	}

	async #texture(
		property: string,
		info: GLTFLilToonTextureInfo | number,
	): Promise<{ texture: Texture | null; warning?: string }> {
		const index = typeof info === "number" ? info : info?.index;
		const count =
			(this.parser.json.textures as unknown[] | undefined)?.length ?? 0;
		const fallback = "The material uses the neutral texture.";
		if (!Number.isInteger(index) || index < 0 || index >= count)
			return {
				texture: null,
				warning: `${property} uses texture index ${String(index)}, and the file has ${count} textures. ${fallback}`,
			};
		try {
			// The texture of the index, without the KHR_texture_transform of a textureInfo: `<name>_ST` is the transform.
			const texture = (await this.parser.getDependency(
				"texture",
				index,
			)) as Texture | null;
			if (texture) return { texture };
			return {
				texture: null,
				warning: `${property} texture ${index} did not load. ${fallback}`,
			};
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			return {
				texture: null,
				warning: `${property} texture ${index} did not load (${reason}). ${fallback}`,
			};
		}
	}

	/**
	 * A transparent lilToon mesh gets the order of its `renderQueue` (lilToonRenderOrder), default 3000. An opaque or
	 * cutout mesh keeps its order, as the upstream WebGL plugin does. The outline pass is a group of the same mesh,
	 * so it has the same order.
	 */
	#applyRenderOrder(mesh: Mesh): void {
		const surface = Array.isArray(mesh.material)
			? mesh.material[0]
			: mesh.material;
		if (!(surface instanceof LilToonNodeMaterial) || !surface.transparent)
			return;
		const index = this.parser.associations.get(surface)?.materials;
		if (index === undefined) return;
		const queue =
			this.#definitions[index]?.renderQueue ?? LILTOON_TRANSPARENT_QUEUE;
		mesh.renderOrder = lilToonRenderOrder(queue, this.#anchors);
	}

	#needsTangents(material: Material): boolean {
		if (!(material instanceof LilToonNodeMaterial)) return false;
		const index = this.parser.associations.get(material)?.materials;
		return index !== undefined && this.#tangentIndices.has(index);
	}
}
