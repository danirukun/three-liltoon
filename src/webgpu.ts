// Later tasks replace the placeholders with the WebGPU implementation.
export {
	LilToonNodeMaterial,
	type LilToonNodeMaterialParameters,
} from "./webgpu/LilToonNodeMaterial.js";
export {
	LilToonLightingModel,
	type LilToonLightingHost,
} from "./webgpu/LilToonLightingModel.js";
export {
	UNITY_LIGHT_SCALE,
	lilBand,
	lilLimitLight,
} from "./webgpu/lilToonMath.js";
export {
	LILTOON_NODE_FEATURES,
	LILTOON_NODE_VARIANTS,
	nodeProperties,
	nodeVariant,
	nodeWarnings,
	type LilToonNodeMode,
	type LilToonNodeValue,
	type LilToonNodeVariant,
	type LilToonScalarOrVector,
} from "./webgpu/properties.js";

export class GLTFLilToonNodeExtension {}

export const enableLilToonNodeVRM = (): void => {};
