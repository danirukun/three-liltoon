import type { VRMLoaderPlugin } from "@pixiv/three-vrm";
import type { Mesh } from "three";
import type {
	GLTF,
	GLTFLoaderPlugin,
	GLTFParser,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import {
	GLTFLilToonNodeExtension,
	type GLTFLilToonNodeExtensionOptions,
} from "./GLTFLilToonNodeExtension.js";
import type { RenderOrderAnchor } from "./renderOrder.js";

type Json = Record<string, any>;

const MTOON_EXTENSION = "VRMC_materials_mtoon";
const NO_BINDS =
	"The WebGPU lilToon material does not apply expression material binds. The expression does not change this material.";

const enabled = new WeakSet<VRMLoaderPlugin>();

/**
 * Keep the MToon plugin of three-vrm away from a lilToon material. The VRM 0 plugin writes `VRMC_materials_mtoon`
 * over the material JSON in beforeRoot, and the MToon plugin then sets the render order of the mesh and lists the
 * material in `vrmMToonMaterials`. This puts the lilToon extension back and removes the MToon extension.
 */
function keepLilToonFromMToon(
	json: Json,
	materials: GLTFLilToonNodeExtension,
): void {
	const list = json.materials as Json[] | undefined;
	list?.forEach((material, index) => {
		const definition = materials.definition(index);
		if (!material || !definition) return;
		const { [MTOON_EXTENSION]: _mtoon, ...extensions } = (material.extensions ??
			{}) as Json;
		list[index] = {
			...material,
			extensions: { ...extensions, [materials.name]: definition },
		};
	});
}

/**
 * The Unity queue and the `renderOrder` of each transparent MToon mesh. three-vrm 3.5.5 orders them with
 * MToonMaterialLoaderPlugin._parseRenderOrder: `(transparentWithZWrite ? 0 : 19) + renderQueueOffsetNumber`. For
 * VRM 1 the queue is `2501 + offset` with ZWrite and `3000 + offset` without (the VRMC_materials_mtoon spec). For
 * VRM 0, VRMMaterialsV0CompatPlugin._populateRenderQueueMap turns the queues into offsets by rank, so the queue is the
 * `renderQueue` of the VRM 0 material properties. The order is read from the mesh, so a `renderOrderOffset` option
 * of the MToon plugin is included.
 */
function mtoonAnchors(gltf: GLTF, parser: GLTFParser): RenderOrderAnchor[] {
	const json = parser.json as Json;
	const v0 = json.extensions?.VRM?.materialProperties as Json[] | undefined;
	const anchors: RenderOrderAnchor[] = [];
	const roots = gltf.scenes?.length ? gltf.scenes : [gltf.scene];
	for (const root of roots)
		root.traverse((object) => {
			const mesh = object as Mesh;
			if (!mesh.isMesh) return;
			const surface = Array.isArray(mesh.material)
				? mesh.material[0]
				: mesh.material;
			if (!surface?.transparent) return;
			const index = parser.associations.get(surface)?.materials;
			if (index === undefined) return;
			const mtoon = json.materials?.[index]?.extensions?.[MTOON_EXTENSION] as
				Json | undefined;
			if (!mtoon) return;
			const offset = Number(mtoon.renderQueueOffsetNumber ?? 0);
			const queue =
				v0?.[index]?.renderQueue ??
				(mtoon.transparentWithZWrite ? 2501 : 3000) + offset;
			anchors.push({ queue: Number(queue), renderOrder: mesh.renderOrder });
		});
	return anchors;
}

/** VRM 0 blendShapeGroups[].materialValues bind a material by name; three-vrm also matches the "(Outline)" name. */
function warnV0Binds(json: Json, materials: GLTFLilToonNodeExtension): void {
	const groups = (json.extensions?.VRM?.blendShapeMaster?.blendShapeGroups ??
		[]) as Json[];
	const count = (json.materials as unknown[] | undefined)?.length ?? 0;
	for (const group of groups)
		for (const value of (group.materialValues ?? []) as Json[])
			for (let index = 0; index < count; index++) {
				if (!materials.isLilToonMaterial(index)) continue;
				const name = materials.materialName(index);
				if (
					value.materialName !== name &&
					value.materialName !== `${name} (Outline)`
				)
					continue;
				materials.addWarning(
					index,
					"unsupported-feature",
					String(value.propertyName ?? "materialValues"),
					`VRM 0 blend shape ${String(group.name ?? group.presetName)} binds ${String(value.propertyName)}. ${NO_BINDS}`,
				);
			}
}

/** VRM 1 expressions bind a material by index. */
function warnV1Binds(json: Json, materials: GLTFLilToonNodeExtension): void {
	const expressions = json.extensions?.VRMC_vrm?.expressions as
		Json | undefined;
	const entries = [
		...Object.entries((expressions?.preset ?? {}) as Json),
		...Object.entries((expressions?.custom ?? {}) as Json),
	];
	for (const [name, expression] of entries)
		for (const kind of ["materialColorBinds", "textureTransformBinds"])
			for (const bind of (expression?.[kind] ?? []) as Json[]) {
				if (!materials.isLilToonMaterial(bind.material)) continue;
				const what =
					kind === "materialColorBinds"
						? `the ${String(bind.type)} color`
						: "the texture transform";
				materials.addWarning(
					bind.material,
					"unsupported-feature",
					kind,
					`VRM expression ${name} binds ${what}. ${NO_BINDS}`,
				);
			}
}

/**
 * Add lilToon node materials to a three-vrm VRMLoaderPlugin and return the same instance. A material with the
 * lilToon extension loads as LilToonNodeMaterial before GLTFLoader reaches the MToon plugin, and the MToon plugin
 * does not see that material. The tangents and the outline pass are added after the three-vrm afterRoot. Expression
 * material binds on a lilToon material give a warning; they are not applied. Plain glTF also loads. A second call
 * on the same plugin does nothing; the options of the first call apply.
 */
export function enableLilToonNodeVRM<T extends VRMLoaderPlugin>(
	plugin: T,
	options: GLTFLilToonNodeExtensionOptions = {},
): T & Pick<GLTFLilToonNodeExtension, "loadMaterial"> {
	const enhanced = plugin as T & Pick<GLTFLilToonNodeExtension, "loadMaterial">;
	if (enabled.has(plugin)) return enhanced;

	const materials = new GLTFLilToonNodeExtension(plugin.parser, options);
	const originalLoadMaterial = (plugin as T & GLTFLoaderPlugin).loadMaterial;
	const originalBeforeRoot = plugin.beforeRoot;
	const originalAfterRoot = plugin.afterRoot;

	enhanced.loadMaterial = function (index) {
		return (
			materials.loadMaterial(index) ??
			originalLoadMaterial?.call(this, index) ??
			null
		);
	};
	plugin.beforeRoot = async function () {
		await originalBeforeRoot.call(this);
		keepLilToonFromMToon(plugin.parser.json, materials);
	};
	plugin.afterRoot = async function (gltf) {
		await originalAfterRoot.call(this, gltf);
		warnV0Binds(plugin.parser.json, materials);
		warnV1Binds(plugin.parser.json, materials);
		materials.useRenderOrderAnchors(mtoonAnchors(gltf, plugin.parser));
		await materials.afterRoot(gltf);
	};
	enabled.add(plugin);
	return enhanced;
}
