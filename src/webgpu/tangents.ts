import type { BufferGeometry, Material, Mesh } from "three";
import { generateIndexedTangents } from "../loaders/indexedTangents.js";

const materialsOf = (mesh: Mesh): Material[] =>
	Array.isArray(mesh.material) ? mesh.material : [mesh.material];

const canGenerate = (geometry: BufferGeometry): boolean =>
	geometry.hasAttribute("position") &&
	geometry.hasAttribute("normal") &&
	geometry.hasAttribute("uv");

/** A glTF material that GLTFLoader set up for the derivative frame (its normalScale.y is negated). */
const usesDerivativeNormalMap = (material: Material): boolean =>
	(material as Material & { normalMap?: unknown }).normalMap != null;

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
export async function ensureLilToonNodeTangents(
	meshes: readonly Mesh[],
	needsTangents: (material: Material) => boolean,
): Promise<void> {
	const users = new Map<BufferGeometry, Mesh[]>();
	for (const mesh of meshes) {
		const list = users.get(mesh.geometry) ?? [];
		list.push(mesh);
		users.set(mesh.geometry, list);
	}
	const work: BufferGeometry[] = [];
	for (const [geometry, list] of users) {
		if (geometry.hasAttribute("tangent") || !canGenerate(geometry)) continue;
		const targets = list.filter((mesh) =>
			materialsOf(mesh).some(needsTangents),
		);
		if (targets.length === 0) continue;
		const shared = list.some(
			(mesh) =>
				!targets.includes(mesh) &&
				materialsOf(mesh).some(usesDerivativeNormalMap),
		);
		if (!shared) {
			work.push(geometry);
			continue;
		}
		const copy = geometry.clone();
		for (const mesh of targets) mesh.geometry = copy;
		work.push(copy);
	}
	if (work.length === 0) return;
	const MikkTSpace =
		await import("three/examples/jsm/libs/mikktspace.module.js");
	await MikkTSpace.ready;
	for (const geometry of work) generateIndexedTangents(geometry, MikkTSpace);
}
