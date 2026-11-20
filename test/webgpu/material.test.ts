import { LinearSRGBColorSpace, SRGBColorSpace, Texture } from "three";
import { LightingModel } from "three/webgpu";
import { float } from "three/tsl";
import { describe, expect, it } from "vitest";
import { LILTOON_DEFAULTS } from "../../src/generated/defaults";
import { getNeutralTexture } from "../../src/utils/texture";
import { LilToonNodeMaterial } from "../../src/webgpu/LilToonNodeMaterial";

describe("LilToonNodeMaterial alpha modes", () => {
	it("keeps an opaque material opaque", () => {
		const material = new LilToonNodeMaterial();
		expect(material.variant).toBe("lilToon");
		expect(material.transparent).toBe(false);
		expect(material.alphaTest).toBe(0);
		expect(material.hasOutline).toBe(false);
		expect(material.isOutline).toBe(false);
	});

	it("uses _Cutoff as alphaTest for a cutout variant", () => {
		const material = new LilToonNodeMaterial({
			shaderVariant: "Hidden/lilToonCutout",
			properties: { _Cutoff: 0.3 },
		});
		expect(material.alphaTest).toBe(0.3);
		expect(material.transparent).toBe(false);
		material.setProperty("_Cutoff", 0.6);
		expect(material.alphaTest).toBe(0.6);
	});

	it("blends without depth write for a transparent variant", () => {
		const material = new LilToonNodeMaterial({
			shaderVariant: "Hidden/lilToonTransparent",
		});
		expect(material.transparent).toBe(true);
		expect(material.depthWrite).toBe(false);
		expect(material.alphaTest).toBe(0);
	});

	it("marks an outline variant", () => {
		const material = new LilToonNodeMaterial({
			shaderVariant: "Hidden/lilToonCutoutOutline",
		});
		expect(material.hasOutline).toBe(true);
		// The surface pass. generateLilToonOutlines makes the outline pass.
		expect(material.isOutline).toBe(false);
		expect(material.variant).toBe("Hidden/lilToonCutoutOutline");
	});

	it("falls back to lilToon and warns for an unsupported shader", () => {
		const material = new LilToonNodeMaterial({
			name: "Hair",
			shaderVariant: "Hidden/lilToonFur",
		});
		expect(material.variant).toBe("lilToon");
		const warnings = material.getWarnings();
		expect(warnings.map((w) => w.code)).toEqual(["unsupported-shader-variant"]);
		expect(warnings[0]!.materialName).toBe("Hair");
	});

	it("builds a colorNode and an opacityNode", () => {
		const material = new LilToonNodeMaterial();
		expect(material.colorNode).not.toBeNull();
		expect(material.opacityNode).not.toBeNull();
		expect(material.lights).toBe(true);
	});
});

describe("LilToonNodeMaterial properties", () => {
	it("sets a number without a new version", () => {
		const material = new LilToonNodeMaterial();
		const version = material.version;
		material.setProperty("_ShadowBorder", 0.3);
		expect(material.getProperty("_ShadowBorder")).toBe(0.3);
		expect(material.version).toBe(version);
	});

	it("feeds the uniform nodes without a new compile", () => {
		const material = new LilToonNodeMaterial();
		const version = material.version;
		material.setProperty("_ShadowBorder", 0.3);
		material.setProperty("_Color", [0.1, 0.2, 0.3, 0.4]);
		expect(material.propertyNode("_ShadowBorder", "float").value).toBe(0.3);
		expect(material.propertyNode("_Color", "vec4").value.toArray()).toEqual([
			0.1, 0.2, 0.3, 0.4,
		]);
		expect(material.version).toBe(version);
	});

	it("changes the program key and version when a feature toggles", () => {
		const material = new LilToonNodeMaterial({ properties: { _UseRim: 1 } });
		const key = material.customProgramCacheKey();
		const version = material.version;
		material.setProperty("_UseRim", 0);
		expect(material.customProgramCacheKey()).not.toBe(key);
		expect(material.version).toBeGreaterThan(version);
	});

	it("keeps the key for a toggle of a feature the node path does not draw", () => {
		const material = new LilToonNodeMaterial();
		const key = material.customProgramCacheKey();
		material.setProperty("_UseMain2ndTex", 1);
		expect(material.customProgramCacheKey()).toBe(key);
	});

	it("uses own copies of array values", () => {
		const color = [1, 0, 0, 1];
		const material = new LilToonNodeMaterial({ properties: { _Color: color } });
		color[0] = 0;
		expect(material.getProperty("_Color")).toEqual([1, 0, 0, 1]);
	});

	it("keeps the default and warns for a constructor value with a wrong shape", () => {
		const material = new LilToonNodeMaterial({
			properties: {
				_Color: null,
				_ShadowBorder: [0.5],
				_UseShadow: 1,
			} as never,
		});
		expect(material.getProperty("_Color")).toEqual(LILTOON_DEFAULTS._Color);
		expect(material.getProperty("_ShadowBorder")).toBe(
			LILTOON_DEFAULTS._ShadowBorder,
		);
		expect(material.getWarnings().map((w) => [w.code, w.property])).toEqual([
			["invalid-property-value", "_Color"],
			["invalid-property-value", "_ShadowBorder"],
		]);
	});

	it("ignores a setProperty value with a wrong shape and keeps the current value", () => {
		const material = new LilToonNodeMaterial({
			properties: { _ShadowBorder: 0.3 },
		});
		const version = material.version;
		material.setProperty("_ShadowBorder", [1, 2, 3, 4]);
		material.setProperty("_Color", "red" as never);
		expect(material.getProperty("_ShadowBorder")).toBe(0.3);
		expect(material.getProperty("_Color")).toEqual(LILTOON_DEFAULTS._Color);
		expect(material.version).toBe(version);
		expect(material.getWarnings().map((w) => w.property)).toEqual([
			"_ShadowBorder",
			"_Color",
		]);
		// A later value of the right shape clears the warning of that property.
		material.setProperty("_ShadowBorder", 0.4);
		expect(material.getProperty("_ShadowBorder")).toBe(0.4);
		expect(material.getWarnings().map((w) => w.property)).toEqual(["_Color"]);
	});

	it("warns about an enabled feature outside the supported set", () => {
		const material = new LilToonNodeMaterial({
			properties: { _UseMain2ndTex: 1 },
		});
		expect(material.getWarnings().map((w) => w.property)).toEqual([
			"_UseMain2ndTex",
		]);
	});
});

describe("LilToonNodeMaterial textures", () => {
	it("uses the white neutral texture for a missing _MainTex", () => {
		const material = new LilToonNodeMaterial();
		material.setTexture("_MainTex", null);
		expect(material.getTexture("_MainTex")).toBe(getNeutralTexture("white"));
	});

	it("normalizes color spaces by semantic", () => {
		const main = new Texture();
		const bump = new Texture();
		const material = new LilToonNodeMaterial({
			textures: { _MainTex: main, _BumpMap: bump },
		});
		expect(main.colorSpace).toBe(SRGBColorSpace);
		expect(bump.colorSpace).toBe(LinearSRGBColorSpace);
		expect(material.getTexture("_MainTex")).toBe(main);
	});

	it("feeds the texture node when the texture changes", () => {
		const material = new LilToonNodeMaterial();
		const node = material.textureNode("_MainTex");
		expect(node.value).toBe(getNeutralTexture("white"));
		const main = new Texture();
		material.setTexture("_MainTex", main);
		expect(node.value).toBe(main);
		material.setTexture("_MainTex", null);
		expect(node.value).toBe(getNeutralTexture("white"));
	});

	it("changes the program key when texture presence changes", () => {
		const material = new LilToonNodeMaterial();
		const key = material.customProgramCacheKey();
		material.setTexture("_BumpMap", new Texture());
		expect(material.customProgramCacheKey()).not.toBe(key);
		const present = material.customProgramCacheKey();
		const version = material.version;
		material.setTexture("_BumpMap", new Texture());
		expect(material.customProgramCacheKey()).toBe(present);
		expect(material.version).toBe(version);
	});
});

describe("LilToonNodeMaterial clone", () => {
	it("copies the state and isolates later changes", () => {
		const source = new LilToonNodeMaterial({
			shaderVariant: "Hidden/lilToonCutoutOutline",
			properties: { _Cutoff: 0.4, _Color: [1, 0, 0, 1] },
			textures: { _MainTex: new Texture() },
		});
		const clone = source.clone();
		expect(clone).toBeInstanceOf(LilToonNodeMaterial);
		expect(clone.variant).toBe("Hidden/lilToonCutoutOutline");
		expect(clone.hasOutline).toBe(true);
		expect(clone.alphaTest).toBe(0.4);
		expect(clone.getTexture("_MainTex")).toBe(source.getTexture("_MainTex"));

		clone.setProperty("_ShadowBorder", 0.9);
		clone.setProperty("_Color", [0, 1, 0, 1]);
		expect(source.getProperty("_ShadowBorder")).toBe(0.5);
		expect(source.getProperty("_Color")).toEqual([1, 0, 0, 1]);
		expect(source.propertyNode("_Color", "vec4").value.toArray()).toEqual([
			1, 0, 0, 1,
		]);
		expect(clone.getProperty("_Color")).not.toBe(source.getProperty("_Color"));
	});
});

describe("LilToonNodeMaterial subclass hooks", () => {
	it("lets a subclass supply its own lighting model", () => {
		class Custom extends LightingModel {}
		const model = new Custom();
		class Sub extends LilToonNodeMaterial {
			override setupLightingModel(): LightingModel {
				return model;
			}
		}
		expect(new Sub().setupLightingModel()).toBe(model);
		expect(new LilToonNodeMaterial().setupLightingModel()).toBeInstanceOf(
			LightingModel,
		);
	});

	it("rebuilds subclass nodes on clone", () => {
		class Sub extends LilToonNodeMaterial {
			protected override setupNodes(): void {
				super.setupNodes();
				this.alphaTestNode = float(1);
			}
		}
		const source = new Sub();
		expect(source.alphaTestNode).not.toBeNull();
		const clone = source.clone();
		expect(clone).toBeInstanceOf(Sub);
		expect(clone.alphaTestNode).not.toBeNull();
		expect(clone.alphaTestNode).not.toBe(source.alphaTestNode);
		// The main color nodes are shared by all materials and read the material they draw (programShare.test.ts).
		expect(clone.colorNode).toBe(source.colorNode);
	});
});
