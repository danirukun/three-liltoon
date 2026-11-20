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
	lilBlendColor,
	lilLimitLight,
	lilOutlineWidth,
} from "./webgpu/lilToonMath.js";
export {
	lilToonShadingInputs,
	tslBacklight,
	tslBacklightColor,
	tslBlendColor,
	tslEmission,
	tslMatCap,
	tslOutlineColor,
	tslOutlinePosition,
	tslRim,
	type LilToonShadingInputs,
	type LilToonSurface,
} from "./webgpu/lilToonShading.js";
export { generateLilToonOutlines } from "./webgpu/outlines.js";
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
export {
	GLTFLilToonNodeExtension,
	type GLTFLilToonNodeExtensionOptions,
	type LilToonNodeMaterialType,
	type LilToonNodeWarning,
	type LilToonNodeWarningCode,
} from "./webgpu/GLTFLilToonNodeExtension.js";
export { ensureLilToonNodeTangents } from "./webgpu/tangents.js";
export {
	LILTOON_TRANSPARENT_QUEUE,
	lilToonRenderOrder,
	type RenderOrderAnchor,
} from "./webgpu/renderOrder.js";
export { enableLilToonNodeVRM } from "./webgpu/vrm.js";
export {
	LILTOON_GLTF_EXTENSION,
	LILTOON_GLTF_SPEC_VERSION,
	type GLTFLilToonMaterialDefinition,
} from "./loaders/types.js";
