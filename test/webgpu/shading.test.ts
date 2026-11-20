import {
	BackSide,
	BoxGeometry,
	DoubleSide,
	FrontSide,
	Texture,
	type BufferGeometry,
} from "three";
import { NormalMapNode, type Node, type NodeBuilder } from "three/webgpu";
import { faceDirection, float, vec3 } from "three/tsl";
import { describe, expect, it } from "vitest";
import { LilToonNodeMaterial } from "../../src/webgpu/LilToonNodeMaterial";
import {
	lilBlendColor,
	lilFaceNormal,
	lilOutlineWidth,
} from "../../src/webgpu/lilToonMath";
import {
	lilToonShadingInputs,
	tslEmission,
	tslOutlineColor,
} from "../../src/webgpu/lilToonShading";
import { contains, runModel, type Light } from "./fakeLighting";

const light: Light = { shadowNode: null, baseColorNode: null };
const isNormalMap = (node: Node) => node instanceof NormalMapNode;

const close = (actual: readonly number[], expected: readonly number[]) =>
	actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i]!, 6));

describe("lilBlendColor", () => {
	const dst = [0.2, 0.4, 0.6] as const;
	const src = [0.5, 0.5, 0.5] as const;

	it("blends with the four lilToon modes", () => {
		close(lilBlendColor(dst, src, 1, 0), [0.5, 0.5, 0.5]);
		close(lilBlendColor(dst, src, 1, 1), [0.7, 0.9, 1.1]);
		close(lilBlendColor(dst, src, 1, 2), [0.6, 0.7, 0.8]);
		close(lilBlendColor(dst, src, 1, 3), [0.1, 0.2, 0.3]);
		close(lilBlendColor(dst, src, [0, 0.5, 1], 1), [0.2, 0.65, 1.1]);
	});

	it("uses mode 0 for a mode outside 0-3", () => {
		close(lilBlendColor(dst, src, 0.5, 7), lilBlendColor(dst, src, 0.5, 0));
	});
});

describe("lilOutlineWidth", () => {
	it("is in centimetres and follows the mask", () => {
		expect(lilOutlineWidth(0.08, 1, 0, 0.3)).toBeCloseTo(0.0008, 9);
		expect(lilOutlineWidth(0.08, 0.5, 0, 0.3)).toBeCloseTo(0.0004, 9);
	});

	it("narrows the outline near the camera by _OutlineFixWidth", () => {
		expect(lilOutlineWidth(0.1, 1, 0.5, 0.2)).toBeCloseTo(0.001 * 0.6, 9);
		expect(lilOutlineWidth(0.1, 1, 1, 3)).toBeCloseTo(0.001, 9);
	});
});

describe("LilToonNodeMaterial shading features", () => {
	it("changes the program key when _UseRim toggles", () => {
		const off = new LilToonNodeMaterial({ properties: { _UseRim: 0 } });
		const on = new LilToonNodeMaterial({ properties: { _UseRim: 1 } });
		expect(on.customProgramCacheKey()).not.toBe(off.customProgramCacheKey());
	});

	it("warns about a _MatCapBlendMode outside 0-3", () => {
		const material = new LilToonNodeMaterial({
			name: "Face",
			properties: { _UseMatCap: 1, _MatCapBlendMode: 5 },
		});
		const warnings = material.getWarnings();
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toMatchObject({
			code: "unsupported-feature",
			materialName: "Face",
			property: "_MatCapBlendMode",
		});
		expect(warnings[0]!.message).toContain("uses 0");
		material.setProperty("_MatCapBlendMode", 3);
		expect(material.getWarnings()).toEqual([]);
	});

	it("maps _Cull to the side", () => {
		const material = new LilToonNodeMaterial();
		expect(material.side).toBe(FrontSide);
		material.setProperty("_Cull", 0);
		expect(material.side).toBe(DoubleSide);
		material.setProperty("_Cull", 1);
		expect(material.side).toBe(BackSide);
		expect(new LilToonNodeMaterial({ properties: { _Cull: 0 } }).side).toBe(
			DoubleSide,
		);
	});

	it("adds rim, backlight, matcap, and emission to the outgoing light", () => {
		const terms = [
			"_RimColor",
			"_BacklightColor",
			"_MatCapColor",
			"_EmissionColor",
		];
		const plain = new LilToonNodeMaterial();
		const lit = runModel(plain, [light]);
		for (const name of terms)
			expect(contains(lit.outgoing, plain.propertyNode(name, "vec4"))).toBe(
				false,
			);
		const material = new LilToonNodeMaterial({
			properties: {
				_UseRim: 1,
				_UseBacklight: 1,
				_UseMatCap: 1,
				_UseEmission: 1,
			},
			textures: {
				_MatCapTex: new Texture(),
				_MatCapBlendMask: new Texture(),
				_EmissionMap: new Texture(),
				_EmissionBlendMask: new Texture(),
				_RimColorTex: new Texture(),
				_BacklightColorTex: new Texture(),
			},
		});
		const { assigned, outgoing } = runModel(material, [light, light]);
		expect(assigned).toEqual([
			"lilLight",
			"lilLightWeight",
			"lilBacklight",
			"lilLight",
			"lilLightWeight",
			"lilBacklight",
			"lilAmbient",
			"outgoingLight",
		]);
		for (const name of terms)
			expect(contains(outgoing, material.propertyNode(name, "vec4"))).toBe(
				true,
			);
		expect(contains(outgoing, material.textureNode("_MatCapTex"))).toBe(true);
	});

	it("passes the cast shadow of a light to the backlight through receivedShadow", () => {
		const seen: Node[] = [];
		class Sub extends LilToonNodeMaterial {
			protected override receivedShadow(shadow: Node<"float">): Node<"float"> {
				seen.push(shadow);
				return shadow;
			}
		}
		const material = new Sub({ properties: { _UseBacklight: 1 } });
		const shadowed: Light = { shadowNode: float(0.3), baseColorNode: vec3(1) };
		const getShadow = (
			material.setupLighting({
				material,
				renderer: { lighting: { enabled: true } },
				lightsNode: { getScope: () => ({ hasLights: true }) },
				context: {},
			} as never) as unknown as {
				value: { getShadow: (light: Light) => Node | null };
			}
		).value.getShadow;
		getShadow(shadowed);
		runModel(material, [shadowed, light]);
		expect(seen).toEqual([shadowed.shadowNode]);
	});
});

describe("LilToonNodeMaterial normal map", () => {
	const mapped = () =>
		new LilToonNodeMaterial({
			properties: { _UseShadow: 1, _UseBumpMap: 1 },
			textures: { _BumpMap: new Texture() },
		});

	it("maps the normal with _BumpMap and _BumpScale", () => {
		const material = mapped();
		const normal = material.setupNormal();
		expect(contains(normal, isNormalMap)).toBe(true);
		expect(contains(normal, material.propertyNode("_BumpScale", "float"))).toBe(
			true,
		);
		expect(material.normalNode).toBeNull();
	});

	it("keeps the geometry normal without the toggle or the texture", () => {
		const off = new LilToonNodeMaterial({
			textures: { _BumpMap: new Texture() },
		});
		expect(contains(off.setupNormal(), isNormalMap)).toBe(false);
		const empty = new LilToonNodeMaterial({ properties: { _UseBumpMap: 1 } });
		expect(contains(empty.setupNormal(), isNormalMap)).toBe(false);
	});

	it("keeps the geometry normal on the outline", () => {
		const outline = mapped();
		outline.isOutline = true;
		expect(contains(outline.setupNormal(), isNormalMap)).toBe(false);
	});

	it("mixes the shadow normal by _ShadowNormalStrength", () => {
		const material = mapped();
		const strength = material.propertyNode("_ShadowNormalStrength", "float");
		const [bands] = runModel(material, [light]).sourcesOf("lilBands");
		expect(contains(bands, strength)).toBe(true);
		const plain = new LilToonNodeMaterial({ properties: { _UseShadow: 1 } });
		const unused = plain.propertyNode("_ShadowNormalStrength", "float");
		const [plainBands] = runModel(plain, [light]).sourcesOf("lilBands");
		expect(plainBands).toBeDefined();
		expect(contains(plainBands, unused)).toBe(false);
	});
});

describe("the face normal", () => {
	// A DoubleSide back face: three gives the negated vertex normal.
	const vertex = [0, 0.6, 0.8] as const;
	const threeBack = [0, -0.6, -0.8] as const;

	it("uses the vertex normal on a back face, as lilToon does", () => {
		close(lilFaceNormal(threeBack, -1, 0), vertex);
		close(lilFaceNormal(vertex, 1, 0), vertex);
	});

	it("negates the back-face normal with _FlipNormal 1", () => {
		close(lilFaceNormal(threeBack, -1, 1), threeBack);
		close(lilFaceNormal(vertex, 1, 1), vertex);
	});

	it("reads faceDirection and _FlipNormal for the bands and the effects", () => {
		const material = new LilToonNodeMaterial({
			properties: { _Cull: 0, _UseShadow: 1, _UseRim: 1, _UseMatCap: 1 },
		});
		expect(material.side).toBe(DoubleSide);
		const flip = material.propertyNode("_FlipNormal", "float");
		const { outgoing, sourcesOf } = runModel(material, [light]);
		const [bands] = sourcesOf("lilBands");
		expect(contains(bands, flip)).toBe(true);
		expect(contains(bands, faceDirection)).toBe(true);
		expect(contains(outgoing, flip)).toBe(true);
	});
});

describe("the UV of the outline texture and the emission mask", () => {
	it("samples _OutlineTex at uv0 × _OutlineTex_ST", () => {
		const material = new LilToonNodeMaterial({
			textures: { _OutlineTex: new Texture() },
		});
		const inputs = lilToonShadingInputs(material, () => true);
		const color = tslOutlineColor(inputs);
		expect(
			contains(color, material.propertyNode("_OutlineTex_ST", "vec4")),
		).toBe(true);
		expect(contains(color, inputs.uvMain)).toBe(false);
		expect(contains(color, material.propertyNode("_MainTex_ST", "vec4"))).toBe(
			false,
		);
	});

	it("samples _EmissionBlendMask at uv0 × _EmissionBlendMask_ST", () => {
		const material = new LilToonNodeMaterial({
			properties: { _UseEmission: 1 },
			textures: { _EmissionBlendMask: new Texture() },
		});
		const inputs = lilToonShadingInputs(
			material,
			(name) => name === "_EmissionBlendMask",
		);
		const col = tslEmission(vec3(0), {
			inputs,
			albedo: vec3(1),
			alpha: float(1),
			transparent: false,
			lightColor: vec3(1),
			shadowmix: float(1),
			normal: vec3(0, 0, 1),
			geometryNormal: null,
		});
		expect(
			contains(col, material.propertyNode("_EmissionBlendMask_ST", "vec4")),
		).toBe(true);
		expect(contains(col, inputs.uvMain)).toBe(false);
		expect(contains(col, material.propertyNode("_MainTex_ST", "vec4"))).toBe(
			false,
		);
	});
});

describe("the normal map Y", () => {
	const material = () =>
		new LilToonNodeMaterial({
			properties: { _UseBumpMap: 1 },
			textures: { _BumpMap: new Texture() },
		});
	const builderOf = (geometry: BufferGeometry) =>
		({ geometry }) as unknown as NodeBuilder;
	// The NormalMapNode scale has a negated `_BumpScale`.
	const negatesY = (normal: Node, scale: Node) =>
		contains(
			normal,
			(node) =>
				node instanceof NormalMapNode &&
				contains(
					node.scaleNode,
					(child) =>
						(child as { method?: string }).method === "negate" &&
						contains(child, scale),
				),
		);

	it("negates Y without a tangent attribute, as GLTFLoader does", () => {
		const m = material();
		const scale = m.propertyNode("_BumpScale", "float");
		const normal = m.setupNormal(builderOf(new BoxGeometry()));
		expect(contains(normal, isNormalMap)).toBe(true);
		expect(negatesY(normal, scale)).toBe(true);
	});

	it("keeps Y with a tangent attribute", () => {
		const m = material();
		const scale = m.propertyNode("_BumpScale", "float");
		const geometry = new BoxGeometry();
		geometry.computeTangents();
		const normal = m.setupNormal(builderOf(geometry));
		expect(contains(normal, isNormalMap)).toBe(true);
		expect(negatesY(normal, scale)).toBe(false);
	});
});

describe("LilToonNodeMaterial isOutline", () => {
	it("sets the side and rebuilds when it changes", () => {
		const material = new LilToonNodeMaterial();
		const version = material.version;
		material.isOutline = true;
		expect(material.side).toBe(BackSide);
		expect(material.version).toBe(version + 1);
		material.isOutline = true;
		expect(material.version).toBe(version + 1);
		material.isOutline = false;
		expect(material.side).toBe(FrontSide);
		expect(material.version).toBe(version + 2);
	});
});
