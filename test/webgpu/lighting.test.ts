import { Texture } from "three";
import type { Node } from "three/webgpu";
import { float, vec3 } from "three/tsl";
import { describe, expect, it } from "vitest";
import { LilToonLightingModel } from "../../src/webgpu/LilToonLightingModel";
import { LilToonNodeMaterial } from "../../src/webgpu/LilToonNodeMaterial";
import { getShadowOf, runModel, type Light } from "./fakeLighting";

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

	it("only sums the light without _UseShadow", () => {
		const { assigned } = runModel(new LilToonNodeMaterial(), [
			{ shadowNode: null, baseColorNode: null },
		]);
		expect(assigned).toEqual(["lilLight", "lilAmbient", "outgoingLight"]);
	});
});
