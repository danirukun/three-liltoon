import { BackSide } from "three";
import type { BufferGeometry, Mesh, Object3D } from "three";
import { LilToonNodeMaterial } from "./LilToonNodeMaterial.js";

const isMesh = (object: Object3D): object is Mesh =>
	(object as Mesh).isMesh === true;

/** The draw count of the whole geometry: the index count, or the vertex count without an index. */
const drawCount = (geometry: BufferGeometry): number =>
	geometry.index ? geometry.index.count : geometry.attributes.position!.count;

/** The geometry has no groups, or the two groups of this function. Other groups are left unchanged. */
const prepareGroups = (geometry: BufferGeometry): boolean => {
	const count = drawCount(geometry);
	const { groups } = geometry;
	if (groups.length === 0) {
		geometry.addGroup(0, count, 0);
		geometry.addGroup(0, count, 1);
		return true;
	}
	return (
		groups.length === 2 &&
		groups.every(
			(group, i) =>
				group.start === 0 && group.count === count && group.materialIndex === i,
		)
	);
};

/**
 * Give each mesh with an outline lilToon material a second material that draws the outline, as three-vrm 3.5.5
 * MToonMaterialLoaderPlugin._generateOutline does: `mesh.material = [surface, outline]`, with one geometry group for
 * each material. The outline is a clone of the surface with `isOutline` true, which also sets the back side. The material keys on
 * the outline flag of the shader variant, not on `_OutlineWidth`. A mesh whose material is already an array is left
 * unchanged, so a second call does nothing. three-vrm draws a third of the index count; this draws all of it, so the
 * count is correct for a geometry without an index too.
 */
export function generateLilToonOutlines(root: Object3D): void {
	const outlines = new Map<LilToonNodeMaterial, LilToonNodeMaterial>();
	root.traverse((object) => {
		if (!isMesh(object) || Array.isArray(object.material)) return;
		const surface = object.material;
		if (!(surface instanceof LilToonNodeMaterial) || !surface.hasOutline)
			return;
		if (surface.isOutline) return;
		if (!prepareGroups(object.geometry)) return;
		let outline = outlines.get(surface);
		if (!outline) {
			outline = surface.clone();
			outline.name = `${surface.name} (Outline)`;
			// The setter sets the back side (lil_pass_forward_normal.hlsl, Cull Front).
			outline.isOutline = true;
			// The shadow pass draws the outline at the surface position (its positionNode is null), so it draws the
			// back side as the surface does. The default shadow side of BackSide is FrontSide, which puts the front
			// faces into the shadow map at the surface depth.
			outline.shadowSide = BackSide;
			outlines.set(surface, outline);
		}
		object.material = [surface, outline];
	});
}
