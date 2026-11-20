import { BackSide, FrontSide, DoubleSide, Vector2, Vector3, Vector4, SRGBColorSpace, LinearSRGBColorSpace, RepeatWrapping, BufferAttribute, DataTexture, RGBAFormat, UnsignedByteType, LinearFilter } from 'three';
import { LightingModel, NodeMaterial } from 'three/webgpu';
import { positionLocal, uv, select, max, mix, pow, saturate as saturate$1, dot, positionViewDirection, normalize, float, abs, sqrt, modelWorldMatrix, vec4, length, cameraPosition, normalLocal, vec3, normalView, normalViewGeometry, frontFacing, diffuseColor, vec2, dFdx, dFdy, context, texture, normalMap, fwidth, faceDirection, cameraProjectionMatrix, cameraViewMatrix, cross, sin, time, round, min, uniform, clamp } from 'three/tsl';

// src/webgpu/LilToonNodeMaterial.ts

// src/generated/defaults.ts
var LILTOON_DEFAULTS = {
  "_DummyProperty": 0,
  "_Invisible": 0,
  "_AsUnlit": 0,
  "_Cutoff": 0.5,
  "_SubpassCutoff": 0.5,
  "_FlipNormal": 0,
  "_ShiftBackfaceUV": 0,
  "_BackfaceForceShadow": 0,
  "_BackfaceColor": [
    0,
    0,
    0,
    0
  ],
  "_VertexLightStrength": 0,
  "_LightMinLimit": 0.05,
  "_LightMaxLimit": 1,
  "_BeforeExposureLimit": 1e4,
  "_MonochromeLighting": 0,
  "_AlphaBoostFA": 10,
  "_lilDirectionalLightStrength": 1,
  "_LightDirectionOverride": [
    1e-3,
    2e-3,
    1e-3,
    0
  ],
  "_AAStrength": 1,
  "_UseDither": 0,
  "_DitherTex": {
    "texture": "white"
  },
  "_DitherMaxValue": 255,
  "_EnvRimBorder": 3,
  "_EnvRimBlur": 0.35,
  "_Color": [
    1,
    1,
    1,
    1
  ],
  "_MainTex": {
    "texture": "white"
  },
  "_MainTex_ScrollRotate": [
    0,
    0,
    0,
    0
  ],
  "_MainTexHSVG": [
    0,
    1,
    1,
    1
  ],
  "_MainGradationStrength": 0,
  "_MainGradationTex": {
    "texture": "white"
  },
  "_MainColorAdjustMask": {
    "texture": "white"
  },
  "_UseMain2ndTex": 0,
  "_Color2nd": [
    1,
    1,
    1,
    1
  ],
  "_Main2ndTex": {
    "texture": "white"
  },
  "_Main2ndTexAngle": 0,
  "_Main2ndTex_ScrollRotate": [
    0,
    0,
    0,
    0
  ],
  "_Main2ndTex_UVMode": 0,
  "_Main2ndTex_Cull": 0,
  "_Main2ndTexDecalAnimation": [
    1,
    1,
    1,
    30
  ],
  "_Main2ndTexDecalSubParam": [
    1,
    1,
    0,
    1
  ],
  "_Main2ndTexIsDecal": 0,
  "_Main2ndTexIsLeftOnly": 0,
  "_Main2ndTexIsRightOnly": 0,
  "_Main2ndTexShouldCopy": 0,
  "_Main2ndTexShouldFlipMirror": 0,
  "_Main2ndTexShouldFlipCopy": 0,
  "_Main2ndTexIsMSDF": 0,
  "_Main2ndBlendMask": {
    "texture": "white"
  },
  "_Main2ndTexBlendMode": 0,
  "_Main2ndTexAlphaMode": 0,
  "_Main2ndEnableLighting": 1,
  "_Main2ndDissolveMask": {
    "texture": "white"
  },
  "_Main2ndDissolveNoiseMask": {
    "texture": "gray"
  },
  "_Main2ndDissolveNoiseMask_ScrollRotate": [
    0,
    0,
    0,
    0
  ],
  "_Main2ndDissolveNoiseStrength": 0.1,
  "_Main2ndDissolveColor": [
    1,
    1,
    1,
    1
  ],
  "_Main2ndDissolveParams": [
    0,
    0,
    0.5,
    0.1
  ],
  "_Main2ndDissolvePos": [
    0,
    0,
    0,
    0
  ],
  "_Main2ndDistanceFade": [
    0.1,
    0.01,
    0,
    0
  ],
  "_UseMain3rdTex": 0,
  "_Color3rd": [
    1,
    1,
    1,
    1
  ],
  "_Main3rdTex": {
    "texture": "white"
  },
  "_Main3rdTexAngle": 0,
  "_Main3rdTex_ScrollRotate": [
    0,
    0,
    0,
    0
  ],
  "_Main3rdTex_UVMode": 0,
  "_Main3rdTex_Cull": 0,
  "_Main3rdTexDecalAnimation": [
    1,
    1,
    1,
    30
  ],
  "_Main3rdTexDecalSubParam": [
    1,
    1,
    0,
    1
  ],
  "_Main3rdTexIsDecal": 0,
  "_Main3rdTexIsLeftOnly": 0,
  "_Main3rdTexIsRightOnly": 0,
  "_Main3rdTexShouldCopy": 0,
  "_Main3rdTexShouldFlipMirror": 0,
  "_Main3rdTexShouldFlipCopy": 0,
  "_Main3rdTexIsMSDF": 0,
  "_Main3rdBlendMask": {
    "texture": "white"
  },
  "_Main3rdTexBlendMode": 0,
  "_Main3rdTexAlphaMode": 0,
  "_Main3rdEnableLighting": 1,
  "_Main3rdDissolveMask": {
    "texture": "white"
  },
  "_Main3rdDissolveNoiseMask": {
    "texture": "gray"
  },
  "_Main3rdDissolveNoiseMask_ScrollRotate": [
    0,
    0,
    0,
    0
  ],
  "_Main3rdDissolveNoiseStrength": 0.1,
  "_Main3rdDissolveColor": [
    1,
    1,
    1,
    1
  ],
  "_Main3rdDissolveParams": [
    0,
    0,
    0.5,
    0.1
  ],
  "_Main3rdDissolvePos": [
    0,
    0,
    0,
    0
  ],
  "_Main3rdDistanceFade": [
    0.1,
    0.01,
    0,
    0
  ],
  "_AlphaMaskMode": 0,
  "_AlphaMask": {
    "texture": "white"
  },
  "_AlphaMaskScale": 1,
  "_AlphaMaskValue": 0,
  "_UseBumpMap": 0,
  "_BumpMap": {
    "texture": "bump"
  },
  "_BumpScale": 1,
  "_UseBump2ndMap": 0,
  "_Bump2ndMap": {
    "texture": "bump"
  },
  "_Bump2ndMap_UVMode": 0,
  "_Bump2ndScale": 1,
  "_Bump2ndScaleMask": {
    "texture": "white"
  },
  "_UseAnisotropy": 0,
  "_AnisotropyTangentMap": {
    "texture": "bump"
  },
  "_AnisotropyScale": 1,
  "_AnisotropyScaleMask": {
    "texture": "white"
  },
  "_AnisotropyTangentWidth": 1,
  "_AnisotropyBitangentWidth": 1,
  "_AnisotropyShift": 0,
  "_AnisotropyShiftNoiseScale": 0,
  "_AnisotropySpecularStrength": 1,
  "_Anisotropy2ndTangentWidth": 1,
  "_Anisotropy2ndBitangentWidth": 1,
  "_Anisotropy2ndShift": 0,
  "_Anisotropy2ndShiftNoiseScale": 0,
  "_Anisotropy2ndSpecularStrength": 0,
  "_AnisotropyShiftNoiseMask": {
    "texture": "white"
  },
  "_Anisotropy2Reflection": 0,
  "_Anisotropy2MatCap": 0,
  "_Anisotropy2MatCap2nd": 0,
  "_UseBacklight": 0,
  "_BacklightColor": [
    0.85,
    0.8,
    0.7,
    1
  ],
  "_BacklightColorTex": {
    "texture": "white"
  },
  "_BacklightMainStrength": 0,
  "_BacklightNormalStrength": 1,
  "_BacklightBorder": 0.35,
  "_BacklightBlur": 0.05,
  "_BacklightDirectivity": 5,
  "_BacklightViewStrength": 1,
  "_BacklightReceiveShadow": 1,
  "_BacklightBackfaceMask": 1,
  "_UseShadow": 0,
  "_ShadowStrength": 1,
  "_ShadowStrengthMask": {
    "texture": "white"
  },
  "_ShadowStrengthMaskLOD": 0,
  "_ShadowBorderMask": {
    "texture": "white"
  },
  "_ShadowBorderMaskLOD": 0,
  "_ShadowBlurMask": {
    "texture": "white"
  },
  "_ShadowBlurMaskLOD": 0,
  "_ShadowAOShift": [
    1,
    0,
    1,
    0
  ],
  "_ShadowAOShift2": [
    1,
    0,
    1,
    0
  ],
  "_ShadowPostAO": 0,
  "_ShadowColorType": 0,
  "_ShadowColor": [
    0.82,
    0.76,
    0.85,
    1
  ],
  "_ShadowColorTex": {
    "texture": "black"
  },
  "_ShadowNormalStrength": 1,
  "_ShadowBorder": 0.5,
  "_ShadowBlur": 0.1,
  "_ShadowReceive": 0,
  "_Shadow2ndColor": [
    0.68,
    0.66,
    0.79,
    1
  ],
  "_Shadow2ndColorTex": {
    "texture": "black"
  },
  "_Shadow2ndNormalStrength": 1,
  "_Shadow2ndBorder": 0.15,
  "_Shadow2ndBlur": 0.1,
  "_Shadow2ndReceive": 0,
  "_Shadow3rdColor": [
    0,
    0,
    0,
    0
  ],
  "_Shadow3rdColorTex": {
    "texture": "black"
  },
  "_Shadow3rdNormalStrength": 1,
  "_Shadow3rdBorder": 0.25,
  "_Shadow3rdBlur": 0.1,
  "_Shadow3rdReceive": 0,
  "_ShadowBorderColor": [
    1,
    0.1,
    0,
    1
  ],
  "_ShadowBorderRange": 0.08,
  "_ShadowMainStrength": 0,
  "_ShadowEnvStrength": 0,
  "_ShadowMaskType": 0,
  "_ShadowFlatBorder": 1,
  "_ShadowFlatBlur": 1,
  "_UseRimShade": 0,
  "_RimShadeColor": [
    0.5,
    0.5,
    0.5,
    1
  ],
  "_RimShadeMask": {
    "texture": "white"
  },
  "_RimShadeNormalStrength": 1,
  "_RimShadeBorder": 0.5,
  "_RimShadeBlur": 1,
  "_RimShadeFresnelPower": 1,
  "_UseReflection": 0,
  "_Smoothness": 1,
  "_SmoothnessTex": {
    "texture": "white"
  },
  "_Metallic": 0,
  "_MetallicGlossMap": {
    "texture": "white"
  },
  "_Reflectance": 0.0030959752321981426,
  "_GSAAStrength": 0,
  "_ApplySpecular": 1,
  "_ApplySpecularFA": 1,
  "_SpecularToon": 1,
  "_SpecularNormalStrength": 1,
  "_SpecularBorder": 0.5,
  "_SpecularBlur": 0,
  "_ApplyReflection": 0,
  "_ReflectionNormalStrength": 1,
  "_ReflectionColor": [
    1,
    1,
    1,
    1
  ],
  "_ReflectionColorTex": {
    "texture": "white"
  },
  "_ReflectionApplyTransparency": 1,
  "_ReflectionCubeTex": {
    "texture": "black"
  },
  "_ReflectionCubeColor": [
    0,
    0,
    0,
    1
  ],
  "_ReflectionCubeOverride": 0,
  "_ReflectionCubeEnableLighting": 1,
  "_ReflectionBlendMode": 1,
  "_UseMatCap": 0,
  "_MatCapColor": [
    1,
    1,
    1,
    1
  ],
  "_MatCapTex": {
    "texture": "white"
  },
  "_MatCapMainStrength": 0,
  "_MatCapBlendUV1": [
    0,
    0,
    0,
    0
  ],
  "_MatCapZRotCancel": 1,
  "_MatCapPerspective": 1,
  "_MatCapVRParallaxStrength": 1,
  "_MatCapBlend": 1,
  "_MatCapBlendMask": {
    "texture": "white"
  },
  "_MatCapEnableLighting": 1,
  "_MatCapShadowMask": 0,
  "_MatCapBackfaceMask": 0,
  "_MatCapLod": 0,
  "_MatCapBlendMode": 1,
  "_MatCapApplyTransparency": 1,
  "_MatCapNormalStrength": 1,
  "_MatCapCustomNormal": 0,
  "_MatCapBumpMap": {
    "texture": "bump"
  },
  "_MatCapBumpScale": 1,
  "_UseMatCap2nd": 0,
  "_MatCap2ndColor": [
    1,
    1,
    1,
    1
  ],
  "_MatCap2ndTex": {
    "texture": "white"
  },
  "_MatCap2ndMainStrength": 0,
  "_MatCap2ndBlendUV1": [
    0,
    0,
    0,
    0
  ],
  "_MatCap2ndZRotCancel": 1,
  "_MatCap2ndPerspective": 1,
  "_MatCap2ndVRParallaxStrength": 1,
  "_MatCap2ndBlend": 1,
  "_MatCap2ndBlendMask": {
    "texture": "white"
  },
  "_MatCap2ndEnableLighting": 1,
  "_MatCap2ndShadowMask": 0,
  "_MatCap2ndBackfaceMask": 0,
  "_MatCap2ndLod": 0,
  "_MatCap2ndBlendMode": 1,
  "_MatCap2ndApplyTransparency": 1,
  "_MatCap2ndNormalStrength": 1,
  "_MatCap2ndCustomNormal": 0,
  "_MatCap2ndBumpMap": {
    "texture": "bump"
  },
  "_MatCap2ndBumpScale": 1,
  "_UseRim": 0,
  "_RimColor": [
    0.66,
    0.5,
    0.48,
    1
  ],
  "_RimColorTex": {
    "texture": "white"
  },
  "_RimMainStrength": 0,
  "_RimNormalStrength": 1,
  "_RimBorder": 0.5,
  "_RimBlur": 0.65,
  "_RimFresnelPower": 3.5,
  "_RimEnableLighting": 1,
  "_RimShadowMask": 0.5,
  "_RimBackfaceMask": 1,
  "_RimVRParallaxStrength": 1,
  "_RimApplyTransparency": 1,
  "_RimDirStrength": 0,
  "_RimDirRange": 0,
  "_RimIndirRange": 0,
  "_RimIndirColor": [
    1,
    1,
    1,
    1
  ],
  "_RimIndirBorder": 0.5,
  "_RimIndirBlur": 0.1,
  "_RimBlendMode": 1,
  "_UseGlitter": 0,
  "_GlitterUVMode": 0,
  "_GlitterColor": [
    1,
    1,
    1,
    1
  ],
  "_GlitterColorTex": {
    "texture": "white"
  },
  "_GlitterColorTex_UVMode": 0,
  "_GlitterMainStrength": 0,
  "_GlitterNormalStrength": 1,
  "_GlitterScaleRandomize": 0,
  "_GlitterApplyShape": 0,
  "_GlitterShapeTex": {
    "texture": "white"
  },
  "_GlitterAtras": [
    1,
    1,
    0,
    0
  ],
  "_GlitterAngleRandomize": 0,
  "_GlitterParams1": [
    256,
    256,
    0.16,
    50
  ],
  "_GlitterParams2": [
    0.25,
    0,
    0,
    0
  ],
  "_GlitterPostContrast": 1,
  "_GlitterSensitivity": 0.25,
  "_GlitterEnableLighting": 1,
  "_GlitterShadowMask": 0,
  "_GlitterBackfaceMask": 0,
  "_GlitterApplyTransparency": 1,
  "_GlitterVRParallaxStrength": 0,
  "_UseEmission": 0,
  "_EmissionColor": [
    1,
    1,
    1,
    1
  ],
  "_EmissionMap": {
    "texture": "white"
  },
  "_EmissionMap_ScrollRotate": [
    0,
    0,
    0,
    0
  ],
  "_EmissionMap_UVMode": 0,
  "_EmissionMainStrength": 0,
  "_EmissionBlend": 1,
  "_EmissionBlendMask": {
    "texture": "white"
  },
  "_EmissionBlendMask_ScrollRotate": [
    0,
    0,
    0,
    0
  ],
  "_EmissionBlendMode": 1,
  "_EmissionBlink": [
    0,
    0,
    3.141593,
    0
  ],
  "_EmissionUseGrad": 0,
  "_EmissionGradTex": {
    "texture": "white"
  },
  "_EmissionGradSpeed": 1,
  "_EmissionParallaxDepth": 0,
  "_EmissionFluorescence": 0,
  "_egci": 2,
  "_egai": 2,
  "_egc0": [
    1,
    1,
    1,
    0
  ],
  "_egc1": [
    1,
    1,
    1,
    1
  ],
  "_egc2": [
    1,
    1,
    1,
    0
  ],
  "_egc3": [
    1,
    1,
    1,
    0
  ],
  "_egc4": [
    1,
    1,
    1,
    0
  ],
  "_egc5": [
    1,
    1,
    1,
    0
  ],
  "_egc6": [
    1,
    1,
    1,
    0
  ],
  "_egc7": [
    1,
    1,
    1,
    0
  ],
  "_ega0": [
    1,
    0,
    0,
    0
  ],
  "_ega1": [
    1,
    0,
    0,
    1
  ],
  "_ega2": [
    1,
    0,
    0,
    0
  ],
  "_ega3": [
    1,
    0,
    0,
    0
  ],
  "_ega4": [
    1,
    0,
    0,
    0
  ],
  "_ega5": [
    1,
    0,
    0,
    0
  ],
  "_ega6": [
    1,
    0,
    0,
    0
  ],
  "_ega7": [
    1,
    0,
    0,
    0
  ],
  "_UseEmission2nd": 0,
  "_Emission2ndColor": [
    1,
    1,
    1,
    1
  ],
  "_Emission2ndMap": {
    "texture": "white"
  },
  "_Emission2ndMap_ScrollRotate": [
    0,
    0,
    0,
    0
  ],
  "_Emission2ndMap_UVMode": 0,
  "_Emission2ndMainStrength": 0,
  "_Emission2ndBlend": 1,
  "_Emission2ndBlendMask": {
    "texture": "white"
  },
  "_Emission2ndBlendMask_ScrollRotate": [
    0,
    0,
    0,
    0
  ],
  "_Emission2ndBlendMode": 1,
  "_Emission2ndBlink": [
    0,
    0,
    3.141593,
    0
  ],
  "_Emission2ndUseGrad": 0,
  "_Emission2ndGradTex": {
    "texture": "white"
  },
  "_Emission2ndGradSpeed": 1,
  "_Emission2ndParallaxDepth": 0,
  "_Emission2ndFluorescence": 0,
  "_e2gci": 2,
  "_e2gai": 2,
  "_e2gc0": [
    1,
    1,
    1,
    0
  ],
  "_e2gc1": [
    1,
    1,
    1,
    1
  ],
  "_e2gc2": [
    1,
    1,
    1,
    0
  ],
  "_e2gc3": [
    1,
    1,
    1,
    0
  ],
  "_e2gc4": [
    1,
    1,
    1,
    0
  ],
  "_e2gc5": [
    1,
    1,
    1,
    0
  ],
  "_e2gc6": [
    1,
    1,
    1,
    0
  ],
  "_e2gc7": [
    1,
    1,
    1,
    0
  ],
  "_e2ga0": [
    1,
    0,
    0,
    0
  ],
  "_e2ga1": [
    1,
    0,
    0,
    1
  ],
  "_e2ga2": [
    1,
    0,
    0,
    0
  ],
  "_e2ga3": [
    1,
    0,
    0,
    0
  ],
  "_e2ga4": [
    1,
    0,
    0,
    0
  ],
  "_e2ga5": [
    1,
    0,
    0,
    0
  ],
  "_e2ga6": [
    1,
    0,
    0,
    0
  ],
  "_e2ga7": [
    1,
    0,
    0,
    0
  ],
  "_UseParallax": 0,
  "_UsePOM": 0,
  "_ParallaxMap": {
    "texture": "gray"
  },
  "_Parallax": 0.02,
  "_ParallaxOffset": 0.5,
  "_DistanceFadeColor": [
    0,
    0,
    0,
    1
  ],
  "_DistanceFade": [
    0.1,
    0.01,
    0,
    0
  ],
  "_DistanceFadeMode": 0,
  "_DistanceFadeRimColor": [
    0,
    0,
    0,
    0
  ],
  "_DistanceFadeRimFresnelPower": 5,
  "_UseAudioLink": 0,
  "_AudioLinkDefaultValue": [
    0,
    0,
    2,
    0.75
  ],
  "_AudioLinkUVMode": 1,
  "_AudioLinkUVParams": [
    0.25,
    0,
    0,
    0.125
  ],
  "_AudioLinkStart": [
    0,
    0,
    0,
    0
  ],
  "_AudioLinkMask": {
    "texture": "blue"
  },
  "_AudioLinkMask_ScrollRotate": [
    0,
    0,
    0,
    0
  ],
  "_AudioLinkMask_UVMode": 0,
  "_AudioLink2Main2nd": 0,
  "_AudioLink2Main3rd": 0,
  "_AudioLink2Emission": 0,
  "_AudioLink2EmissionGrad": 0,
  "_AudioLink2Emission2nd": 0,
  "_AudioLink2Emission2ndGrad": 0,
  "_AudioLink2Vertex": 0,
  "_AudioLinkVertexUVMode": 1,
  "_AudioLinkVertexUVParams": [
    0.25,
    0,
    0,
    0.125
  ],
  "_AudioLinkVertexStart": [
    0,
    0,
    0,
    0
  ],
  "_AudioLinkVertexStrength": [
    0,
    0,
    0,
    1
  ],
  "_AudioLinkAsLocal": 0,
  "_AudioLinkLocalMap": {
    "texture": "black"
  },
  "_AudioLinkLocalMapParams": [
    120,
    1,
    0,
    0
  ],
  "_DissolveMask": {
    "texture": "white"
  },
  "_DissolveNoiseMask": {
    "texture": "gray"
  },
  "_DissolveNoiseMask_ScrollRotate": [
    0,
    0,
    0,
    0
  ],
  "_DissolveNoiseStrength": 0.1,
  "_DissolveColor": [
    1,
    1,
    1,
    1
  ],
  "_DissolveParams": [
    0,
    0,
    0.5,
    0.1
  ],
  "_DissolvePos": [
    0,
    0,
    0,
    0
  ],
  "_IDMaskCompile": 0,
  "_IDMaskFrom": 8,
  "_IDMask1": 0,
  "_IDMask2": 0,
  "_IDMask3": 0,
  "_IDMask4": 0,
  "_IDMask5": 0,
  "_IDMask6": 0,
  "_IDMask7": 0,
  "_IDMask8": 0,
  "_IDMaskIsBitmap": 0,
  "_IDMaskIndex1": 0,
  "_IDMaskIndex2": 0,
  "_IDMaskIndex3": 0,
  "_IDMaskIndex4": 0,
  "_IDMaskIndex5": 0,
  "_IDMaskIndex6": 0,
  "_IDMaskIndex7": 0,
  "_IDMaskIndex8": 0,
  "_IDMaskControlsDissolve": 0,
  "_IDMaskPrior1": 0,
  "_IDMaskPrior2": 0,
  "_IDMaskPrior3": 0,
  "_IDMaskPrior4": 0,
  "_IDMaskPrior5": 0,
  "_IDMaskPrior6": 0,
  "_IDMaskPrior7": 0,
  "_IDMaskPrior8": 0,
  "_UDIMDiscardCompile": 0,
  "_UDIMDiscardUV": 0,
  "_UDIMDiscardMode": 0,
  "_UDIMDiscardRow3_3": 0,
  "_UDIMDiscardRow3_2": 0,
  "_UDIMDiscardRow3_1": 0,
  "_UDIMDiscardRow3_0": 0,
  "_UDIMDiscardRow2_3": 0,
  "_UDIMDiscardRow2_2": 0,
  "_UDIMDiscardRow2_1": 0,
  "_UDIMDiscardRow2_0": 0,
  "_UDIMDiscardRow1_3": 0,
  "_UDIMDiscardRow1_2": 0,
  "_UDIMDiscardRow1_1": 0,
  "_UDIMDiscardRow1_0": 0,
  "_UDIMDiscardRow0_3": 0,
  "_UDIMDiscardRow0_2": 0,
  "_UDIMDiscardRow0_1": 0,
  "_UDIMDiscardRow0_0": 0,
  "_OutlineColor": [
    0.6,
    0.56,
    0.73,
    1
  ],
  "_OutlineTex": {
    "texture": "white"
  },
  "_OutlineTex_ScrollRotate": [
    0,
    0,
    0,
    0
  ],
  "_OutlineTexHSVG": [
    0,
    1,
    1,
    1
  ],
  "_OutlineLitColor": [
    1,
    0.2,
    0,
    0
  ],
  "_OutlineLitApplyTex": 0,
  "_OutlineLitScale": 10,
  "_OutlineLitOffset": -8,
  "_OutlineLitShadowReceive": 0,
  "_OutlineWidth": 0.08,
  "_OutlineWidthMask": {
    "texture": "white"
  },
  "_OutlineFixWidth": 0.5,
  "_OutlineVertexR2Width": 0,
  "_OutlineDeleteMesh": 0,
  "_OutlineVectorTex": {
    "texture": "bump"
  },
  "_OutlineVectorUVMode": 0,
  "_OutlineVectorScale": 1,
  "_OutlineEnableLighting": 1,
  "_OutlineZBias": 0,
  "_OutlineDisableInVR": 0,
  "_TessEdge": 10,
  "_TessStrength": 0.5,
  "_TessShrink": 0,
  "_TessFactorMax": 3,
  "_UseOutline": 0,
  "_TransparentMode": 0,
  "_UseClippingCanceller": 0,
  "_AsOverlay": 0,
  "_BaseColor": [
    1,
    1,
    1,
    1
  ],
  "_BaseMap": {
    "texture": "white"
  },
  "_BaseColorMap": {
    "texture": "white"
  },
  "_lilToonVersion": 45,
  "_Ramp": {
    "texture": "white"
  },
  "_Cull": 2,
  "_SrcBlend": 1,
  "_DstBlend": 0,
  "_SrcBlendAlpha": 1,
  "_DstBlendAlpha": 10,
  "_BlendOp": 0,
  "_BlendOpAlpha": 0,
  "_SrcBlendFA": 1,
  "_DstBlendFA": 1,
  "_SrcBlendAlphaFA": 0,
  "_DstBlendAlphaFA": 1,
  "_BlendOpFA": 4,
  "_BlendOpAlphaFA": 4,
  "_ZClip": 1,
  "_ZWrite": 1,
  "_ZTest": 4,
  "_StencilRef": 0,
  "_StencilReadMask": 255,
  "_StencilWriteMask": 255,
  "_StencilComp": 8,
  "_StencilPass": 0,
  "_StencilFail": 0,
  "_StencilZFail": 0,
  "_OffsetFactor": 0,
  "_OffsetUnits": 0,
  "_ColorMask": 15,
  "_AlphaToMask": 0,
  "_lilShadowCasterBias": 0,
  "_RefractionStrength": 0.5,
  "_RefractionFresnelPower": 1,
  "_RefractionColorFromMain": 0,
  "_RefractionColor": [
    1,
    1,
    1,
    1
  ],
  "_FurNoiseMask": {
    "texture": "white"
  },
  "_FurMask": {
    "texture": "white"
  },
  "_FurLengthMask": {
    "texture": "white"
  },
  "_FurVectorTex": {
    "texture": "bump"
  },
  "_FurVectorScale": 1,
  "_FurVector": [
    0,
    0,
    1,
    0.02
  ],
  "_VertexColor2FurVector": 0,
  "_FurGravity": 0.25,
  "_FurRandomize": 0,
  "_FurAO": 0,
  "_FurLayerNum": 2,
  "_FurRootOffset": 0,
  "_FurCutoutLength": 0.8,
  "_FurTouchStrength": 0,
  "_FurRimColor": [
    0,
    0,
    0,
    1
  ],
  "_FurRimFresnelPower": 3,
  "_FurRimAntiLight": 0.5,
  "_FurCull": 0,
  "_FurSrcBlend": 5,
  "_FurDstBlend": 10,
  "_FurSrcBlendAlpha": 1,
  "_FurDstBlendAlpha": 10,
  "_FurBlendOp": 0,
  "_FurBlendOpAlpha": 0,
  "_FurSrcBlendFA": 1,
  "_FurDstBlendFA": 1,
  "_FurSrcBlendAlphaFA": 0,
  "_FurDstBlendAlphaFA": 1,
  "_FurBlendOpFA": 4,
  "_FurBlendOpAlphaFA": 4,
  "_FurZClip": 1,
  "_FurZWrite": 0,
  "_FurZTest": 4,
  "_FurStencilRef": 0,
  "_FurStencilReadMask": 255,
  "_FurStencilWriteMask": 255,
  "_FurStencilComp": 8,
  "_FurStencilPass": 0,
  "_FurStencilFail": 0,
  "_FurStencilZFail": 0,
  "_FurOffsetFactor": 0,
  "_FurOffsetUnits": 0,
  "_FurColorMask": 15,
  "_FurAlphaToMask": 0,
  "_GemChromaticAberration": 0.02,
  "_GemEnvContrast": 2,
  "_GemEnvColor": [
    1,
    1,
    1,
    1
  ],
  "_GemParticleLoop": 8,
  "_GemParticleColor": [
    4,
    4,
    4,
    1
  ],
  "_GemVRParallaxStrength": 1,
  "_OutlineCull": 1,
  "_OutlineSrcBlend": 1,
  "_OutlineDstBlend": 0,
  "_OutlineSrcBlendAlpha": 1,
  "_OutlineDstBlendAlpha": 10,
  "_OutlineBlendOp": 0,
  "_OutlineBlendOpAlpha": 0,
  "_OutlineSrcBlendFA": 1,
  "_OutlineDstBlendFA": 1,
  "_OutlineSrcBlendAlphaFA": 0,
  "_OutlineDstBlendAlphaFA": 1,
  "_OutlineBlendOpFA": 4,
  "_OutlineBlendOpAlphaFA": 4,
  "_OutlineZClip": 1,
  "_OutlineZWrite": 1,
  "_OutlineZTest": 2,
  "_OutlineStencilRef": 0,
  "_OutlineStencilReadMask": 255,
  "_OutlineStencilWriteMask": 255,
  "_OutlineStencilComp": 8,
  "_OutlineStencilPass": 0,
  "_OutlineStencilFail": 0,
  "_OutlineStencilZFail": 0,
  "_OutlineOffsetFactor": 0,
  "_OutlineOffsetUnits": 0,
  "_OutlineColorMask": 15,
  "_OutlineAlphaToMask": 0
};
var LILTOON_MODE_DEFAULTS = {
  "transparent": {
    "_DstBlend": 10,
    "_OutlineSrcBlend": 5,
    "_OutlineDstBlend": 10,
    "_PreColor": [
      1,
      1,
      1,
      1
    ],
    "_PreOutType": 0,
    "_PreCutoff": 0.5,
    "_PreCull": 2,
    "_PreSrcBlend": 1,
    "_PreDstBlend": 10,
    "_PreSrcBlendAlpha": 1,
    "_PreDstBlendAlpha": 10,
    "_PreBlendOp": 0,
    "_PreBlendOpAlpha": 0,
    "_PreSrcBlendFA": 1,
    "_PreDstBlendFA": 1,
    "_PreSrcBlendAlphaFA": 0,
    "_PreDstBlendAlphaFA": 1,
    "_PreBlendOpFA": 4,
    "_PreBlendOpAlphaFA": 4,
    "_PreZClip": 1,
    "_PreZWrite": 1,
    "_PreZTest": 4,
    "_PreStencilRef": 0,
    "_PreStencilReadMask": 255,
    "_PreStencilWriteMask": 255,
    "_PreStencilComp": 8,
    "_PreStencilPass": 0,
    "_PreStencilFail": 0,
    "_PreStencilZFail": 0,
    "_PreOffsetFactor": 0,
    "_PreOffsetUnits": 0,
    "_PreColorMask": 15,
    "_PreAlphaToMask": 0
  },
  "refraction-blur": {
    "_RefractionStrength": 0.1,
    "_RefractionFresnelPower": 0.5
  },
  "fur-cutout": {
    "_AlphaToMask": 1,
    "_FurSrcBlend": 1,
    "_FurDstBlend": 0,
    "_FurZWrite": 1,
    "_FurAlphaToMask": 1
  },
  "fur-two-pass": {
    "_DstBlend": 10
  },
  "refraction": {
    "_RefractionStrength": 0.1,
    "_RefractionFresnelPower": 0.5
  },
  "fur": {
    "_DstBlend": 10
  },
  "gem": {
    "_Cull": 0,
    "_DstBlend": 1,
    "_ZWrite": 0
  }
};

// src/generated/textureSemantics.ts
var LILTOON_TEXTURE_SEMANTICS = {
  "_DitherTex": "data",
  "_MainTex": "color",
  "_MainGradationTex": "color",
  "_MainColorAdjustMask": "data",
  "_Main2ndTex": "color",
  "_Main2ndBlendMask": "data",
  "_Main2ndDissolveMask": "data",
  "_Main2ndDissolveNoiseMask": "data",
  "_Main3rdTex": "color",
  "_Main3rdBlendMask": "data",
  "_Main3rdDissolveMask": "data",
  "_Main3rdDissolveNoiseMask": "data",
  "_AlphaMask": "data",
  "_BumpMap": "normal",
  "_Bump2ndMap": "normal",
  "_Bump2ndScaleMask": "data",
  "_AnisotropyTangentMap": "normal",
  "_AnisotropyScaleMask": "data",
  "_AnisotropyShiftNoiseMask": "data",
  "_BacklightColorTex": "color",
  "_ShadowStrengthMask": "data",
  "_ShadowBorderMask": "data",
  "_ShadowBlurMask": "data",
  "_ShadowColorTex": "color",
  "_Shadow2ndColorTex": "color",
  "_Shadow3rdColorTex": "color",
  "_RimShadeMask": "data",
  "_SmoothnessTex": "data",
  "_MetallicGlossMap": "data",
  "_ReflectionColorTex": "color",
  "_ReflectionCubeTex": "color",
  "_MatCapTex": "color",
  "_MatCapBlendMask": "data",
  "_MatCapBumpMap": "normal",
  "_MatCap2ndTex": "color",
  "_MatCap2ndBlendMask": "data",
  "_MatCap2ndBumpMap": "normal",
  "_RimColorTex": "color",
  "_GlitterColorTex": "color",
  "_GlitterShapeTex": "color",
  "_EmissionMap": "color",
  "_EmissionBlendMask": "data",
  "_EmissionGradTex": "color",
  "_Emission2ndMap": "color",
  "_Emission2ndBlendMask": "data",
  "_Emission2ndGradTex": "color",
  "_ParallaxMap": "data",
  "_AudioLinkMask": "data",
  "_AudioLinkLocalMap": "data",
  "_DissolveMask": "data",
  "_DissolveNoiseMask": "data",
  "_OutlineTex": "color",
  "_OutlineWidthMask": "data",
  "_OutlineVectorTex": "normal",
  "_BaseMap": "color",
  "_BaseColorMap": "color",
  "_Ramp": "color",
  "_FurNoiseMask": "data",
  "_FurMask": "data",
  "_FurLengthMask": "data",
  "_FurVectorTex": "normal"
};

// src/utils/texture.ts
var neutralTextures = /* @__PURE__ */ new Map();
function pixelForDefault(name) {
  switch (name.toLowerCase()) {
    case "black":
      return [0, 0, 0, 255];
    case "gray":
      return [128, 128, 128, 255];
    case "bump":
      return [128, 128, 255, 128];
    case "red":
      return [255, 0, 0, 255];
    case "white":
    default:
      return [255, 255, 255, 255];
  }
}
function getNeutralTexture(name = "white") {
  const existing = neutralTextures.get(name);
  if (existing) return existing;
  const texture2 = new DataTexture(
    new Uint8Array(pixelForDefault(name)),
    1,
    1,
    RGBAFormat,
    UnsignedByteType
  );
  texture2.name = `three-liltoon:${name}`;
  texture2.wrapS = RepeatWrapping;
  texture2.wrapT = RepeatWrapping;
  texture2.minFilter = LinearFilter;
  texture2.magFilter = LinearFilter;
  texture2.generateMipmaps = false;
  texture2.needsUpdate = true;
  neutralTextures.set(name, texture2);
  return texture2;
}
function normalizeLilToonTexture(property, texture2) {
  const semantic = LILTOON_TEXTURE_SEMANTICS[property];
  if (!texture2.isCubeTexture)
    texture2.colorSpace = semantic === "color" ? SRGBColorSpace : LinearSRGBColorSpace;
  texture2.flipY = false;
  texture2.wrapS ||= RepeatWrapping;
  texture2.wrapT ||= RepeatWrapping;
  texture2.needsUpdate = true;
  return texture2;
}

// src/webgpu/lilToonMath.ts
var UNITY_LIGHT_SCALE = 1 / Math.PI;
var BAND_EPSILON = 1e-4;
var saturate = (value) => Math.min(Math.max(value, 0), 1);
var lerp = (a, b, t) => a + (b - a) * t;
var lerpRgb = (a, b, t) => [0, 1, 2].map(
  (i) => lerp(a[i], b[i], typeof t === "number" ? t : t[i])
);
var mulRgb = (a, b) => [0, 1, 2].map((i) => a[i] * (typeof b === "number" ? b : b[i]));
var lilBandNoSaturate = (nl, border, blur, borderRange = 0, aa = 0) => {
  const borderMin = saturate(border - blur * 0.5 - borderRange);
  const borderMax = saturate(border + blur * 0.5);
  return (nl - borderMin) / Math.max(saturate(borderMax - borderMin + aa), BAND_EPSILON);
};
var lilBand = (nl, border, blur, borderRange = 0, aa = 0) => saturate(lilBandNoSaturate(nl, border, blur, borderRange, aa));
var lilGray = (color) => (color[0] + color[1] + color[2]) / 3;
var lilLimitLight = (color, min2, max3, monochrome) => {
  const clamped = color.map((c) => Math.min(Math.max(c, min2), max3));
  const gray = lilGray(clamped);
  return lerpRgb(clamped, [gray, gray, gray], monochrome);
};
var isLilBlendMode = (mode) => mode === 0 || mode === 1 || mode === 2 || mode === 3;
var lilBlendColor = (dst, src, srcA, mode) => {
  const each = (f) => [0, 1, 2].map(f);
  const ad = each((i) => dst[i] + src[i]);
  const mu = mulRgb(dst, src);
  const screen = each((i) => Math.max(ad[i] - mu[i], dst[i]));
  const out = [src, ad, screen, mu][isLilBlendMode(mode) ? mode : 0];
  return lerpRgb(dst, out, srcA);
};
var lilOutlineWidth = (width, mask, fixWidth, cameraDistance) => width * 0.01 * mask * lerp(1, saturate(cameraDistance), fixWidth);
var lilToonShadingInputs = (source, hasTexture) => {
  const st = source.propertyNode("_MainTex_ST", "vec4");
  return {
    float: (name) => source.propertyNode(name, "float"),
    vec4: (name) => source.propertyNode(name, "vec4"),
    texture: (name) => hasTexture(name) ? source.textureNode(name) : null,
    uvMain: uv().mul(st.xy).add(st.zw)
  };
};
var tslSampleST = (inputs, name, at) => {
  const texture2 = inputs.texture(name);
  if (!texture2) return vec4(1);
  const st = inputs.vec4(`${name}_ST`);
  return texture2.sample(at.mul(st.xy).add(st.zw));
};
var tslBlendColor = (dst, src, srcA, mode) => {
  const ad = dst.add(src);
  const mu = dst.mul(src);
  const out = select(
    mode.equal(1),
    ad,
    select(mode.equal(2), max(ad.sub(mu), dst), select(mode.equal(3), mu, src))
  );
  return mix(dst, out, srcA);
};
var tslBackfaceMask = (value, mask) => select(faceDirection.lessThan(mask.sub(1)), float(0), value);
var tslFaceNormal = (normal, flipNormal) => {
  const unflipped = normal.mul(faceDirection);
  return select(
    faceDirection.lessThan(flipNormal.sub(1)),
    unflipped.negate(),
    unflipped
  );
};
var tslNormalByStrength = (normal, geometryNormal, strength) => geometryNormal ? mix(geometryNormal, normal, strength) : normal;
var tslTooning = (inputs, value, border, blur) => tslBand(
  value,
  border,
  blur,
  0,
  fwidth(value).mul(inputs.float("_AAStrength"))
);
var tslBacklight = (input) => {
  const { inputs, normal, lightDirection } = input;
  const p = inputs.float;
  const headV = positionViewDirection;
  const factor = pow(
    saturate$1(dot(headV, lightDirection).mul(-0.5).add(0.5)),
    p("_BacklightDirectivity")
  );
  const ln = dot(
    normalize(
      headV.mul(p("_BacklightViewStrength")).negate().add(lightDirection)
    ),
    normal
  ).mul(0.5).add(0.5);
  const shadowed = ln.mul(
    select(
      p("_BacklightReceiveShadow").notEqual(0),
      saturate$1(input.shadow),
      float(1)
    )
  );
  const band = tslTooning(
    inputs,
    shadowed,
    p("_BacklightBorder"),
    p("_BacklightBlur")
  );
  return tslBackfaceMask(
    saturate$1(factor.mul(band)),
    p("_BacklightBackfaceMask")
  );
};
var tslBacklightColor = (s, backlight) => {
  const { inputs } = s;
  const color = inputs.vec4("_BacklightColor").mul(tslSampleST(inputs, "_BacklightColorTex", inputs.uvMain));
  const rgb = mix(
    color.rgb,
    color.rgb.mul(s.albedo),
    inputs.float("_BacklightMainStrength")
  );
  return rgb.mul(backlight.mul(color.a)).mul(s.lightColor);
};
var tslMatCapUV = (inputs, normal) => {
  const p = inputs.float;
  const perspective = cameraProjectionMatrix.mul(vec4(0, 0, 0, 1)).w.equal(0).and(p("_MatCapPerspective").notEqual(0));
  const normalVD = select(perspective, positionViewDirection, vec3(0, 0, 1));
  const up = select(
    p("_MatCapZRotCancel").notEqual(0),
    cameraViewMatrix.mul(vec4(0, 1, 0, 0)).xyz,
    vec3(0, 1, 0)
  );
  const bitangent = normalize(up.sub(normalVD.mul(dot(normalVD, up))));
  const tangent = cross(bitangent, normalVD);
  const st = inputs.vec4("_MatCapTex_ST");
  const matUV = vec2(dot(tangent, normal), dot(bitangent, normal)).mul(st.xy).add(st.zw).mul(0.5).add(0.5);
  return vec2(matUV.x, matUV.y.oneMinus());
};
var tslMatCap = (col, s) => {
  const { inputs } = s;
  const p = inputs.float;
  const normal = tslNormalByStrength(
    s.normal,
    s.geometryNormal,
    p("_MatCapNormalStrength")
  );
  const matUV = tslMatCapUV(inputs, normalize(normal));
  const texture2 = inputs.texture("_MatCapTex");
  const color = inputs.vec4("_MatCapColor");
  const sampled = texture2 ? color.mul(texture2.sample(matUV).level(p("_MatCapLod"))) : color;
  const lit = mix(
    sampled.rgb,
    sampled.rgb.mul(s.lightColor),
    p("_MatCapEnableLighting")
  );
  const masked = mix(
    sampled.a,
    sampled.a.mul(s.shadowmix),
    p("_MatCapShadowMask")
  );
  const alpha = s.transparent ? select(
    p("_MatCapApplyTransparency").notEqual(0),
    masked.mul(s.alpha),
    masked
  ) : masked;
  const facing = tslBackfaceMask(alpha, p("_MatCapBackfaceMask"));
  const mask = tslSampleST(inputs, "_MatCapBlendMask", inputs.uvMain).rgb;
  const rgb = mix(lit, lit.mul(s.albedo), p("_MatCapMainStrength"));
  return tslBlendColor(
    col,
    rgb,
    mask.mul(p("_MatCapBlend").mul(facing)),
    p("_MatCapBlendMode")
  );
};
var tslRim = (col, s) => {
  const { inputs } = s;
  const p = inputs.float;
  const color = inputs.vec4("_RimColor").mul(tslSampleST(inputs, "_RimColorTex", inputs.uvMain));
  const rgb = mix(color.rgb, color.rgb.mul(s.albedo), p("_RimMainStrength"));
  const normal = tslNormalByStrength(
    s.normal,
    s.geometryNormal,
    p("_RimNormalStrength")
  );
  const nvabs = abs(dot(normal, positionViewDirection));
  const fresnel = tslBackfaceMask(
    pow(saturate$1(nvabs.oneMinus()), p("_RimFresnelPower")),
    p("_RimBackfaceMask")
  );
  const band = tslTooning(inputs, fresnel, p("_RimBorder"), p("_RimBlur"));
  const rim = s.transparent ? select(p("_RimApplyTransparency").notEqual(0), band.mul(s.alpha), band) : band;
  const shadowed = mix(rim, rim.mul(s.shadowmix), p("_RimShadowMask"));
  const lit = mix(rgb, rgb.mul(s.lightColor), p("_RimEnableLighting"));
  return tslBlendColor(col, lit, shadowed.mul(color.a), p("_RimBlendMode"));
};
var tslBlink = (blink) => {
  const wave = sin(time.mul(blink.z).add(blink.w)).mul(0.5).add(0.5);
  return mix(
    float(1),
    select(blink.y.greaterThan(0.5), round(wave), wave),
    blink.x
  );
};
var tslEmission = (col, s) => {
  const { inputs } = s;
  const p = inputs.float;
  const color = inputs.vec4("_EmissionColor").mul(tslSampleST(inputs, "_EmissionMap", uv())).mul(tslSampleST(inputs, "_EmissionBlendMask", uv()));
  const invLighting = saturate$1(s.lightColor.oneMinus().mul(sqrt(s.lightColor)));
  const fluorescent = mix(
    color.rgb,
    color.rgb.mul(invLighting),
    p("_EmissionFluorescence")
  );
  const rgb = mix(
    fluorescent,
    fluorescent.mul(s.albedo),
    p("_EmissionMainStrength")
  );
  const blend = p("_EmissionBlend").mul(tslBlink(inputs.vec4("_EmissionBlink"))).mul(color.a);
  return tslBlendColor(
    col,
    rgb,
    s.transparent ? blend.mul(s.alpha) : blend,
    p("_EmissionBlendMode")
  );
};
var tslOutlinePosition = (inputs, position = positionLocal) => {
  const p = inputs.float;
  const texture2 = inputs.texture("_OutlineWidthMask");
  const mask = texture2 ? texture2.sample(inputs.uvMain).level(float(0)).r : float(1);
  const positionWS = modelWorldMatrix.mul(vec4(positionLocal, 1)).xyz;
  const near = saturate$1(length(cameraPosition.sub(positionWS)));
  const width = p("_OutlineWidth").mul(0.01).mul(mask).mul(mix(float(1), near, p("_OutlineFixWidth")));
  return position.add(normalize(normalLocal).mul(width));
};
var tslOutlineColor = (inputs) => {
  const color = inputs.vec4("_OutlineColor");
  return inputs.texture("_OutlineTex") ? tslSampleST(inputs, "_OutlineTex", uv()).mul(color) : color;
};
var tslOutlineLight = (albedo, lightColor, enable) => mix(albedo, albedo.mul(lightColor), enable);

// src/webgpu/LilToonLightingModel.ts
var tslHalfLambert = (nDotL) => saturate$1(nDotL.mul(0.5).add(0.5));
var tslReceive = (ln, shadow, receive) => ln.mul(mix(float(1), saturate$1(shadow), receive));
var tslBandNoSaturate = (nl, border, blur, borderRange = 0, aa = 0) => {
  const borderMin = saturate$1(border.sub(blur.mul(0.5)).sub(borderRange));
  const borderMax = saturate$1(border.add(blur.mul(0.5)));
  return nl.sub(borderMin).div(max(saturate$1(borderMax.sub(borderMin).add(aa)), BAND_EPSILON));
};
var tslBand = (nl, border, blur, borderRange = 0, aa = 0) => saturate$1(tslBandNoSaturate(nl, border, blur, borderRange, aa));
var tslAOShift = (mask, shift, shift2) => vec3(
  saturate$1(mask.x.mul(shift.x).add(shift.y)),
  saturate$1(mask.y.mul(shift.z).add(shift.w)),
  saturate$1(mask.z.mul(shift2.x).add(shift2.y))
);
var tslShadowBands = (input) => {
  const { ao, blurMask } = input;
  const post = input.postAO.notEqual(0);
  const masks = [ao.x, ao.y, ao.z];
  const scales = [blurMask.x, blurMask.y, blurMask.z];
  const ln = input.ln.map(
    (value, i) => select(post, value, value.mul(masks[i]))
  );
  const band = (i, range = 0) => tslBandNoSaturate(
    ln[i],
    input.border[i],
    input.blur[i].mul(scales[i]),
    range,
    fwidth(ln[i]).mul(input.aaStrength)
  );
  const bands = vec4(
    band(0),
    band(1),
    input.third ? band(2) : float(1),
    band(0, input.borderRange)
  );
  return saturate$1(
    bands.mul(select(post, vec4(ao.x, ao.y, ao.z, ao.x), vec4(1)))
  );
};
var tslGray = (color) => dot(color, vec3(1 / 3));
var tslLimitLight = (color, minLimit, maxLimit, monochrome) => {
  const clamped = clamp(color, vec3(minLimit), vec3(maxLimit));
  return mix(clamped, vec3(tslGray(clamped)), monochrome);
};
var tslShade = (input) => {
  const { albedo, light, bands } = input;
  const first = mix(float(1), bands.x, input.shadowStrength);
  const tinted = (color, tex) => mix(albedo, tex.rgb, tex.a).mul(color);
  let indirect = tinted(input.shadowColor, input.shadowColorTex);
  indirect = mix(
    indirect,
    tinted(input.shadow2ndColor.rgb, input.shadow2ndColorTex),
    input.shadow2ndColor.a.sub(bands.y.mul(input.shadow2ndColor.a))
  );
  if (input.shadow3rdColor)
    indirect = mix(
      indirect,
      tinted(input.shadow3rdColor.rgb, input.shadow3rdColorTex),
      input.shadow3rdColor.a.sub(bands.z.mul(input.shadow3rdColor.a))
    );
  indirect = mix(indirect, indirect.mul(albedo), input.shadowMainStrength);
  const direct = albedo.mul(light);
  indirect = indirect.mul(light);
  indirect = mix(
    indirect,
    albedo,
    saturate$1(input.environment.mul(input.shadowEnvStrength))
  );
  indirect = min(indirect, direct);
  indirect = mix(indirect, direct, input.shadowBorderColor.mul(bands.w));
  return mix(indirect, direct, first);
};
var LilToonLightingModel = class extends LightingModel {
  material;
  #host;
  #light = vec3();
  #weight = float();
  #bands = vec4();
  #ambient = vec3();
  #backlight = float();
  #blurMask = vec4(1);
  #borderMask = vec4(1);
  #inputs;
  /** fd.N: the three normal without the back-face negation, then `_FlipNormal` (tslFaceNormal). */
  #normalN;
  /**
   * fd.origN with a normal map: `normalize(input.normalWS)` (lil_pass_forward_normal.hlsl:311), not negated on a back
   * face and not changed by `_FlipNormal`.
   */
  #geometryNormal;
  constructor(material, host) {
    super();
    this.material = material;
    this.#host = host;
    this.#inputs = lilToonShadingInputs(material, host.hasTexture);
    this.#normalN = tslFaceNormal(normalView, this.#float("_FlipNormal"));
    this.#geometryNormal = host.normalMapped ? normalViewGeometry : null;
  }
  start(builder) {
    this.#light = vec3().toVar("lilLight");
    this.#weight = float().toVar("lilLightWeight");
    this.#bands = vec4(0, 0, 0, 0).toVar("lilBands");
    this.#ambient = vec3().toVar("lilAmbient");
    this.#backlight = float().toVar("lilBacklight");
    if (this.#host.features.has("shadow")) {
      this.#blurMask = this.#maskVar("_ShadowBlurMask", "lilShadowBlurMask");
      this.#borderMask = this.#maskVar(
        "_ShadowBorderMask",
        "lilShadowBorderMask"
      );
    }
    super.start(builder);
  }
  direct(input) {
    const { lightDirection, lightColor } = input;
    const host = this.#host;
    const color = lightColor.mul(UNITY_LIGHT_SCALE);
    this.#light.addAssign(color);
    const shadowOn = host.features.has("shadow");
    const backlightOn = host.features.has("backlight");
    if (!shadowOn && !backlightOn) return;
    const lightNode = input.lightNode;
    const shadowNode = host.shadowed.has(lightNode) ? lightNode.shadowNode : null;
    const shadow = shadowNode ? host.receivedShadow(shadowNode) : float(1);
    const weight = tslGray(color);
    this.#weight.addAssign(weight);
    if (shadowOn)
      this.#bands.addAssign(
        this.#lightBands(lightDirection, shadow).mul(weight)
      );
    if (backlightOn)
      this.#backlight.addAssign(
        tslBacklight({
          inputs: this.#inputs,
          normal: this.#normal("_BacklightNormalStrength"),
          lightDirection,
          shadow
        }).mul(weight)
      );
  }
  /** The shadow bands of one light, lil_common_frag.hlsl:920-1044. */
  #lightBands(lightDirection, shadow) {
    const p = this.#float;
    const v4 = this.#vec4;
    const third = this.#host.features.has("shadow3rd");
    const plain = tslHalfLambert(this.#normalN.dot(lightDirection));
    const ln = (strength) => this.#geometryNormal ? tslHalfLambert(this.#normal(strength).dot(lightDirection)) : plain;
    const receive = (strength, name) => tslReceive(ln(strength), shadow, p(name));
    const bands = tslShadowBands({
      ln: [
        receive("_ShadowNormalStrength", "_ShadowReceive"),
        receive("_Shadow2ndNormalStrength", "_Shadow2ndReceive"),
        third ? receive("_Shadow3rdNormalStrength", "_Shadow3rdReceive") : float(1)
      ],
      border: [
        p("_ShadowBorder"),
        p("_Shadow2ndBorder"),
        p("_Shadow3rdBorder")
      ],
      blur: [p("_ShadowBlur"), p("_Shadow2ndBlur"), p("_Shadow3rdBlur")],
      blurMask: this.#blurMask.rgb,
      borderRange: p("_ShadowBorderRange"),
      ao: tslAOShift(
        this.#borderMask.rgb,
        v4("_ShadowAOShift"),
        v4("_ShadowAOShift2")
      ),
      postAO: p("_ShadowPostAO"),
      aaStrength: p("_AAStrength"),
      third
    });
    const facing = select(
      frontFacing,
      float(1),
      float(1).sub(p("_BackfaceForceShadow"))
    );
    return bands.mul(facing);
  }
  indirect(builder) {
    const { irradiance, iblIrradiance } = builder.context;
    const room = this.#host.roomIrradiance(irradiance, iblIrradiance) ?? irradiance;
    this.#ambient.assign(room.mul(1 / Math.PI));
  }
  finish(builder) {
    const p = this.#float;
    const host = this.#host;
    const features = host.features;
    const diffuse = diffuseColor;
    const albedo = diffuse.rgb;
    const asUnlit = p("_AsUnlit");
    const limit = (color) => mix(
      tslLimitLight(
        color,
        p("_LightMinLimit"),
        p("_LightMaxLimit"),
        p("_MonochromeLighting")
      ),
      vec3(1),
      asUnlit
    );
    const lightColor = limit(this.#light.add(this.#ambient));
    const { outgoingLight } = builder.context;
    if (host.outline) {
      outgoingLight.addAssign(
        tslOutlineLight(albedo, lightColor, p("_OutlineEnableLighting"))
      );
      return;
    }
    let col = features.has("shadow") ? this.#shade(albedo, lightColor) : albedo.mul(lightColor);
    const surface = {
      inputs: this.#inputs,
      albedo,
      alpha: diffuse.a,
      transparent: host.transparent,
      lightColor,
      // lil_common_frag.hlsl:1050: fd.shadowmix = lns.x before `_ShadowStrength`.
      shadowmix: features.has("shadow") ? this.#normalizedBands().x : float(1),
      normal: this.#normalN,
      geometryNormal: this.#geometryNormal
    };
    if (features.has("backlight"))
      col = col.add(tslBacklightColor(surface, this.#normalizedBacklight()));
    if (features.has("matcap")) col = tslMatCap(col, surface);
    if (features.has("rim")) col = tslRim(col, surface);
    if (features.has("emission1st")) col = tslEmission(col, surface);
    outgoingLight.addAssign(col);
  }
  /** The band sum over the weight. A scene without a direct light is lit. */
  #normalizedBands() {
    return select(
      this.#weight.greaterThan(0),
      this.#bands.div(max(this.#weight, BAND_EPSILON)),
      vec4(1)
    );
  }
  /** The backlight factor sum over the weight. A scene without a direct light has no backlight. */
  #normalizedBacklight() {
    return select(
      this.#weight.greaterThan(0),
      this.#backlight.div(max(this.#weight, BAND_EPSILON)),
      float(0)
    );
  }
  /** fd.N mixed toward fd.origN by one normal strength property, fd.N without a normal map. */
  #normal(strength) {
    return tslNormalByStrength(
      this.#normalN,
      this.#geometryNormal,
      this.#float(strength)
    );
  }
  #shade(albedo, light) {
    const p = this.#float;
    const v4 = this.#vec4;
    const color = (name) => this.#host.hasTexture(name) ? this.#texture(name).sample(this.#uvMain()) : vec4(0);
    const bands = this.#normalizedBands();
    return tslShade({
      albedo,
      light,
      // fd.indLightColor = saturate(shMin) (lil_common_functions.hlsl:1022): the ambient before the light limit,
      // read by `_ShadowEnvStrength` only (lil_common_frag.hlsl:1125).
      environment: saturate$1(this.#ambient),
      bands,
      // lil_common_frag.hlsl:1049 and 1064 (`_ShadowMaskType` 0).
      shadowStrength: p("_ShadowStrength").mul(
        this.#mask("_ShadowStrengthMask").r
      ),
      shadowColor: v4("_ShadowColor").rgb,
      shadowColorTex: color("_ShadowColorTex"),
      shadow2ndColor: v4("_Shadow2ndColor"),
      shadow2ndColorTex: color("_Shadow2ndColorTex"),
      shadow3rdColor: this.#host.features.has("shadow3rd") ? v4("_Shadow3rdColor") : null,
      shadow3rdColorTex: color("_Shadow3rdColorTex"),
      shadowMainStrength: p("_ShadowMainStrength"),
      shadowEnvStrength: p("_ShadowEnvStrength"),
      shadowBorderColor: v4("_ShadowBorderColor").rgb
    });
  }
  /**
   * A shadow mask at the main UV, with the gradient clamp of its LOD property, lil_common_frag.hlsl:935-943,
   * 989-995, and 1004-1010: `LIL_SAMPLE_2D_GRAD(tex, uvMain, max(fd.ddxMain, LOD), max(fd.ddyMain, LOD))`, where
   * `fd.ddxMain = abs(ddx(fd.uvMain))` (289). A slot without a texture is the white neutral texture, 1.
   */
  #mask(name) {
    if (!this.#host.hasTexture(name)) return vec4(1);
    const uvMain = this.#uvMain();
    const lod = vec2(this.#float(`${name}LOD`));
    return this.#texture(name).sample(uvMain).grad(max(abs(dFdx(uvMain)), lod), max(abs(dFdy(uvMain)), lod));
  }
  #maskVar(name, variable) {
    if (!this.#host.hasTexture(name)) return vec4(1);
    const value = vec4().toVar(variable);
    value.assign(this.#mask(name));
    return value;
  }
  #uvMain() {
    const st = this.#vec4("_MainTex_ST");
    return uv().mul(st.xy).add(st.zw);
  }
  #texture = (name) => this.material.textureNode(name);
  #float = (name) => this.material.propertyNode(name, "float");
  #vec4 = (name) => this.material.propertyNode(name, "vec4");
};

// src/material/shaderVariants.ts
var shaderVariants = {
  lilToon: ["opaque", "normal", false],
  "Hidden/lilToonOutline": ["opaque", "normal", true],
  "Hidden/lilToonCutout": ["cutout", "normal", false],
  "Hidden/lilToonCutoutOutline": ["cutout", "normal", true],
  "Hidden/lilToonTransparent": ["transparent", "normal", false],
  "Hidden/lilToonTransparentOutline": ["transparent", "normal", true],
  "Hidden/lilToonOnePassTransparent": ["transparent", "one-pass", false],
  "Hidden/lilToonOnePassTransparentOutline": ["transparent", "one-pass", true],
  "Hidden/lilToonTwoPassTransparent": ["transparent", "two-pass", false],
  "Hidden/lilToonTwoPassTransparentOutline": ["transparent", "two-pass", true],
  "Hidden/lilToonRefraction": ["refraction", "normal", false],
  "Hidden/lilToonRefractionBlur": ["refraction-blur", "normal", false],
  "Hidden/lilToonFur": ["fur", "normal", false],
  "Hidden/lilToonFurCutout": ["fur-cutout", "normal", false],
  "Hidden/lilToonFurTwoPass": ["fur-two-pass", "normal", false],
  "Hidden/lilToonGem": ["gem", "normal", false]
};
function isShaderVariant(value) {
  return value !== void 0 && Object.hasOwn(shaderVariants, value);
}

// src/material/LilToonFeatureSet.ts
function enabled(properties, name) {
  const value = properties[name];
  return typeof value === "boolean" ? value : typeof value === "number" && value !== 0;
}
function colorVisible(value) {
  if (Array.isArray(value)) return Number(value[3] ?? value[0] ?? 0) !== 0;
  return typeof value === "number" && value !== 0;
}
function detectLilToonFeatures(properties, shaderVariant = "lilToon") {
  return {
    main2nd: enabled(properties, "_UseMain2ndTex"),
    main3rd: enabled(properties, "_UseMain3rdTex"),
    shadow: enabled(properties, "_UseShadow"),
    shadow3rd: enabled(properties, "_UseShadow") && colorVisible(properties._Shadow3rdColor),
    normal1st: enabled(properties, "_UseBumpMap"),
    normal2nd: enabled(properties, "_UseBump2ndMap"),
    matcap: enabled(properties, "_UseMatCap"),
    matcap2nd: enabled(properties, "_UseMatCap2nd"),
    rim: enabled(properties, "_UseRim"),
    emission1st: enabled(properties, "_UseEmission"),
    emission2nd: enabled(properties, "_UseEmission2nd"),
    reflection: enabled(properties, "_UseReflection"),
    anisotropy: enabled(properties, "_UseAnisotropy"),
    backlight: enabled(properties, "_UseBacklight"),
    outline: shaderVariants[shaderVariant][2],
    dissolve: Array.isArray(properties._DissolveParams) && Number(properties._DissolveParams[0]) !== 0
  };
}

// src/webgpu/properties.ts
var LILTOON_NODE_FEATURES = /* @__PURE__ */ new Set([
  "shadow",
  "shadow3rd",
  "normal1st",
  "matcap",
  "rim",
  "emission1st",
  "backlight",
  "outline"
]);
var LILTOON_NODE_VARIANTS = /* @__PURE__ */ new Set([
  "lilToon",
  "Hidden/lilToonOutline",
  "Hidden/lilToonCutout",
  "Hidden/lilToonCutoutOutline",
  "Hidden/lilToonTransparent",
  "Hidden/lilToonTransparentOutline",
  "Hidden/lilToonOnePassTransparent",
  "Hidden/lilToonOnePassTransparentOutline"
]);
var FEATURE_PROPERTY = {
  main2nd: "_UseMain2ndTex",
  main3rd: "_UseMain3rdTex",
  shadow: "_UseShadow",
  shadow3rd: "_UseShadow",
  normal1st: "_UseBumpMap",
  normal2nd: "_UseBump2ndMap",
  matcap: "_UseMatCap",
  matcap2nd: "_UseMatCap2nd",
  rim: "_UseRim",
  emission1st: "_UseEmission",
  emission2nd: "_UseEmission2nd",
  reflection: "_UseReflection",
  anisotropy: "_UseAnisotropy",
  backlight: "_UseBacklight",
  outline: "shaderVariant",
  dissolve: "_DissolveParams"
};
var UNSUPPORTED_VALUES = [
  ["shadow", "_ShadowMaskType"],
  ["shadow", "_ShadowColorType"],
  ["rim", "_RimDirStrength"],
  ["matcap", "_MatCapCustomNormal"],
  ["emission1st", "_EmissionMap_UVMode"],
  ["emission1st", "_EmissionUseGrad"]
];
var OUTLINE_UNSUPPORTED_VALUES = ["_OutlineVertexR2Width", "_OutlineZBias"];
var BLEND_MODES = [
  ["matcap", "_MatCapBlendMode"],
  ["rim", "_RimBlendMode"],
  ["emission1st", "_EmissionBlendMode"]
];
var IDENTITY_ST = [1, 1, 0, 0];
var NODE_EXTRA_DEFAULTS = {
  _MainTex_ST: IDENTITY_ST,
  _BumpMap_ST: IDENTITY_ST,
  _MatCapTex_ST: IDENTITY_ST,
  _MatCapBlendMask_ST: IDENTITY_ST,
  _RimColorTex_ST: IDENTITY_ST,
  _BacklightColorTex_ST: IDENTITY_ST,
  _EmissionMap_ST: IDENTITY_ST,
  _EmissionBlendMask_ST: IDENTITY_ST,
  _OutlineTex_ST: IDENTITY_ST
};
function nodeVariant(name) {
  if (name === void 0)
    return {
      variant: "lilToon",
      mode: "opaque",
      outline: false,
      warning: null
    };
  if (!isShaderVariant(name))
    return {
      variant: "lilToon",
      mode: "opaque",
      outline: false,
      warning: `Unknown lilToon shader ${name}. The material uses lilToon.`
    };
  const [renderMode, , outline] = shaderVariants[name];
  if (LILTOON_NODE_VARIANTS.has(name))
    return {
      variant: name,
      mode: renderMode,
      outline,
      warning: null
    };
  return {
    variant: "lilToon",
    mode: "opaque",
    outline,
    warning: `${name} is not implemented for WebGPU. The material uses lilToon.`
  };
}
var isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
var toArray = (value) => {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (isFiniteNumber(value)) return value;
  if (Array.isArray(value))
    return value.every(isFiniteNumber) ? [...value] : null;
  if (value === null || typeof value !== "object") return null;
  if (value.isColor === true) {
    const color = value;
    return [color.r, color.g, color.b];
  }
  if (typeof value.toArray !== "function") return null;
  const array = value.toArray();
  return Array.isArray(array) && array.every(isFiniteNumber) ? array : null;
};
var describeValue = (value) => {
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (typeof value === "string") return `the string "${value}"`;
  if (typeof value === "number") return `the number ${value}`;
  if (typeof value === "object") return "an object";
  return `a ${typeof value}`;
};
var describeTemplate = (template) => Array.isArray(template) ? `a vector of ${template.length} (${template.join(", ")})` : `the number ${template}`;
function checkNodeValue(name, value, template) {
  const result = toArray(value);
  const given = describeValue(value);
  if (template === void 0) {
    if (result !== null && (!Array.isArray(result) || result.length >= 2 && result.length <= 4))
      return { value: result };
    return {
      message: `${name} is ${given}, and a lilToon property is a number or a vector of 2 to 4. The material ignores it.`
    };
  }
  const fallback = `The material uses the default ${describeTemplate(template)}.`;
  if (result === null)
    return {
      message: `${name} is ${given}, and the property is ${describeTemplate(template)}. ${fallback}`
    };
  if (!Array.isArray(template)) {
    if (!Array.isArray(result)) return { value: result };
    return {
      message: `${name} is ${given}, and the property is a number. ${fallback}`
    };
  }
  if (!Array.isArray(result) || result.length > template.length)
    return {
      message: `${name} is ${given}, and the property is a vector of ${template.length}. ${fallback}`
    };
  for (let i = result.length; i < template.length; i++)
    result.push(template[i]);
  return { value: result };
}
var modeDefaults = (mode) => {
  const defaults = {};
  const sources = [
    LILTOON_DEFAULTS,
    LILTOON_MODE_DEFAULTS[mode] ?? {},
    NODE_EXTRA_DEFAULTS
  ];
  for (const source of sources)
    for (const [name, value] of Object.entries(source))
      if (typeof value === "number" || Array.isArray(value))
        defaults[name] = Array.isArray(value) ? [...value] : value;
  return defaults;
};
function nodeProperties(variant, properties, onInvalid) {
  const result = modeDefaults(shaderVariants[variant][0]);
  for (const [name, value] of Object.entries(properties)) {
    const checked = checkNodeValue(name, value, result[name]);
    if (checked.message !== void 0) onInvalid?.(name, checked.message);
    else result[name] = checked.value;
  }
  return result;
}
function enabledNodeFeatures(variant, properties) {
  const features = detectLilToonFeatures(properties, variant);
  return Object.keys(features).filter(
    (name) => features[name]
  );
}
function nodeWarnings(name, properties, _textures, shaderVariant) {
  const selection = nodeVariant(shaderVariant);
  const shaderKey = shaderVariant ?? selection.variant;
  const warnings = [];
  if (selection.warning)
    warnings.push({
      severity: "warning",
      code: "unsupported-shader-variant",
      materialName: name,
      shaderKey,
      property: "shaderVariant",
      message: selection.warning
    });
  const merged = nodeProperties(selection.variant, properties);
  for (const feature of enabledNodeFeatures(selection.variant, merged)) {
    if (LILTOON_NODE_FEATURES.has(feature)) continue;
    const property = FEATURE_PROPERTY[feature];
    warnings.push({
      severity: "warning",
      code: "unsupported-feature",
      materialName: name,
      shaderKey,
      property,
      message: `${property} is enabled, but the WebGPU material does not implement it. The model will load without this feature.`
    });
  }
  const enabled3 = new Set(enabledNodeFeatures(selection.variant, merged));
  const warn = (property, message) => warnings.push({
    severity: "warning",
    code: "unsupported-feature",
    materialName: name,
    shaderKey,
    property,
    message
  });
  for (const [feature, property] of UNSUPPORTED_VALUES) {
    const value = merged[property];
    if (!enabled3.has(feature) || typeof value !== "number" || value === 0)
      continue;
    warn(
      property,
      `${property} ${value} is not implemented for WebGPU. The material draws it as ${property} 0.`
    );
  }
  for (const property of OUTLINE_UNSUPPORTED_VALUES) {
    const value = merged[property];
    if (!selection.outline || typeof value !== "number" || value === 0)
      continue;
    warn(
      property,
      `${property} ${value} is not implemented for WebGPU. The outline draws it as ${property} 0.`
    );
  }
  for (const [feature, property] of BLEND_MODES) {
    const value = merged[property];
    if (!enabled3.has(feature) || typeof value !== "number") continue;
    if (isLilBlendMode(value)) continue;
    warn(
      property,
      `${property} ${value} is not a lilToon blend mode (0-3). The material uses 0.`
    );
  }
  return warnings;
}

// src/webgpu/LilToonNodeMaterial.ts
var VECTOR_TYPE = {
  2: "vec2",
  3: "vec3",
  4: "vec4"
};
var createUniform = (value) => {
  if (!Array.isArray(value)) return uniform(value);
  if (value.length === 2) return uniform(new Vector2().fromArray(value));
  if (value.length === 3) return uniform(new Vector3().fromArray(value));
  return uniform(new Vector4().fromArray(value));
};
var neutralFor = (name) => {
  const entry = LILTOON_DEFAULTS[name];
  const kind = typeof entry === "object" && entry !== null && "texture" in entry ? String(entry.texture) : "white";
  return getNeutralTexture(kind);
};
var copyValue = (value) => Array.isArray(value) ? [...value] : value;
var CULL_SIDE = {
  0: DoubleSide,
  1: BackSide,
  2: FrontSide
};
var LilToonNodeMaterial = class extends NodeMaterial {
  isLilToonNodeMaterial = true;
  #isOutline = false;
  #variant = "lilToon";
  #outline = false;
  #mode = "opaque";
  #requestedShader;
  #properties = {};
  /** The message of each property whose last given value had a wrong shape. getWarnings reports them. */
  #invalid = /* @__PURE__ */ new Map();
  #textures = {};
  #propertyNodes = /* @__PURE__ */ new Map();
  #textureNodes = /* @__PURE__ */ new Map();
  #shadowed = /* @__PURE__ */ new Set();
  constructor(parameters = {}) {
    super();
    this.lights = true;
    if (parameters.name !== void 0) this.name = parameters.name;
    this.#select(parameters.shaderVariant);
    this.#properties = nodeProperties(
      this.#variant,
      parameters.properties ?? {},
      (name, message) => this.#invalid.set(name, message)
    );
    for (const [name, value] of Object.entries(parameters.textures ?? {}))
      this.#assignTexture(name, value);
    this.#applyAlphaMode();
    this.#applyCull();
    this.setupNodes();
  }
  get variant() {
    return this.#variant;
  }
  /**
   * The material draws the outline pass: generateLilToonOutlines sets it on the clone it makes. A change sets the
   * side (BackSide for the outline, `_Cull` for the surface) and rebuilds the program.
   */
  get isOutline() {
    return this.#isOutline;
  }
  set isOutline(value) {
    if (value === this.#isOutline) return;
    this.#isOutline = value;
    this.#applyCull();
    this.needsUpdate = true;
  }
  /** The requested shader has an outline pass, also when the material falls back to lilToon. */
  get hasOutline() {
    return this.#outline;
  }
  /** One overridable place for the lighting model. A subclass supplies its own. */
  setupLightingModel() {
    return new LilToonLightingModel(this, this.#lightingHost());
  }
  setupLighting(builder) {
    const shadowed = this.#shadowed = /* @__PURE__ */ new Set();
    const getShadow = (light) => {
      shadowed.add(light);
      return light.baseColorNode;
    };
    return context(super.setupLighting(builder), { getShadow });
  }
  /**
   * The cast shadow of one light, 1 lit and 0 in shadow, before `_ShadowReceive` folds it into the bands.
   * A subclass overrides it.
   */
  receivedShadow(shadow) {
    return shadow;
  }
  /**
   * The irradiance of the ambient term. `irradiance` is the scene ambient (ambient, hemisphere, and probe lights);
   * `iblIrradiance` is what `setupEnvironment()` adds. `null` uses `irradiance`. A subclass overrides it.
   */
  roomIrradiance(_irradiance, _iblIrradiance) {
    return null;
  }
  /** Set one property. A value of a wrong shape is ignored, and getWarnings names it until a value fits. */
  setProperty(name, value) {
    const checked = checkNodeValue(name, value, this.#properties[name]);
    if (checked.message !== void 0) {
      this.#invalid.set(name, checked.message);
      return;
    }
    this.#invalid.delete(name);
    const before = this.#programKey();
    const next = checked.value;
    this.#properties[name] = next;
    this.#syncNode(name, next);
    if (name === "_Cutoff") this.#applyAlphaMode();
    if (name === "_Cull") this.#applyCull();
    if (this.#programKey() !== before) this.needsUpdate = true;
  }
  getProperty(name) {
    const value = this.#properties[name];
    return value === void 0 ? void 0 : copyValue(value);
  }
  setTexture(name, value) {
    const before = this.#programKey();
    this.#assignTexture(name, value);
    if (this.#programKey() !== before) this.needsUpdate = true;
  }
  getTexture(name) {
    return this.#textures[name] ?? neutralFor(name);
  }
  /** The uniform node that reads one property. Its value follows setProperty. */
  propertyNode(name, type) {
    const value = this.#properties[name];
    if (value === void 0)
      throw new RangeError(`Unknown lilToon property ${name}`);
    const actual = Array.isArray(value) ? VECTOR_TYPE[value.length] : "float";
    if (actual !== type)
      throw new TypeError(`${name} is a ${actual}, not a ${type}`);
    const existing = this.#propertyNodes.get(name);
    if (existing) return existing;
    const node = createUniform(value);
    this.#propertyNodes.set(name, node);
    return node;
  }
  /** The texture node that samples one texture slot. Its value follows setTexture. */
  textureNode(name) {
    const existing = this.#textureNodes.get(name);
    if (existing) return existing;
    const node = texture(this.getTexture(name));
    this.#textureNodes.set(name, node);
    return node;
  }
  /** The compatibility warnings: first each property value of a wrong shape, then the feature warnings. */
  getWarnings() {
    const shaderKey = this.#requestedShader ?? this.#variant;
    const invalid = [...this.#invalid].map(
      ([property, message]) => ({
        severity: "warning",
        code: "invalid-property-value",
        materialName: this.name,
        shaderKey,
        property,
        message
      })
    );
    return [
      ...invalid,
      ...nodeWarnings(
        this.name,
        this.#properties,
        this.#textures,
        this.#requestedShader
      )
    ];
  }
  customProgramCacheKey() {
    return `${super.customProgramCacheKey()}|${this.#programKey()}`;
  }
  copy(source) {
    super.copy(source);
    this.#requestedShader = source.#requestedShader;
    this.#variant = source.#variant;
    this.#mode = source.#mode;
    this.#outline = source.#outline;
    this.isOutline = source.isOutline;
    this.#properties = Object.fromEntries(
      Object.entries(source.#properties).map(([name, value]) => [
        name,
        copyValue(value)
      ])
    );
    this.#invalid = new Map(source.#invalid);
    this.#textures = { ...source.#textures };
    this.#propertyNodes.clear();
    this.#textureNodes.clear();
    this.#applyAlphaMode();
    this.setupNodes();
    this.needsUpdate = true;
    return this;
  }
  #select(shader) {
    const selection = nodeVariant(shader);
    this.#requestedShader = shader;
    this.#variant = selection.variant;
    this.#mode = selection.mode;
    this.#outline = selection.outline;
  }
  #assignTexture(name, value) {
    this.#textures[name] = value ? normalizeLilToonTexture(name, value) : null;
    const node = this.#textureNodes.get(name);
    if (node) node.value = this.getTexture(name);
  }
  #syncNode(name, value) {
    const node = this.#propertyNodes.get(name);
    if (!node) return;
    if (Array.isArray(value)) node.value.fromArray(value);
    else node.value = value;
  }
  /**
   * The build state of the lighting model. `setupLighting` assigns the shadowed set and then calls
   * `setupLightingModel` synchronously, so the model keeps the set of its own build. r187 buildAsync runs the model
   * after an await, and another build of this material can replace `#shadowed` in that gap.
   */
  #lightingHost() {
    const textures = { ...this.#textures };
    const outline = this.isOutline;
    return {
      shadowed: this.#shadowed,
      // The outline pass draws the outline color only (lil_pass_forward_normal.hlsl, LIL_OUTLINE).
      features: new Set(outline ? [] : this.#features()),
      hasTexture: (name) => textures[name] != null,
      receivedShadow: (shadow) => this.receivedShadow(shadow),
      roomIrradiance: (irradiance, iblIrradiance) => this.roomIrradiance(irradiance, iblIrradiance),
      outline,
      transparent: this.#mode === "transparent",
      normalMapped: this.#normalMapped()
    };
  }
  /** LIL_FEATURE_NORMAL_1ST with a `_BumpMap`. The outline pass does not map the normal. */
  #normalMapped() {
    return !this.isOutline && this.#features().includes("normal1st") && this.#textures._BumpMap != null;
  }
  #shadingInputs() {
    const textures = { ...this.#textures };
    return lilToonShadingInputs(this, (name) => textures[name] != null);
  }
  /**
   * The normal: lilUnpackNormalScale of `_BumpMap` with `_BumpScale` (lil_common_frag.hlsl:870-881) through the
   * three tangent frame. Without a `tangent` attribute, NormalMapNode uses the derivative frame, and the textures
   * have flipY false, so Y is negated as GLTFLoader negates `normalScale.y` (GLTFLoader.js:3642-3645). The geometry
   * attributes are in the render object cache key, so the program key does not need the tangent. It does not
   * assign `normalNode`, so a user normalNode and a later build without the map keep working.
   */
  setupNormal(builder) {
    if (this.normalNode !== null || !this.#normalMapped())
      return super.setupNormal();
    const inputs = this.#shadingInputs();
    const sample = tslSampleST(inputs, "_BumpMap", inputs.uvMain);
    const scale = this.propertyNode("_BumpScale", "float");
    const hasTangent = builder?.geometry?.hasAttribute("tangent") === true;
    return this.#withNodes(
      {
        normalNode: normalMap(
          sample.rgb,
          vec2(scale, hasTangent ? scale : scale.negate())
        )
      },
      () => super.setupNormal()
    );
  }
  /** The outline pass moves each vertex along its normal (tslOutlinePosition). */
  setupPosition(builder) {
    if (!this.isOutline) return super.setupPosition(builder);
    const position = tslOutlinePosition(
      this.#shadingInputs(),
      this.positionNode ?? positionLocal
    );
    return this.#withNodes(
      { positionNode: position },
      () => super.setupPosition(builder)
    );
  }
  /** The outline pass draws `_OutlineColor` (tslOutlineColor) instead of the main color. */
  setupDiffuseColor(builder) {
    if (!this.isOutline) return super.setupDiffuseColor(builder);
    const color = tslOutlineColor(this.#shadingInputs());
    this.#withNodes(
      { colorNode: vec4(color.rgb, 1), opacityNode: color.a },
      () => super.setupDiffuseColor(builder)
    );
  }
  /** Run `build` with some material nodes replaced, then restore them, so the build does not change the material. */
  #withNodes(nodes, build) {
    const keys = Object.keys(nodes);
    const saved = keys.map((key) => this[key]);
    Object.assign(this, nodes);
    try {
      return build();
    } finally {
      keys.forEach((key, i) => {
        this[key] = saved[i];
      });
    }
  }
  #features() {
    return enabledNodeFeatures(this.#variant, this.#properties).filter((feature) => LILTOON_NODE_FEATURES.has(feature)).sort();
  }
  #programKey() {
    const features = this.#features();
    const present = Object.keys(this.#textures).filter((name) => this.#textures[name] !== null).sort();
    const pass = this.isOutline ? "|outline" : "";
    return `${this.#variant}|${features.join(",")}|${present.join(",")}${pass}`;
  }
  #applyAlphaMode() {
    const cutoff = this.#properties._Cutoff;
    this.alphaTest = this.#mode === "cutout" && typeof cutoff === "number" ? cutoff : 0;
    this.transparent = this.#mode === "transparent";
    if (this.#mode === "transparent") this.depthWrite = false;
  }
  /** `_Cull` to the side. The outline pass draws the back side only (lil_pass_forward_normal.hlsl, Cull Front). */
  #applyCull() {
    const cull = this.#properties._Cull;
    this.side = this.isOutline ? BackSide : CULL_SIDE[typeof cull === "number" ? cull : 2] ?? FrontSide;
  }
  /**
   * Build the nodes that read this material. The constructor and `copy` call it,
   * because NodeMaterial.copy aliases the source nodes. A subclass overrides it,
   * calls `super.setupNodes()`, and assigns its own nodes. It runs before the
   * subclass field initializers, so it must not read subclass fields.
   */
  setupNodes() {
    const st = this.propertyNode("_MainTex_ST", "vec4");
    const color = this.propertyNode("_Color", "vec4");
    const main = this.textureNode("_MainTex").sample(
      uv().mul(st.xy).add(st.zw)
    );
    this.colorNode = vec4(color.rgb.mul(main.rgb), 1);
    this.opacityNode = float(color.a).mul(main.a);
  }
};
var isMesh = (object) => object.isMesh === true;
var drawCount = (geometry) => geometry.index ? geometry.index.count : geometry.attributes.position.count;
var prepareGroups = (geometry) => {
  const count = drawCount(geometry);
  const { groups } = geometry;
  if (groups.length === 0) {
    geometry.addGroup(0, count, 0);
    geometry.addGroup(0, count, 1);
    return true;
  }
  return groups.length === 2 && groups.every(
    (group, i) => group.start === 0 && group.count === count && group.materialIndex === i
  );
};
function generateLilToonOutlines(root) {
  const outlines = /* @__PURE__ */ new Map();
  root.traverse((object) => {
    if (!isMesh(object) || Array.isArray(object.material)) return;
    const surface = object.material;
    if (!(surface instanceof LilToonNodeMaterial) || !surface.hasOutline)
      return;
    if (surface.isOutline) return;
    if (!prepareGroups(object.geometry)) return;
    let outline = outlines.get(surface);
    if (!outline) {
      outline = surface.clone();
      outline.name = `${surface.name} (Outline)`;
      outline.isOutline = true;
      outline.shadowSide = BackSide;
      outlines.set(surface, outline);
    }
    object.material = [surface, outline];
  });
}

// src/loaders/types.ts
var LILTOON_GLTF_EXTENSION = "MOCHIYA_materials_liltoon";
var LILTOON_GLTF_SPEC_VERSION = "1.3";

// src/utils/diagnostics.ts
function warnLilToon(message) {
  console.warn(`[three-liltoon] ${message}`);
}

// src/webgpu/renderOrder.ts
var LILTOON_TRANSPARENT_QUEUE = 3e3;
function lilToonRenderOrder(queue, anchors = []) {
  if (anchors.length === 0) return queue - 2981;
  const equal = anchors.filter((anchor) => anchor.queue === queue);
  if (equal.length > 0)
    return Math.max(...equal.map((anchor) => anchor.renderOrder));
  const below = anchors.filter((anchor) => anchor.queue < queue);
  const above = anchors.filter((anchor) => anchor.queue > queue);
  const near = (gap) => 1 / (1 + Math.max(gap, 0));
  if (below.length > 0) {
    const low = Math.max(...below.map((anchor) => anchor.renderOrder));
    const lowQueue = Math.max(...below.map((anchor) => anchor.queue));
    if (above.length > 0) {
      const high2 = Math.min(...above.map((anchor) => anchor.renderOrder));
      const highQueue2 = Math.min(...above.map((anchor) => anchor.queue));
      if (low < high2)
        return low + (high2 - low) * (queue - lowQueue) / (highQueue2 - lowQueue);
    }
    return low + 1 - near(queue - lowQueue);
  }
  const high = Math.min(...above.map((anchor) => anchor.renderOrder));
  const highQueue = Math.min(...above.map((anchor) => anchor.queue));
  return high - 1 + near(highQueue - queue);
}
function generateIndexedTangents(geometry, mikk) {
  const index = geometry.index;
  const position = geometry.getAttribute("position");
  const count = index?.count ?? position.count;
  const corners = (attribute, size) => {
    const result = new Float32Array(count * size);
    for (let corner = 0; corner < count; corner++) {
      const vertex = index ? index.getX(corner) : corner;
      result[corner * size] = attribute.getX(vertex);
      result[corner * size + 1] = attribute.getY(vertex);
      if (size === 3) result[corner * size + 2] = attribute.getZ(vertex);
    }
    return result;
  };
  const tangents = mikk.generateTangents(
    corners(position, 3),
    corners(geometry.getAttribute("normal"), 3),
    corners(geometry.getAttribute("uv"), 2)
  );
  for (let i = 3; i < tangents.length; i += 4) tangents[i] *= -1;
  if (!index) {
    geometry.setAttribute("tangent", new BufferAttribute(tangents, 4));
    return;
  }
  const bits = new Uint32Array(
    tangents.buffer,
    tangents.byteOffset,
    tangents.length
  );
  const vertices = [], tangentCorners = [], indices = new Uint32Array(count);
  const groups = /* @__PURE__ */ new Map();
  for (let corner = 0; corner < count; corner++) {
    const original = index.getX(corner), offset = corner * 4;
    const key = `${original}/${bits[offset]}/${bits[offset + 1]}/${bits[offset + 2]}/${bits[offset + 3]}`;
    let vertex = groups.get(key);
    if (vertex === void 0) {
      vertex = vertices.length;
      groups.set(key, vertex);
      vertices.push(original);
      tangentCorners.push(corner);
    }
    indices[corner] = vertex;
  }
  const remapped = /* @__PURE__ */ new Map();
  const remap = (attribute) => {
    const existing = remapped.get(attribute);
    if (existing) return existing;
    const ArrayType = attribute.array.constructor;
    const array = new ArrayType(vertices.length * attribute.itemSize);
    const interleaved = "data" in attribute;
    const stride = interleaved ? attribute.data.stride : attribute.itemSize;
    const offset = interleaved ? attribute.offset : 0;
    for (let v = 0; v < vertices.length; v++)
      for (let c = 0; c < attribute.itemSize; c++)
        array[v * attribute.itemSize + c] = attribute.array[vertices[v] * stride + offset + c];
    const result = new BufferAttribute(
      array,
      attribute.itemSize,
      attribute.normalized
    );
    result.name = attribute.name;
    result.setUsage(interleaved ? attribute.data.usage : attribute.usage);
    if (!interleaved) result.gpuType = attribute.gpuType;
    remapped.set(attribute, result);
    return result;
  };
  for (const [name, attribute] of Object.entries(geometry.attributes))
    geometry.setAttribute(name, remap(attribute));
  for (const name of Object.keys(
    geometry.morphAttributes
  )) {
    geometry.morphAttributes[name] = geometry.morphAttributes[name]?.map(remap);
  }
  const indexedTangents = new Float32Array(vertices.length * 4);
  tangentCorners.forEach(
    (corner, vertex) => indexedTangents.set(
      tangents.subarray(corner * 4, corner * 4 + 4),
      vertex * 4
    )
  );
  geometry.setAttribute("tangent", new BufferAttribute(indexedTangents, 4));
  geometry.setIndex(
    new BufferAttribute(
      vertices.length <= 65535 ? new Uint16Array(indices) : indices,
      1
    )
  );
}

// src/webgpu/tangents.ts
var materialsOf = (mesh) => Array.isArray(mesh.material) ? mesh.material : [mesh.material];
var canGenerate = (geometry) => geometry.hasAttribute("position") && geometry.hasAttribute("normal") && geometry.hasAttribute("uv");
var usesDerivativeNormalMap = (material) => material.normalMap != null;
async function ensureLilToonNodeTangents(meshes, needsTangents) {
  const users = /* @__PURE__ */ new Map();
  for (const mesh of meshes) {
    const list = users.get(mesh.geometry) ?? [];
    list.push(mesh);
    users.set(mesh.geometry, list);
  }
  const work = [];
  for (const [geometry, list] of users) {
    if (geometry.hasAttribute("tangent") || !canGenerate(geometry)) continue;
    const targets = list.filter(
      (mesh) => materialsOf(mesh).some(needsTangents)
    );
    if (targets.length === 0) continue;
    const shared = list.some(
      (mesh) => !targets.includes(mesh) && materialsOf(mesh).some(usesDerivativeNormalMap)
    );
    if (!shared) {
      work.push(geometry);
      continue;
    }
    const copy = geometry.clone();
    for (const mesh of targets) mesh.geometry = copy;
    work.push(copy);
  }
  if (work.length === 0) return;
  const MikkTSpace = await import('three/examples/jsm/libs/mikktspace.module.js');
  await MikkTSpace.ready;
  for (const geometry of work) generateIndexedTangents(geometry, MikkTSpace);
}

// src/webgpu/GLTFLilToonNodeExtension.ts
var SPEC_VERSIONS = /* @__PURE__ */ new Set([
  "1.0",
  "1.1",
  "1.2",
  LILTOON_GLTF_SPEC_VERSION
]);
var LEGACY_VARIANTS = {
  opaque: void 0,
  cutout: "Hidden/lilToonCutout",
  transparent: "Hidden/lilToonTransparent"
};
var isMesh2 = (object) => object.isMesh === true;
var GLTFLilToonNodeExtension = class {
  constructor(parser, options = {}) {
    this.parser = parser;
    this.options = options;
    const list = parser.json?.materials;
    const materials = Array.isArray(list) ? list : [];
    this.#definitions = materials.map(
      (material) => material?.extensions?.[this.name]
    );
    this.#names = materials.map((material) => material?.name ?? "");
  }
  parser;
  options;
  name = LILTOON_GLTF_EXTENSION;
  /**
   * The extension and name of each material, read when the plugin is made. The VRM 0 plugin of three-vrm replaces
   * the material JSON of an MToon material in beforeRoot and drops the other extensions.
   */
  #definitions;
  #names;
  #warnings = /* @__PURE__ */ new Map();
  #tangentIndices = /* @__PURE__ */ new Set();
  #anchors = [];
  /** The material has the extension. An index from untrusted JSON that is not an integer, such as "length", has none. */
  isLilToonMaterial(materialIndex) {
    return this.definition(materialIndex) !== void 0;
  }
  /** The extension of the material as the file had it, or undefined. */
  definition(materialIndex) {
    return Number.isInteger(materialIndex) ? this.#definitions[materialIndex] : void 0;
  }
  /** The glTF name of the material. */
  materialName(materialIndex) {
    return Number.isInteger(materialIndex) && this.#names[materialIndex] || "";
  }
  /** Add a warning for a lilToon material. afterRoot publishes it with the material warnings. */
  addWarning(materialIndex, code, property, message) {
    const list = this.#warnings.get(materialIndex) ?? [];
    list.push({
      severity: "warning",
      code,
      materialName: this.materialName(materialIndex),
      materialIndex,
      shaderKey: this.definition(materialIndex)?.shaderVariant ?? "lilToon",
      property,
      message
    });
    this.#warnings.set(materialIndex, list);
  }
  /** The queues and orders of the meshes that another loader ordered. afterRoot puts lilToon meshes between them. */
  useRenderOrderAnchors(anchors) {
    this.#anchors = [...anchors];
  }
  loadMaterial(materialIndex) {
    const definition = this.#definitions[materialIndex];
    if (!definition) return null;
    return this.#load(materialIndex, definition);
  }
  async afterRoot(gltf) {
    const roots = gltf.scenes?.length ? gltf.scenes : [gltf.scene];
    const meshes = /* @__PURE__ */ new Set();
    for (const root of roots)
      root.traverse((object) => {
        if (isMesh2(object)) meshes.add(object);
      });
    await ensureLilToonNodeTangents(
      [...meshes],
      (material) => this.#needsTangents(material)
    );
    for (const root of roots) generateLilToonOutlines(root);
    for (const mesh of meshes) this.#applyRenderOrder(mesh);
    const warnings = [...this.#warnings].sort(([a], [b]) => a - b).flatMap(([, entries]) => entries);
    gltf.userData ??= {};
    gltf.userData.lilToonWarnings = warnings;
    for (const warning of warnings) {
      if (this.options.onWarning) this.options.onWarning({ ...warning });
      else
        warnLilToon(
          `${warning.materialName} (material ${warning.materialIndex}, ${warning.property}): ${warning.message}`
        );
    }
  }
  async #load(materialIndex, definition) {
    const textures = {};
    const missing = [];
    await Promise.all(
      Object.entries(definition.textures ?? {}).map(
        async ([property, info]) => {
          const result = await this.#texture(property, info);
          textures[property] = result.texture;
          if (result.warning) missing.push([property, result.warning]);
        }
      )
    );
    const { shaderVariant, renderMode } = definition;
    const legacy = shaderVariant === void 0 && renderMode !== void 0 ? LEGACY_VARIANTS[renderMode] : void 0;
    const MaterialType = this.options.materialType ?? LilToonNodeMaterial;
    const material = new MaterialType({
      name: this.materialName(materialIndex),
      shaderVariant: shaderVariant ?? legacy,
      properties: definition.properties ?? {},
      textures
    });
    this.parser.associations.set(material, { materials: materialIndex });
    if (Number(material.getProperty("_UseBumpMap") ?? 0) !== 0 && textures._BumpMap != null)
      this.#tangentIndices.add(materialIndex);
    const { specVersion } = definition;
    if (specVersion !== void 0 && !SPEC_VERSIONS.has(String(specVersion)))
      this.addWarning(
        materialIndex,
        "spec-version-mismatch",
        "specVersion",
        `The material uses ${this.name} spec ${String(specVersion)}. This build reads 1.0 to ${LILTOON_GLTF_SPEC_VERSION}. The material loads with the properties it knows.`
      );
    if (shaderVariant === void 0 && renderMode !== void 0 && !Object.hasOwn(LEGACY_VARIANTS, renderMode))
      this.addWarning(
        materialIndex,
        "unsupported-shader-variant",
        "renderMode",
        `renderMode ${renderMode} is not implemented for WebGPU. The material uses lilToon.`
      );
    for (const warning of material.getWarnings()) {
      const list = this.#warnings.get(materialIndex) ?? [];
      list.push({ ...warning, materialIndex });
      this.#warnings.set(materialIndex, list);
    }
    for (const [property, message] of missing)
      this.addWarning(materialIndex, "missing-texture", property, message);
    return material;
  }
  async #texture(property, info) {
    const index = typeof info === "number" ? info : info?.index;
    const count = this.parser.json.textures?.length ?? 0;
    const fallback = "The material uses the neutral texture.";
    if (!Number.isInteger(index) || index < 0 || index >= count)
      return {
        texture: null,
        warning: `${property} uses texture index ${String(index)}, and the file has ${count} textures. ${fallback}`
      };
    try {
      const texture2 = await this.parser.getDependency(
        "texture",
        index
      );
      if (texture2) return { texture: texture2 };
      return {
        texture: null,
        warning: `${property} texture ${index} did not load. ${fallback}`
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return {
        texture: null,
        warning: `${property} texture ${index} did not load (${reason}). ${fallback}`
      };
    }
  }
  /**
   * A transparent lilToon mesh gets the order of its `renderQueue` (lilToonRenderOrder), default 3000. An opaque or
   * cutout mesh keeps its order, as the upstream WebGL plugin does. The outline pass is a group of the same mesh,
   * so it has the same order.
   */
  #applyRenderOrder(mesh) {
    const surface = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!(surface instanceof LilToonNodeMaterial) || !surface.transparent)
      return;
    const index = this.parser.associations.get(surface)?.materials;
    if (index === void 0) return;
    const queue = this.#definitions[index]?.renderQueue ?? LILTOON_TRANSPARENT_QUEUE;
    mesh.renderOrder = lilToonRenderOrder(queue, this.#anchors);
  }
  #needsTangents(material) {
    if (!(material instanceof LilToonNodeMaterial)) return false;
    const index = this.parser.associations.get(material)?.materials;
    return index !== void 0 && this.#tangentIndices.has(index);
  }
};

// src/webgpu/vrm.ts
var isObject = (value) => value !== null && typeof value === "object";
var objects = (value) => Array.isArray(value) ? value.filter(isObject) : [];
var MTOON_EXTENSION = "VRMC_materials_mtoon";
var NO_BINDS = "The WebGPU lilToon material does not apply expression material binds. The expression does not change this material.";
var enabled2 = /* @__PURE__ */ new WeakSet();
function keepLilToonFromMToon(json, materials) {
  const list = Array.isArray(json.materials) ? json.materials : [];
  list.forEach((material, index) => {
    const definition = materials.definition(index);
    if (!isObject(material) || !definition) return;
    const { [MTOON_EXTENSION]: _mtoon, ...extensions } = material.extensions ?? {};
    list[index] = {
      ...material,
      extensions: { ...extensions, [materials.name]: definition }
    };
  });
}
function mtoonAnchors(gltf, parser) {
  const json = parser.json;
  const properties = json.extensions?.VRM?.materialProperties;
  const v0 = Array.isArray(properties) ? properties : void 0;
  const anchors = [];
  const roots = gltf.scenes?.length ? gltf.scenes : [gltf.scene];
  for (const root of roots)
    root.traverse((object) => {
      const mesh = object;
      if (!mesh.isMesh) return;
      const surface = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      if (!surface?.transparent) return;
      const index = parser.associations.get(surface)?.materials;
      if (index === void 0) return;
      const mtoon = json.materials?.[index]?.extensions?.[MTOON_EXTENSION];
      if (!isObject(mtoon)) return;
      const offset = Number(mtoon.renderQueueOffsetNumber ?? 0);
      const entry = v0?.[index];
      const queue = (isObject(entry) ? entry.renderQueue : void 0) ?? (mtoon.transparentWithZWrite ? 2501 : 3e3) + offset;
      anchors.push({ queue: Number(queue), renderOrder: mesh.renderOrder });
    });
  return anchors;
}
function warnV0Binds(json, materials) {
  const groups = objects(
    json.extensions?.VRM?.blendShapeMaster?.blendShapeGroups
  );
  const count = Array.isArray(json.materials) ? json.materials.length : 0;
  for (const group of groups)
    for (const value of objects(group.materialValues))
      for (let index = 0; index < count; index++) {
        if (!materials.isLilToonMaterial(index)) continue;
        const name = materials.materialName(index);
        if (value.materialName !== name && value.materialName !== `${name} (Outline)`)
          continue;
        materials.addWarning(
          index,
          "unsupported-feature",
          String(value.propertyName ?? "materialValues"),
          `VRM 0 blend shape ${String(group.name ?? group.presetName)} binds ${String(value.propertyName)}. ${NO_BINDS}`
        );
      }
}
function warnV1Binds(json, materials) {
  const expressions = json.extensions?.VRMC_vrm?.expressions;
  if (!isObject(expressions)) return;
  const entries = [
    ...Object.entries(isObject(expressions.preset) ? expressions.preset : {}),
    ...Object.entries(isObject(expressions.custom) ? expressions.custom : {})
  ];
  for (const [name, expression] of entries)
    for (const kind of ["materialColorBinds", "textureTransformBinds"])
      for (const bind of objects(
        isObject(expression) ? expression[kind] : void 0
      )) {
        if (!materials.isLilToonMaterial(bind.material)) continue;
        const what = kind === "materialColorBinds" ? `the ${String(bind.type)} color` : "the texture transform";
        materials.addWarning(
          bind.material,
          "unsupported-feature",
          kind,
          `VRM expression ${name} binds ${what}. ${NO_BINDS}`
        );
      }
}
function enableLilToonNodeVRM(plugin, options = {}) {
  const enhanced = plugin;
  if (enabled2.has(plugin)) return enhanced;
  const materials = new GLTFLilToonNodeExtension(plugin.parser, options);
  const originalLoadMaterial = plugin.loadMaterial;
  const originalBeforeRoot = plugin.beforeRoot;
  const originalAfterRoot = plugin.afterRoot;
  enhanced.loadMaterial = function(index) {
    return materials.loadMaterial(index) ?? originalLoadMaterial?.call(this, index) ?? null;
  };
  plugin.beforeRoot = async function() {
    await originalBeforeRoot.call(this);
    keepLilToonFromMToon(plugin.parser.json, materials);
  };
  plugin.afterRoot = async function(gltf) {
    await originalAfterRoot.call(this, gltf);
    warnV0Binds(plugin.parser.json, materials);
    warnV1Binds(plugin.parser.json, materials);
    materials.useRenderOrderAnchors(mtoonAnchors(gltf, plugin.parser));
    await materials.afterRoot(gltf);
  };
  enabled2.add(plugin);
  return enhanced;
}

export { GLTFLilToonNodeExtension, LILTOON_GLTF_EXTENSION, LILTOON_GLTF_SPEC_VERSION, LILTOON_NODE_FEATURES, LILTOON_NODE_VARIANTS, LILTOON_TRANSPARENT_QUEUE, LilToonLightingModel, LilToonNodeMaterial, UNITY_LIGHT_SCALE, enableLilToonNodeVRM, ensureLilToonNodeTangents, generateLilToonOutlines, lilBand, lilBlendColor, lilLimitLight, lilOutlineWidth, lilToonRenderOrder, lilToonShadingInputs, nodeProperties, nodeVariant, nodeWarnings, tslBacklight, tslBacklightColor, tslBlendColor, tslEmission, tslMatCap, tslOutlineColor, tslOutlinePosition, tslRim };
