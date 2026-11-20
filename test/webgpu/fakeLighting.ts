import type { Node, NodeBuilder } from "three/webgpu";
import { setCurrentStack, stack, vec3 } from "three/tsl";
import { LilToonLightingModel } from "../../src/webgpu/LilToonLightingModel";
import type { LilToonNodeMaterial } from "../../src/webgpu/LilToonNodeMaterial";

export type Light = { shadowNode: Node | null; baseColorNode: Node | null };

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

type StackEntry = { targetNode?: Node & { name?: string }; sourceNode?: Node };

export const runModel = (
	source: LilToonNodeMaterial | LilToonLightingModel,
	lights: Light[],
) => {
	const model =
		source instanceof LilToonLightingModel
			? source
			: (source.setupLightingModel() as LilToonLightingModel);
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
	const entries = nodes.nodes as StackEntry[];
	// The assignment statements, by the name of their target variable.
	const assigned = entries
		.map((node) => node.targetNode)
		.filter((target) => target !== undefined)
		.map((target) =>
			target === context.outgoingLight ? "outgoingLight" : target.name,
		);
	// The value added to the outgoing light.
	const outgoing = entries.find(
		(node) => node.targetNode === context.outgoingLight,
	)?.sourceNode;
	// The values assigned to one variable, such as the bands of each light.
	const sourcesOf = (name: string) =>
		entries
			.filter((node) => node.targetNode?.name === name)
			.map((node) => node.sourceNode);
	return { ...context, assigned, outgoing, sourcesOf };
};

// The getShadow hook that setupLighting puts into the lighting context.
export const getShadowOf = (material: LilToonNodeMaterial) => {
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

/** Whether the node graph under `root` has `target`, or a node that `target` accepts. */
export const contains = (
	root: Node | null | undefined,
	target: Node | ((node: Node) => boolean),
): boolean => {
	const test =
		typeof target === "function" ? target : (node: Node) => node === target;
	const seen = new Set<Node>();
	const visit = (node: Node | null | undefined): boolean => {
		if (!node || seen.has(node)) return false;
		seen.add(node);
		return test(node) || node.getChildren().some(visit);
	};
	return visit(root);
};
