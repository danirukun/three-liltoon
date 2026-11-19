import { Texture } from "three";
import type { Node, NodeBuilder } from "three/webgpu";
import { float, setCurrentStack, stack, vec3 } from "three/tsl";
import { describe, expect, it } from "vitest";
import { LilToonLightingModel } from "../../src/webgpu/LilToonLightingModel";
import { LilToonNodeMaterial } from "../../src/webgpu/LilToonNodeMaterial";

type Light = { shadowNode: Node | null; baseColorNode: Node | null };

// A stand-in for the r187 lighting context. It builds the node graph only; it does not compile WGSL.
const fakeContext = () => ({
	reflectedLight: {
		directDiffuse: vec3().toVar(),
		directSpecular: vec3().toVar(),
		indirectDiffuse: vec3().toVar(),
		indirectSpecular: vec3().toVar(),
	},
	irradiance: vec3(0.2).toVar(),
	iblIrradiance: vec3(0.1).toVar(),
	outgoingLight: vec3().toVar(),
});

const runModel = (material: LilToonNodeMaterial, lights: Light[]) => {
	const model = material.setupLightingModel() as LilToonLightingModel;
	const context = fakeContext();
	const builder = {
		context,
		lightsNode: {
			setupLights: () => {
				for (const lightNode of lights)
					model.direct({
						lightDirection: vec3(0, 0, 1),
						lightColor: vec3(1, 1, 1),
						lightNode,
						reflectedLight: context.reflectedLight,
					} as never);
			},
			getLightNodes: () => [],
		},
	} as unknown as NodeBuilder;
	// The assignments go into a stack, as in LightsNode.setup.
	const nodes = stack();
	setCurrentStack(nodes);
	try {
		model.start(builder);
		model.finish(builder);
	} finally {
		setCurrentStack(null);
	}
	// The assignment statements, by the name of their target variable.
	const assigned = (nodes.nodes as { targetNode?: Node & { name?: string } }[])
		.map((node) => node.targetNode)
		.filter((target) => target !== undefined)
		.map((target) =>
			target === context.outgoingLight ? "outgoingLight" : target.name,
		);
	return { ...context, assigned };
};

// The getShadow hook that setupLighting puts into the lighting context.
const getShadowOf = (material: LilToonNodeMaterial) => {
	const builder = {
		material,
		renderer: { lighting: { enabled: true } },
		lightsNode: { getScope: () => ({ hasLights: true }) },
		context: {},
	} as unknown as NodeBuilder;
	const node = material.setupLighting(builder) as unknown as {
		value: { getShadow: (light: Light) => Node | null };
	};
	return node.value.getShadow;
};

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
