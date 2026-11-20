import { Texture } from "three";
import type { Node } from "three/webgpu";
import { float, vec3 } from "three/tsl";
import { describe, expect, it } from "vitest";
import { LilToonLightingModel } from "../../src/webgpu/LilToonLightingModel";
import { LilToonNodeMaterial } from "../../src/webgpu/LilToonNodeMaterial";
import {
	limitClampsIn,
	contains,
	getShadowOf,
	runModel,
	type Light,
	type StackEntry,
} from "./fakeLighting";

describe("LilToonLightingModel", () => {
	it("is the lighting model of the material and holds it", () => {
		const material = new LilToonNodeMaterial();
		const model = material.setupLightingModel();
		expect(model).toBeInstanceOf(LilToonLightingModel);
		expect((model as LilToonLightingModel).material).toBe(material);
	});

	it("calls the receivedShadow hook of a subclass for a shadowed light only", () => {
		const seen: Node[] = [];
		class Sub extends LilToonNodeMaterial {
			protected override receivedShadow(shadow: Node<"float">): Node<"float"> {
				seen.push(shadow);
				return shadow;
			}
		}
		const material = new Sub({
			properties: { _UseShadow: 1, _ShadowReceive: 1 },
		});
		const shadowed: Light = { shadowNode: float(0.3), baseColorNode: vec3(1) };
		const plain: Light = { shadowNode: float(0.7), baseColorNode: vec3(1) };
		const getShadow = getShadowOf(material);
		expect(getShadow(shadowed)).toBe(shadowed.baseColorNode);
		runModel(material, [shadowed, plain]);
		expect(seen).toEqual([shadowed.shadowNode]);
	});

	it("keeps the shadowed lights of its own build when the material builds again", () => {
		const seen: Node[] = [];
		const models: LilToonLightingModel[] = [];
		class Sub extends LilToonNodeMaterial {
			override setupLightingModel(): LilToonLightingModel {
				const model = super.setupLightingModel() as LilToonLightingModel;
				models.push(model);
				return model;
			}
			protected override receivedShadow(shadow: Node<"float">): Node<"float"> {
				seen.push(shadow);
				return shadow;
			}
		}
		const material = new Sub({
			properties: { _UseShadow: 1, _ShadowReceive: 1 },
		});
		const shadowed: Light = { shadowNode: float(0.3), baseColorNode: vec3(1) };
		// r187 buildAsync runs setupLighting, awaits, and runs the model start later. A sync build can come between.
		getShadowOf(material)(shadowed);
		getShadowOf(material);
		expect(models).toHaveLength(2);
		runModel(models[0]!, [shadowed]);
		expect(seen).toEqual([shadowed.shadowNode]);
		runModel(models[1]!, [shadowed]);
		expect(seen).toEqual([shadowed.shadowNode]);
	});

	it("samples the shadow masks once for each build", () => {
		const material = new LilToonNodeMaterial({
			properties: { _UseShadow: 1 },
			textures: {
				_ShadowStrengthMask: new Texture(),
				_ShadowBlurMask: new Texture(),
				_ShadowBorderMask: new Texture(),
			},
		});
		const light: Light = { shadowNode: null, baseColorNode: null };
		const { assigned } = runModel(material, [light, light]);
		expect(assigned).toEqual([
			"lilShadowBlurMask",
			"lilShadowBorderMask",
			"lilLight",
			"lilLightWeight",
			"lilBands",
			"lilLight",
			"lilLightWeight",
			"lilBands",
			"lilAmbient",
			"outgoingLight",
		]);
	});

	it("passes the context irradiance to the roomIrradiance hook of a subclass", () => {
		const calls: Node[][] = [];
		class Sub extends LilToonNodeMaterial {
			protected override roomIrradiance(
				irradiance: Node<"vec3">,
				iblIrradiance: Node<"vec3">,
			): Node<"vec3"> | null {
				calls.push([irradiance, iblIrradiance]);
				return irradiance.add(iblIrradiance);
			}
		}
		const context = runModel(new Sub(), []);
		expect(calls).toEqual([[context.irradiance, context.iblIrradiance]]);
	});

	it("builds the graph with every shadow band and color texture", () => {
		const material = new LilToonNodeMaterial({
			properties: { _UseShadow: 1, _Shadow3rdColor: [0, 0, 1, 0.5] },
			textures: {
				_ShadowColorTex: new Texture(),
				_Shadow2ndColorTex: new Texture(),
				_Shadow3rdColorTex: new Texture(),
			},
		});
		const { assigned } = runModel(material, [
			{ shadowNode: null, baseColorNode: null },
		]);
		expect(assigned).toEqual([
			"lilLight",
			"lilLightWeight",
			"lilBands",
			"lilAmbient",
			"outgoingLight",
		]);
	});

	it("starts the band sum at zero in all four components", () => {
		// vec4() with no value is a Vector4 with w 1. The fourth component is the shadow border band (lns.w), which
		// lilShade multiplies into _ShadowBorderColor; a start value of 1 lifts the red channel of every pixel.
		const material = new LilToonNodeMaterial({ properties: { _UseShadow: 1 } });
		const { entries } = runModel(material, [
			{ shadowNode: null, baseColorNode: null },
		]);
		const bands = entries.find((entry) => entry.targetNode?.name === "lilBands")
			?.targetNode as
			| (Node & {
					node: { value: { x: number; y: number; z: number; w: number } };
			  })
			| undefined;
		expect(bands).toBeDefined();
		const { x, y, z, w } = bands!.node.value;
		expect([x, y, z, w]).toEqual([0, 0, 0, 0]);
	});

	it("builds the lighting graph when a lighting property had a wrong shape", () => {
		// A scalar for a vec4, or a vec4 for a scalar, would throw in propertyNode at node build. The default stands in.
		const material = new LilToonNodeMaterial({
			properties: {
				_UseShadow: 1,
				_UseRim: 1,
				_ShadowColor: 0.5,
				_ShadowBorder: [1, 1, 1, 1],
				_RimColor: "pink",
				_LightMaxLimit: null,
			} as never,
		});
		expect(() =>
			runModel(material, [{ shadowNode: null, baseColorNode: null }]),
		).not.toThrow();
	});

	// The variable that one assignment of runModel writes, by its name.
	const variable = (entries: StackEntry[], name: string) =>
		entries.find((entry) => entry.targetNode?.name === name)!.targetNode!;

	it("limits the summed light with the ambient inside the limit, once", () => {
		// lil_common_functions.hlsl:999 and lil_common_macro.hlsl:2081-2088: lightColor = main light + SH ambient, then
		// one clamp between _LightMinLimit and _LightMaxLimit. The ambient is not a second term outside the limit.
		const light: Light = { shadowNode: null, baseColorNode: null };
		const material = new LilToonNodeMaterial();
		const plain = runModel(material, [light]);
		const clamps = limitClampsIn(plain.outgoing, material);
		expect(clamps).toHaveLength(1);
		expect(
			contains(clamps[0]!.aNode, variable(plain.entries, "lilLight")),
		).toBe(true);
		expect(
			contains(clamps[0]!.aNode, variable(plain.entries, "lilAmbient")),
		).toBe(true);
		const outsideTheLimit = contains(
			plain.outgoing,
			variable(plain.entries, "lilAmbient"),
			(node) => node === clamps[0],
		);
		expect(outsideTheLimit).toBe(false);
	});

	it("gives the shading, the effects, and the outline the same limited light color", () => {
		const light: Light = { shadowNode: null, baseColorNode: null };
		const material = new LilToonNodeMaterial({
			shaderVariant: "Hidden/lilToonOutline",
			properties: {
				_UseShadow: 1,
				_UseRim: 1,
				_UseMatCap: 1,
				_UseBacklight: 1,
			},
		});
		const surface = runModel(material, [light]);
		const clamps = limitClampsIn(surface.outgoing, material);
		expect(clamps).toHaveLength(1);
		expect(
			contains(clamps[0]!.aNode, variable(surface.entries, "lilAmbient")),
		).toBe(true);
		// fd.indLightColor × _ShadowEnvStrength is the only other read of the ambient (lil_common_frag.hlsl:1125).
		const envStrength = material.propertyNode("_ShadowEnvStrength", "float");
		const outsideTheLimit = contains(
			surface.outgoing,
			variable(surface.entries, "lilAmbient"),
			(node) => node === clamps[0] || node.getChildren().includes(envStrength),
		);
		expect(outsideTheLimit).toBe(false);
		const outline = material.clone();
		outline.isOutline = true;
		const pass = runModel(outline, [light]);
		const outlineClamps = limitClampsIn(pass.outgoing, outline);
		expect(outlineClamps).toHaveLength(1);
		expect(
			contains(outlineClamps[0]!.aNode, variable(pass.entries, "lilAmbient")),
		).toBe(true);
		expect(
			contains(outlineClamps[0]!.aNode, variable(pass.entries, "lilLight")),
		).toBe(true);
	});

	it("only sums the light without _UseShadow", () => {
		const { assigned } = runModel(new LilToonNodeMaterial(), [
			{ shadowNode: null, baseColorNode: null },
		]);
		expect(assigned).toEqual(["lilLight", "lilAmbient", "outgoingLight"]);
	});
});
