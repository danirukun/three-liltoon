import { FloatType, NearestFilter, Texture } from "three";
import { NodeMaterial, NodeUpdateType } from "three/webgpu";
import type { NodeFrame } from "three/webgpu";
import { describe, expect, it } from "vitest";
import { LilToonNodeMaterial } from "../../src/webgpu/LilToonNodeMaterial";

const outlineMaterial = (
	properties: Record<string, number | number[]>,
	main: Texture = new Texture(),
) =>
	new LilToonNodeMaterial({
		shaderVariant: "Hidden/lilToonOutline",
		properties: { _UseRim: 1, ...properties },
		textures: { _MainTex: main },
	});

/** The node frame of one draw. A shadow pass draws an override material in place of the source material. */
const drawOf = (material: object, source: object | null = null) =>
	({
		material,
		renderer: { _currentSourceMaterial: source },
	}) as unknown as NodeFrame;

// three r187 keys a program by the node graph, and a node key includes the node id. Two materials with the same
// features must share one program, so a light change builds one program for them, not one for each material.
describe("LilToonNodeMaterial program share", () => {
	it("gives the same program key to two materials that differ only in values and textures", () => {
		const a = outlineMaterial({ _Color: [1, 0, 0, 1], _ShadowBorder: 0.4 });
		const b = outlineMaterial({ _Color: [0, 1, 0, 1], _ShadowBorder: 0.6 });
		expect(b.customProgramCacheKey()).toBe(a.customProgramCacheKey());
	});

	it("keeps the shared key after a value change", () => {
		const a = outlineMaterial({});
		const b = outlineMaterial({});
		const version = b.version;
		b.setProperty("_Color", [0.2, 0.3, 0.4, 1]);
		b.setTexture("_MainTex", new Texture());
		expect(b.customProgramCacheKey()).toBe(a.customProgramCacheKey());
		expect(b.version).toBe(version);
	});

	it("gives another key for another feature or texture presence", () => {
		const a = outlineMaterial({});
		expect(outlineMaterial({ _UseRim: 0 }).customProgramCacheKey()).not.toBe(
			a.customProgramCacheKey(),
		);
		const b = outlineMaterial({});
		b.setTexture("_BumpMap", new Texture());
		expect(b.customProgramCacheKey()).not.toBe(a.customProgramCacheKey());
	});

	it("gives another key for another sampler or texture type", () => {
		const a = outlineMaterial({});
		const nearest = new Texture();
		nearest.magFilter = NearestFilter;
		expect(outlineMaterial({}, nearest).customProgramCacheKey()).not.toBe(
			a.customProgramCacheKey(),
		);
		const float = new Texture();
		float.type = FloatType;
		expect(outlineMaterial({}, float).customProgramCacheKey()).not.toBe(
			a.customProgramCacheKey(),
		);
	});

	it("keeps the key when the shared texture node reads the texture of another material", () => {
		const a = outlineMaterial({});
		const key = a.customProgramCacheKey();
		const nearest = new Texture();
		nearest.magFilter = NearestFilter;
		const b = outlineMaterial({}, nearest);
		a.textureNode("_MainTex").update(drawOf(b));
		expect(a.customProgramCacheKey()).toBe(key);
	});
});

describe("LilToonNodeMaterial shared nodes", () => {
	it("reads the values of the material it draws", () => {
		const a = outlineMaterial({ _Color: [1, 0, 0, 1], _ShadowBorder: 0.4 });
		const b = outlineMaterial({ _Color: [0, 1, 0, 1], _ShadowBorder: 0.6 });
		const border = a.propertyNode("_ShadowBorder", "float");
		const color = a.propertyNode("_Color", "vec4");
		expect(b.propertyNode("_ShadowBorder", "float")).toBe(border);
		expect(b.propertyNode("_Color", "vec4")).toBe(color);

		border.update(drawOf(b));
		color.update(drawOf(b));
		expect(border.value).toBe(0.6);
		expect(color.value.toArray()).toEqual([0, 1, 0, 1]);
		border.update(drawOf(a));
		color.update(drawOf(a));
		expect(border.value).toBe(0.4);
		expect(color.value.toArray()).toEqual([1, 0, 0, 1]);
	});

	it("reads a value change of the material it draws", () => {
		const a = outlineMaterial({});
		const b = outlineMaterial({});
		const color = a.propertyNode("_Color", "vec4");
		b.setProperty("_Color", [0.1, 0.2, 0.3, 0.4]);
		color.update(drawOf(a));
		color.update(drawOf(b));
		expect(color.value.toArray()).toEqual([0.1, 0.2, 0.3, 0.4]);
	});

	it("samples the texture of the material it draws, or the neutral texture", () => {
		const mainA = new Texture();
		const mainB = new Texture();
		const a = outlineMaterial({}, mainA);
		const b = outlineMaterial({}, mainB);
		const main = a.textureNode("_MainTex");
		expect(b.textureNode("_MainTex")).toBe(main);
		const sampled = main.sample(main.uvNode ?? main.getDefaultUV());

		main.update(drawOf(b));
		expect(sampled.value).toBe(mainB);
		main.update(drawOf(a));
		expect(sampled.value).toBe(mainA);
		b.setTexture("_MainTex", null);
		main.update(drawOf(b));
		expect(sampled.value).toBe(b.getTexture("_MainTex"));
		expect(sampled.value).not.toBe(mainB);
	});

	it("sets the texture in the update phase, so a shadow render in the update-before phase does not replace it", () => {
		const mainA = new Texture();
		const a = outlineMaterial({}, mainA);
		const b = outlineMaterial({}, new Texture());
		const main = a.textureNode("_MainTex");
		// r187 renders a shadow map in the update-before phase of the first draw. Its caster draws sync the shared node
		// to their own texture; the update phase of the outer draw must come after them.
		expect(main.updateBeforeType).toBe(NodeUpdateType.NONE);
		expect(main.updateType).toBe(NodeUpdateType.OBJECT);
		main.update(drawOf(new NodeMaterial(), b));
		main.update(drawOf(a));
		expect(main.value).toBe(mainA);
	});

	it("reads the source material in a shadow pass", () => {
		const main = new Texture();
		const a = outlineMaterial({ _Color: [1, 0, 0, 0.5] }, main);
		const b = outlineMaterial({ _Color: [0, 1, 0, 1] });
		const color = a.propertyNode("_Color", "vec4");
		const texture = a.textureNode("_MainTex");
		color.update(drawOf(b));
		texture.update(drawOf(b));
		const shadow = new NodeMaterial();
		color.update(drawOf(shadow, a));
		texture.update(drawOf(shadow, a));
		expect(color.value.toArray()).toEqual([1, 0, 0, 0.5]);
		expect(texture.value).toBe(main);
	});
});
