import {
	BackSide,
	BoxGeometry,
	DoubleSide,
	Group,
	Mesh,
	MeshBasicMaterial,
	type BufferGeometry,
	type Material,
} from "three";
import { NodeMaterial, type Node, type NodeBuilder } from "three/webgpu";
import { positionLocal } from "three/tsl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LilToonNodeMaterial } from "../../src/webgpu/LilToonNodeMaterial";
import { generateLilToonOutlines } from "../../src/webgpu/outlines";
import { contains, runModel } from "./fakeLighting";

// A glTF primitive: one geometry without groups.
const primitive = (geometry: BufferGeometry = new BoxGeometry()) => {
	geometry.clearGroups();
	return geometry;
};

const sceneWith = (material: Material, geometry: BufferGeometry) => {
	const mesh = new Mesh<BufferGeometry, Material | Material[]>(
		geometry,
		material,
	);
	const root = new Group();
	root.add(new Group().add(mesh));
	return { root, mesh };
};

const outlined = (shaderVariant = "Hidden/lilToonOutline") => {
	const surface = new LilToonNodeMaterial({ name: "Body", shaderVariant });
	const geometry = primitive();
	const { root, mesh } = sceneWith(surface, geometry);
	generateLilToonOutlines(root);
	return { root, mesh, surface, geometry };
};

describe("generateLilToonOutlines", () => {
	it("adds a back-side outline material and two groups to an outline variant", () => {
		const { mesh, surface, geometry } = outlined();
		const materials = mesh.material as LilToonNodeMaterial[];
		expect(materials).toHaveLength(2);
		expect(materials[0]).toBe(surface);
		expect(surface.isOutline).toBe(false);
		const outline = materials[1]!;
		expect(outline).toBeInstanceOf(LilToonNodeMaterial);
		expect(outline).not.toBe(surface);
		expect(outline.isOutline).toBe(true);
		expect(outline.side).toBe(BackSide);
		expect(outline.name).toBe("Body (Outline)");
		const count = geometry.index!.count;
		expect(geometry.groups).toEqual([
			{ start: 0, count, materialIndex: 0 },
			{ start: 0, count, materialIndex: 1 },
		]);
	});

	it("draws every vertex of a geometry without an index", () => {
		const geometry = primitive(new BoxGeometry().toNonIndexed());
		const material = new LilToonNodeMaterial({
			shaderVariant: "Hidden/lilToonCutoutOutline",
		});
		const { root } = sceneWith(material, geometry);
		generateLilToonOutlines(root);
		const count = geometry.attributes.position!.count;
		expect(geometry.groups.map((group) => group.count)).toEqual([count, count]);
	});

	it("gives an outline to an outline variant that falls back to lilToon", () => {
		const { mesh, surface } = outlined(
			"Hidden/lilToonTwoPassTransparentOutline",
		);
		expect(surface.variant).toBe("lilToon");
		expect(surface.hasOutline).toBe(true);
		expect(mesh.material).toHaveLength(2);
	});

	it("leaves a variant without an outline unchanged, also with _OutlineWidth", () => {
		const material = new LilToonNodeMaterial({
			properties: { _OutlineWidth: 0.08 },
		});
		const geometry = primitive();
		const { root, mesh } = sceneWith(material, geometry);
		generateLilToonOutlines(root);
		expect(material.hasOutline).toBe(false);
		expect(mesh.material).toBe(material);
		expect(geometry.groups).toEqual([]);
	});

	it("does nothing on a second call", () => {
		const { root, mesh, geometry } = outlined();
		const materials = mesh.material;
		generateLilToonOutlines(root);
		expect(mesh.material).toBe(materials);
		expect(mesh.material).toHaveLength(2);
		expect(geometry.groups).toHaveLength(2);
	});

	it("leaves a geometry with other groups unchanged", () => {
		const material = new LilToonNodeMaterial({
			shaderVariant: "Hidden/lilToonOutline",
		});
		const geometry = new BoxGeometry();
		const groups = structuredClone(geometry.groups);
		const { root, mesh } = sceneWith(material, geometry);
		generateLilToonOutlines(root);
		expect(mesh.material).toBe(material);
		expect(geometry.groups).toEqual(groups);
	});

	it("leaves a mesh with another material unchanged", () => {
		const material = new MeshBasicMaterial();
		const geometry = primitive();
		const { root, mesh } = sceneWith(material, geometry);
		generateLilToonOutlines(root);
		expect(mesh.material).toBe(material);
		expect(geometry.groups).toEqual([]);
	});

	it("keeps the outline on the back side when _Cull changes", () => {
		const { mesh } = outlined();
		const [surface, outline] = mesh.material as LilToonNodeMaterial[];
		surface!.setProperty("_Cull", 0);
		outline!.setProperty("_Cull", 0);
		expect(surface!.side).toBe(DoubleSide);
		expect(outline!.side).toBe(BackSide);
	});

	it("gives the outline material a dispose that the renderer can observe", () => {
		const { mesh } = outlined();
		const outline = (mesh.material as LilToonNodeMaterial[])[1]!;
		const disposed = vi.fn();
		outline.addEventListener("dispose", disposed);
		outline.dispose();
		expect(disposed).toHaveBeenCalledOnce();
	});
});

describe("the outline material at build", () => {
	afterEach(() => vi.restoreAllMocks());
	const builder = {} as NodeBuilder;

	// What NodeMaterial reads from the material when the builder calls it.
	const seenBy = <K extends "setupPosition" | "setupDiffuseColor">(
		method: K,
		read: (material: NodeMaterial) => (Node | null)[],
	) => {
		const seen: (Node | null)[][] = [];
		vi.spyOn(NodeMaterial.prototype, method).mockImplementation(function (
			this: NodeMaterial,
		) {
			seen.push(read(this));
			return positionLocal as never;
		});
		return seen;
	};

	it("moves the outline along the normal and leaves the surface in place", () => {
		const { mesh } = outlined();
		const [surface, outline] = mesh.material as LilToonNodeMaterial[];
		const seen = seenBy("setupPosition", (m) => [m.positionNode]);
		surface!.setupPosition(builder);
		outline!.setupPosition(builder);
		expect(seen[0]).toEqual([null]);
		const width = outline!.propertyNode("_OutlineWidth", "float");
		expect(contains(seen[1]![0], width)).toBe(true);
		expect(outline!.positionNode).toBeNull();
	});

	it("draws the outline color on the outline only", () => {
		const { mesh } = outlined();
		const [surface, outline] = mesh.material as LilToonNodeMaterial[];
		const seen = seenBy("setupDiffuseColor", (m) => [
			m.colorNode,
			m.opacityNode,
		]);
		surface!.setupDiffuseColor(builder);
		outline!.setupDiffuseColor(builder);
		expect(seen[0]).toEqual([surface!.colorNode, surface!.opacityNode]);
		const color = outline!.propertyNode("_OutlineColor", "vec4");
		expect(contains(seen[1]![0], color)).toBe(true);
		expect(contains(seen[1]![1], color)).toBe(true);
		expect(contains(seen[0]![0], color)).toBe(false);
		expect(contains(outline!.colorNode, color)).toBe(false);
	});

	it("lights the outline with _OutlineEnableLighting only", () => {
		const material = new LilToonNodeMaterial({
			shaderVariant: "Hidden/lilToonOutline",
			properties: { _UseShadow: 1, _UseRim: 1 },
		});
		const { root, mesh } = sceneWith(material, primitive());
		generateLilToonOutlines(root);
		const outline = (mesh.material as LilToonNodeMaterial[])[1]!;
		const { assigned, outgoing } = runModel(outline, [
			{ shadowNode: null, baseColorNode: null },
		]);
		expect(assigned).toEqual(["lilLight", "lilAmbient", "outgoingLight"]);
		const enable = outline.propertyNode("_OutlineEnableLighting", "float");
		expect(contains(outgoing, enable)).toBe(true);
		expect(contains(outgoing, outline.propertyNode("_RimColor", "vec4"))).toBe(
			false,
		);
	});

	it("has its own program key", () => {
		const { mesh } = outlined();
		const [surface, outline] = mesh.material as LilToonNodeMaterial[];
		expect(outline!.customProgramCacheKey()).not.toBe(
			surface!.customProgramCacheKey(),
		);
	});
});
