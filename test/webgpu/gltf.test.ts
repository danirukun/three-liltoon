import {
	BufferAttribute,
	BufferGeometry,
	DataTexture,
	Matrix3,
	Mesh,
	MeshStandardMaterial,
	SkinnedMesh,
	Vector3,
	type Material,
	type Texture,
} from "three";
import {
	GLTFLoader,
	type GLTF,
	type GLTFLoaderPlugin,
	type GLTFParser,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { MToonMaterial, VRMLoaderPlugin } from "@pixiv/three-vrm";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	GLTFLilToonNodeExtension,
	LilToonNodeMaterial,
	enableLilToonNodeVRM,
	type LilToonNodeWarning as LilToonWarning,
} from "../../src/webgpu";
import { ensureLilToonNodeTangents } from "../../src/webgpu/tangents";
import { getNeutralTexture } from "../../src/utils/texture";

const EXTENSION = "MOCHIYA_materials_liltoon";

afterEach(() => vi.restoreAllMocks());

type Json = Record<string, any>;

// A flat quad facing +Z with glTF UVs: (0, 0) at the top left, v down.
const QUAD_POSITIONS = [-1, 1, 0, 1, 1, 0, -1, -1, 0, 1, -1, 0];
const QUAD_NORMALS = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
const QUAD_UVS = [0, 0, 1, 0, 0, 1, 1, 1];
const QUAD_INDICES = [0, 2, 1, 1, 2, 3];

const expand = (values: number[], size: number) =>
	QUAD_INDICES.flatMap((i) => values.slice(i * size, i * size + size));

/** One embedded buffer: position, normal, uv, and an optional index and tangent. */
function quadBuffers(options: { indexed: boolean; tangent: boolean }) {
	const positions = options.indexed
		? QUAD_POSITIONS
		: expand(QUAD_POSITIONS, 3);
	const normals = options.indexed ? QUAD_NORMALS : expand(QUAD_NORMALS, 3);
	const uvs = options.indexed ? QUAD_UVS : expand(QUAD_UVS, 2);
	const count = positions.length / 3;
	const tangents = Array.from({ length: count }, () => [1, 0, 0, 1]).flat();
	const parts: { data: ArrayBufferView; type: string; component: number }[] = [
		{ data: new Float32Array(positions), type: "VEC3", component: 5126 },
		{ data: new Float32Array(normals), type: "VEC3", component: 5126 },
		{ data: new Float32Array(uvs), type: "VEC2", component: 5126 },
	];
	if (options.tangent)
		parts.push({
			data: new Float32Array(tangents),
			type: "VEC4",
			component: 5126,
		});
	if (options.indexed)
		parts.push({
			data: new Uint16Array(QUAD_INDICES),
			type: "SCALAR",
			component: 5123,
		});
	let offset = 0;
	const bufferViews: Json[] = [];
	const accessors: Json[] = [];
	const chunks: Uint8Array[] = [];
	for (const part of parts) {
		const bytes = new Uint8Array(part.data.buffer.slice(0));
		const padded = new Uint8Array(Math.ceil(bytes.length / 4) * 4);
		padded.set(bytes);
		bufferViews.push({
			buffer: 0,
			byteOffset: offset,
			byteLength: bytes.length,
		});
		const elements = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[part.type]!;
		const accessor: Json = {
			bufferView: bufferViews.length - 1,
			componentType: part.component,
			count: (part.data as Float32Array).length / elements,
			type: part.type,
		};
		if (part === parts[0]) {
			accessor.min = [-1, -1, 0];
			accessor.max = [1, 1, 0];
		}
		accessors.push(accessor);
		chunks.push(padded);
		offset += padded.length;
	}
	const all = new Uint8Array(offset);
	let at = 0;
	for (const chunk of chunks) {
		all.set(chunk, at);
		at += chunk.length;
	}
	const attributes: Json = { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 };
	if (options.tangent) attributes.TANGENT = 3;
	return {
		bin: all,
		bufferViews,
		accessors,
		attributes,
		indices: options.indexed ? accessors.length - 1 : undefined,
	};
}

const BINARY = new WeakMap<Json, Uint8Array>();

/** A GLB with the JSON chunk and the BIN chunk. Node has no ProgressEvent for a data URI buffer. */
function encodeGLB(json: Json): ArrayBuffer {
	const pad = (bytes: Uint8Array, fill: number) => {
		const padded = new Uint8Array(Math.ceil(bytes.length / 4) * 4).fill(fill);
		padded.set(bytes);
		return padded;
	};
	const text = pad(new TextEncoder().encode(JSON.stringify(json)), 0x20);
	const bin = pad(BINARY.get(json) ?? new Uint8Array(), 0);
	const length = 12 + 8 + text.length + (bin.length ? 8 + bin.length : 0);
	const bytes = new Uint8Array(length);
	const view = new DataView(bytes.buffer);
	[0x46546c67, 2, length, text.length, 0x4e4f534a].forEach((value, i) =>
		view.setUint32(i * 4, value, true),
	);
	bytes.set(text, 20);
	if (bin.length) {
		view.setUint32(20 + text.length, bin.length, true);
		view.setUint32(24 + text.length, 0x004e4942, true);
		bytes.set(bin, 28 + text.length);
	}
	return bytes.buffer;
}

/** A glTF document with one quad mesh for each material. */
function documentWith(
	materials: Json[],
	options: { indexed?: boolean; tangent?: boolean; textures?: number } = {},
): Json {
	const quad = quadBuffers({
		indexed: options.indexed ?? true,
		tangent: options.tangent ?? false,
	});
	const primitive: Json = { attributes: quad.attributes };
	if (quad.indices !== undefined) primitive.indices = quad.indices;
	const json: Json = {
		asset: { version: "2.0" },
		extensionsUsed: [EXTENSION, "KHR_texture_transform"],
		scene: 0,
		scenes: [{ nodes: materials.map((_, i) => i) }],
		nodes: materials.map((_, i) => ({ mesh: i })),
		meshes: materials.map((_, i) => ({
			primitives: [{ ...primitive, material: i }],
		})),
		materials,
		buffers: [{ byteLength: quad.bin.length }],
		bufferViews: quad.bufferViews,
		accessors: quad.accessors,
		textures: Array.from({ length: options.textures ?? 0 }, () => ({})),
	};
	BINARY.set(json, quad.bin);
	return json;
}

const lilToon = (name: string, extension: Json): Json => ({
	name,
	extensions: { [EXTENSION]: { specVersion: "1.3", ...extension } },
});

/** Node has no image decoder: give each texture index a DataTexture, or reject the listed indices. */
class StubTextures implements GLTFLoaderPlugin {
	readonly name = "STUB_textures";
	readonly loaded: Texture[] = [];
	constructor(readonly failing: ReadonlySet<number> = new Set()) {}
	loadTexture(index: number): Promise<Texture> {
		if (this.failing.has(index))
			return Promise.reject(new Error(`texture ${index} failed`));
		const texture = new DataTexture(new Uint8Array(4), 1, 1);
		texture.name = `texture ${index}`;
		texture.flipY = false;
		this.loaded[index] = texture;
		return Promise.resolve(texture);
	}
}

async function load(
	json: Json,
	register: (loader: GLTFLoader, warnings: LilToonWarning[]) => void = (
		loader,
		warnings,
	) =>
		loader.register(
			(parser) =>
				new GLTFLilToonNodeExtension(parser, {
					onWarning: (w) => warnings.push(w),
				}),
		),
	failing: ReadonlySet<number> = new Set(),
) {
	const stub = new StubTextures(failing);
	const loader = new GLTFLoader().register(() => stub);
	const warnings: LilToonWarning[] = [];
	register(loader, warnings);
	const gltf = await loader.parseAsync(encodeGLB(json), "");
	return { gltf, warnings, stub };
}

const meshes = (gltf: GLTF): Mesh[] => {
	const result: Mesh[] = [];
	gltf.scene.traverse((object) => {
		if ((object as Mesh).isMesh) result.push(object as Mesh);
	});
	return result;
};

const surface = (mesh: Mesh): Material =>
	Array.isArray(mesh.material) ? mesh.material[0]! : mesh.material;

describe("GLTFLilToonNodeExtension", () => {
	it("loads the extension as a LilToonNodeMaterial and other materials as glTF materials", async () => {
		const { gltf } = await load(
			documentWith([
				lilToon("Body", { properties: { _Color: [0.2, 0.4, 0.6, 1] } }),
				{
					name: "PBR",
					pbrMetallicRoughness: { baseColorFactor: [0.3, 0.5, 0.7, 1] },
				},
			]),
		);
		const [body, pbr] = meshes(gltf).map(surface);
		expect(body).toBeInstanceOf(LilToonNodeMaterial);
		expect(body!.name).toBe("Body");
		expect((body as LilToonNodeMaterial).getProperty("_Color")).toEqual([
			0.2, 0.4, 0.6, 1,
		]);
		expect(gltf.parser.associations.get(body!)).toMatchObject({ materials: 0 });
		expect(pbr).toBeInstanceOf(MeshStandardMaterial);
		expect(pbr).not.toBeInstanceOf(LilToonNodeMaterial);
	});

	it("constructs the material type of the options", async () => {
		class Custom extends LilToonNodeMaterial {}
		const { gltf } = await load(documentWith([lilToon("Body", {})]), (loader) =>
			loader.register(
				(parser) =>
					new GLTFLilToonNodeExtension(parser, { materialType: Custom }),
			),
		);
		expect(surface(meshes(gltf)[0]!)).toBeInstanceOf(Custom);
	});

	it("gives a neutral texture and a warning for a missing, out-of-range, or failed texture index", async () => {
		const { gltf, warnings, stub } = await load(
			documentWith(
				[
					lilToon("Body", {
						properties: { _UseMatCap: 1, _UseEmission: 1, _UseRim: 1 },
						textures: {
							_MainTex: 0,
							_MatCapTex: 7,
							_EmissionMap: { index: -1 },
							_RimColorTex: { index: 1 },
						},
					}),
				],
				{ textures: 2 },
			),
			undefined,
			new Set([1]),
		);
		const body = surface(meshes(gltf)[0]!) as LilToonNodeMaterial;
		expect(body.getTexture("_MainTex")).toBe(stub.loaded[0]);
		expect(body.getTexture("_MatCapTex")).toBe(getNeutralTexture("white"));
		expect(body.getTexture("_EmissionMap")).toBe(getNeutralTexture("white"));
		expect(body.getTexture("_RimColorTex")).toBe(getNeutralTexture("white"));
		const textureWarnings = warnings.filter(
			(w) => w.code === "missing-texture",
		);
		expect(textureWarnings.map((w) => w.property).sort()).toEqual([
			"_EmissionMap",
			"_MatCapTex",
			"_RimColorTex",
		]);
		for (const warning of textureWarnings) {
			expect(warning).toMatchObject({ materialName: "Body", materialIndex: 0 });
		}
		expect(
			textureWarnings.find((w) => w.property === "_MatCapTex")!.message,
		).toContain("7");
		expect(
			textureWarnings.find((w) => w.property === "_EmissionMap")!.message,
		).toContain("-1");
		expect(gltf.userData.lilToonWarnings).toEqual(warnings);
	});

	it.each(["1.0", "1.1", "1.2", "1.3", undefined])(
		"reads spec version %s without a warning",
		async (specVersion) => {
			const { warnings } = await load(
				documentWith([
					{ name: "Body", extensions: { [EXTENSION]: { specVersion } } },
				]),
			);
			expect(
				warnings.filter((w) => w.code === "spec-version-mismatch"),
			).toEqual([]);
		},
	);

	it("loads another spec version with a spec-version-mismatch warning", async () => {
		const { gltf, warnings } = await load(
			documentWith([lilToon("Body", { specVersion: "9.9" })]),
		);
		expect(surface(meshes(gltf)[0]!)).toBeInstanceOf(LilToonNodeMaterial);
		expect(warnings).toContainEqual(
			expect.objectContaining({
				code: "spec-version-mismatch",
				materialName: "Body",
				materialIndex: 0,
				property: "specVersion",
			}),
		);
	});

	it("reads the legacy renderMode of a file without a shaderVariant", async () => {
		const { gltf, warnings } = await load(
			documentWith([
				lilToon("Cutout", { specVersion: "1.0", renderMode: "cutout" }),
				lilToon("Fur", { specVersion: "1.0", renderMode: "fur" }),
			]),
		);
		const [cutout, fur] = meshes(gltf).map(surface) as LilToonNodeMaterial[];
		expect(cutout!.variant).toBe("Hidden/lilToonCutout");
		expect(fur!.variant).toBe("lilToon");
		expect(warnings.map((w) => [w.materialName, w.code, w.property])).toEqual([
			["Fur", "unsupported-shader-variant", "renderMode"],
		]);
	});

	it("loads an unported shader variant opaque with a warning", async () => {
		const { gltf, warnings } = await load(
			documentWith([lilToon("Gem", { shaderVariant: "Hidden/lilToonGem" })]),
		);
		const gem = surface(meshes(gltf)[0]!) as LilToonNodeMaterial;
		expect(gem.variant).toBe("lilToon");
		expect(gem.transparent).toBe(false);
		expect(gem.alphaTest).toBe(0);
		expect(
			warnings.filter((w) => w.code === "unsupported-shader-variant"),
		).toEqual([
			expect.objectContaining({
				materialName: "Gem",
				materialIndex: 0,
				property: "shaderVariant",
			}),
		]);
	});

	it("publishes the material warnings once to onWarning and gltf.userData", async () => {
		const { gltf, warnings } = await load(
			documentWith([
				lilToon("Body", { properties: { _UseReflection: 1 } }),
				lilToon("Hair", { properties: { _UseMain2ndTex: 1 } }),
			]),
		);
		expect(warnings.map((w) => [w.materialName, w.property])).toEqual([
			["Body", "_UseReflection"],
			["Hair", "_UseMain2ndTex"],
		]);
		expect(gltf.userData.lilToonWarnings).toEqual(warnings);
	});

	it("does not apply KHR_texture_transform a second time on a lilToon texture", async () => {
		const transform = {
			KHR_texture_transform: { scale: [2, 2], offset: [0.5, -1] },
		};
		const { gltf } = await load(
			documentWith(
				[
					{
						...lilToon("Accessory_CatEar_01_CLOTH", {
							properties: { _MainTex_ST: [2, 2, 0.5, -1] },
							textures: { _MainTex: { index: 0 } },
						}),
						pbrMetallicRoughness: {
							baseColorTexture: { index: 0, extensions: transform },
						},
					},
					{
						name: "PBR",
						pbrMetallicRoughness: {
							baseColorTexture: { index: 0, extensions: transform },
						},
					},
				],
				{ textures: 1 },
			),
		);
		const [ear, pbr] = meshes(gltf).map(surface);
		const main = (ear as LilToonNodeMaterial).getTexture("_MainTex");
		expect(main.offset.toArray()).toEqual([0, 0]);
		expect(main.repeat.toArray()).toEqual([1, 1]);
		expect(main.rotation).toBe(0);
		main.updateMatrix();
		expect(main.matrix.equals(new Matrix3())).toBe(true);
		expect((ear as LilToonNodeMaterial).getProperty("_MainTex_ST")).toEqual([
			2, 2, 0.5, -1,
		]);
		// The standard material still gets its own transformed clone.
		expect((pbr as MeshStandardMaterial).map!.repeat.toArray()).toEqual([2, 2]);
	});

	it("adds the outline pass to an outline variant after loading", async () => {
		const { gltf } = await load(
			documentWith([
				lilToon("Body", { shaderVariant: "Hidden/lilToonOutline" }),
			]),
		);
		const materials = meshes(gltf)[0]!.material as LilToonNodeMaterial[];
		expect(materials).toHaveLength(2);
		expect(materials[1]!.isOutline).toBe(true);
	});

	describe("tangents", () => {
		const bump = (name: string, extra: Json = {}) =>
			lilToon(name, {
				properties: { _UseBumpMap: 1 },
				textures: { _BumpMap: 0 },
				...extra,
			});

		it("generates tangents only for a lilToon material with _UseBumpMap and a _BumpMap", async () => {
			const { gltf } = await load(
				documentWith(
					[
						bump("Bump"),
						lilToon("NoMap", { properties: { _UseBumpMap: 1 } }),
						lilToon("Off", { textures: { _BumpMap: 0 } }),
						{ name: "PBR", normalTexture: { index: 0 } },
					],
					{ textures: 1 },
				),
			);
			const has = meshes(gltf).map((mesh) =>
				mesh.geometry.hasAttribute("tangent"),
			);
			expect(has).toEqual([true, false, false, false]);
		});

		it("keeps a tangent attribute that the file supplies", async () => {
			const json = documentWith([bump("Bump")], { textures: 1, tangent: true });
			const { gltf } = await load(json);
			const tangent = meshes(gltf)[0]!.geometry.getAttribute("tangent");
			expect(Array.from(tangent.array)).toEqual(
				Array.from({ length: 4 }, () => [1, 0, 0, 1]).flat(),
			);
		});

		it("generates tangents for a geometry without an index", async () => {
			const { gltf } = await load(
				documentWith([bump("Bump")], { textures: 1, indexed: false }),
			);
			const geometry = meshes(gltf)[0]!.geometry;
			expect(geometry.getAttribute("tangent").count).toBe(
				geometry.getAttribute("position").count,
			);
		});

		/**
		 * The derivative frame of three r187 TangentUtils.js (thetenthplanet.de/archives/1180) with GL dFdy, as
		 * WGSLNodeBuilder maps dFdy to -dpdy. Here view space is object space and the screen is its XY plane.
		 */
		const derivativeFrame = (geometry: BufferGeometry, triangle: number) => {
			const index = geometry.index!;
			const position = geometry.getAttribute("position");
			const uv = geometry.getAttribute("uv");
			const corner = (i: number) => index.getX(triangle * 3 + i);
			const p = [0, 1, 2].map((i) =>
				new Vector3().fromBufferAttribute(position, corner(i)),
			);
			const t = [0, 1, 2].map((i) => [uv.getX(corner(i)), uv.getY(corner(i))]);
			// Solve the screen gradient of each quantity on the triangle.
			const [dx1, dy1] = [p[1]!.x - p[0]!.x, p[1]!.y - p[0]!.y];
			const [dx2, dy2] = [p[2]!.x - p[0]!.x, p[2]!.y - p[0]!.y];
			const det = dx1 * dy2 - dx2 * dy1;
			const gradient = (f1: number, f2: number) => [
				(f1 * dy2 - f2 * dy1) / det,
				(dx1 * f2 - dx2 * f1) / det,
			];
			const du = gradient(t[1]![0]! - t[0]![0]!, t[2]![0]! - t[0]![0]!);
			const dv = gradient(t[1]![1]! - t[0]![1]!, t[2]![1]! - t[0]![1]!);
			const q0 = new Vector3(1, 0, 0); // dP/dx
			const q1 = new Vector3(0, 1, 0); // dP/dy
			const st0 = [du[0]!, dv[0]!];
			const st1 = [du[1]!, dv[1]!];
			const N = new Vector3(0, 0, 1);
			const q1perp = q1.clone().cross(N);
			const q0perp = N.clone().cross(q0);
			const T = q1perp
				.clone()
				.multiplyScalar(st0[0]!)
				.add(q0perp.clone().multiplyScalar(st1[0]!));
			const B = q1perp
				.clone()
				.multiplyScalar(st0[1]!)
				.add(q0perp.clone().multiplyScalar(st1[1]!));
			const scale = 1 / Math.sqrt(Math.max(T.dot(T), B.dot(B)));
			return { T: T.multiplyScalar(scale), B: B.multiplyScalar(scale), N };
		};

		const mapped = (
			T: Vector3,
			B: Vector3,
			N: Vector3,
			n: Vector3,
			scale: [number, number],
		) =>
			T.clone()
				.multiplyScalar(n.x * scale[0])
				.add(B.clone().multiplyScalar(n.y * scale[1]))
				.add(N.clone().multiplyScalar(n.z))
				.normalize();

		it.each([
			["glTF UVs", QUAD_UVS],
			["mirrored U", [1, 0, 0, 0, 1, 1, 0, 1]],
		])(
			"maps a +Y tilted normal the same with generated tangents as with the derivative frame (%s)",
			async (_label, uvs) => {
				const geometry = new BufferGeometry();
				geometry.setAttribute(
					"position",
					new BufferAttribute(new Float32Array(QUAD_POSITIONS), 3),
				);
				geometry.setAttribute(
					"normal",
					new BufferAttribute(new Float32Array(QUAD_NORMALS), 3),
				);
				geometry.setAttribute(
					"uv",
					new BufferAttribute(new Float32Array(uvs), 2),
				);
				geometry.setIndex(QUAD_INDICES);
				const material = new LilToonNodeMaterial({
					properties: { _UseBumpMap: 1 },
					textures: { _BumpMap: new DataTexture() },
				});
				const mesh = new Mesh(geometry, material);
				await ensureLilToonNodeTangents([mesh], () => true);
				const tilted = new Vector3(0, 0.6, 0.8);
				const scale = 1;
				const tangent = geometry.getAttribute("tangent");
				for (let triangle = 0; triangle < 2; triangle++) {
					const { T, B, N } = derivativeFrame(geometry, triangle);
					// The material negates Y on the derivative path only (LilToonNodeMaterial.setupNormal).
					const derivative = mapped(T, B, N, tilted, [scale, -scale]);
					const vertex = geometry.index!.getX(triangle * 3);
					const Tt = new Vector3()
						.fromBufferAttribute(tangent, vertex)
						.normalize();
					const w = tangent.getW(vertex);
					// three r187 Bitangent.js: cross(normal, tangent) * tangent.w.
					const Bt = N.clone().cross(Tt).multiplyScalar(w).normalize();
					const withTangents = mapped(Tt, Bt, N, tilted, [scale, scale]);
					expect(withTangents.distanceTo(derivative)).toBeLessThan(1e-5);
				}
				if (uvs === QUAD_UVS) {
					// Tilted toward +Y in the texture is +Y on the quad: glTF V runs down the image.
					const { T, B, N } = derivativeFrame(geometry, 0);
					expect(
						mapped(T, B, N, tilted, [1, -1])
							.toArray()
							.map((v) => +v.toFixed(5)),
					).toEqual([0, 0.6, 0.8]);
				}
			},
		);

		it("generates once for a geometry that skinned meshes share, and keeps the skin attributes", async () => {
			const geometry = new BufferGeometry();
			geometry.setAttribute(
				"position",
				new BufferAttribute(new Float32Array(QUAD_POSITIONS), 3),
			);
			geometry.setAttribute(
				"normal",
				new BufferAttribute(new Float32Array(QUAD_NORMALS), 3),
			);
			geometry.setAttribute(
				"uv",
				new BufferAttribute(new Float32Array(QUAD_UVS), 2),
			);
			geometry.setAttribute(
				"skinIndex",
				new BufferAttribute(new Uint16Array(16), 4),
			);
			geometry.setAttribute(
				"skinWeight",
				new BufferAttribute(new Float32Array(16).fill(0.25), 4),
			);
			geometry.setIndex(QUAD_INDICES);
			const material = new LilToonNodeMaterial();
			const a = new SkinnedMesh(geometry, material);
			const b = new SkinnedMesh(geometry, material);
			const needs = vi.fn(() => true);
			await ensureLilToonNodeTangents([a, b], needs);
			expect(a.geometry).toBe(geometry);
			expect(b.geometry).toBe(geometry);
			const count = geometry.getAttribute("position").count;
			expect(geometry.getAttribute("tangent").count).toBe(count);
			expect(geometry.getAttribute("skinIndex").count).toBe(count);
			expect(geometry.getAttribute("skinWeight").count).toBe(count);
			const first = geometry.getAttribute("tangent");
			await ensureLilToonNodeTangents([a, b], needs);
			expect(geometry.getAttribute("tangent")).toBe(first);
		});

		it("gives the lilToon meshes their own geometry when a normal-mapped glTF material shares it", async () => {
			const geometry = new BufferGeometry();
			geometry.setAttribute(
				"position",
				new BufferAttribute(new Float32Array(QUAD_POSITIONS), 3),
			);
			geometry.setAttribute(
				"normal",
				new BufferAttribute(new Float32Array(QUAD_NORMALS), 3),
			);
			geometry.setAttribute(
				"uv",
				new BufferAttribute(new Float32Array(QUAD_UVS), 2),
			);
			geometry.setIndex(QUAD_INDICES);
			const lil = new Mesh(geometry, new LilToonNodeMaterial());
			const standard = new Mesh(
				geometry,
				new MeshStandardMaterial({ normalMap: new DataTexture() }),
			);
			await ensureLilToonNodeTangents(
				[lil, standard],
				(m) => m instanceof LilToonNodeMaterial,
			);
			expect(standard.geometry).toBe(geometry);
			expect(geometry.hasAttribute("tangent")).toBe(false);
			expect(lil.geometry).not.toBe(geometry);
			expect(lil.geometry.hasAttribute("tangent")).toBe(true);
		});
	});
});

describe("enableLilToonNodeVRM", () => {
	const mtoonProperties = (name: string) => ({
		name,
		shader: "VRM/MToon",
		renderQueue: 2000,
		floatProperties: { _OutlineWidthMode: 1, _OutlineWidth: 0.5 },
		vectorProperties: { _Color: [1, 1, 1, 1] },
		textureProperties: {},
		keywordMap: {},
		tagMap: {},
	});

	function vrm0(): Json {
		const json = documentWith([
			lilToon("Body", { shaderVariant: "Hidden/lilToonOutline" }),
			{ name: "Face" },
		]);
		json.extensionsUsed.push("VRM");
		json.extensions = {
			VRM: {
				materialProperties: [mtoonProperties("Body"), mtoonProperties("Face")],
				blendShapeMaster: {
					blendShapeGroups: [
						{
							name: "Joy",
							presetName: "joy",
							binds: [],
							materialValues: [
								{
									materialName: "Body",
									propertyName: "_Color",
									targetValue: [1, 0, 0, 1],
								},
								{
									materialName: "Face",
									propertyName: "_Color",
									targetValue: [1, 0, 0, 1],
								},
							],
						},
					],
				},
			},
		};
		return json;
	}

	const registerVRM =
		(spy?: (plugin: VRMLoaderPlugin) => void) =>
		(loader: GLTFLoader, warnings: LilToonWarning[]) =>
			loader.register((parser: GLTFParser) => {
				const plugin = new VRMLoaderPlugin(parser);
				spy?.(plugin);
				return enableLilToonNodeVRM(plugin, {
					onWarning: (w) => warnings.push(w),
				});
			});

	it("loads a VRM 0 material with MToon properties and the extension as lilToon, without the MToon plugin", async () => {
		let plugin!: VRMLoaderPlugin;
		const getMaterialType = vi.fn();
		const extendMaterialParams = vi.fn();
		const { gltf } = await load(
			vrm0(),
			registerVRM((p) => {
				plugin = p;
				const mtoon = p.mtoonMaterialPlugin;
				const type = mtoon.getMaterialType.bind(mtoon);
				const extend = mtoon.extendMaterialParams.bind(mtoon);
				mtoon.getMaterialType = (index) => (
					getMaterialType(index),
					type(index)
				);
				mtoon.extendMaterialParams = (index, params) => (
					extendMaterialParams(index),
					extend(index, params)
				);
			}),
		);
		const [body, face] = meshes(gltf);
		expect(surface(body!)).toBeInstanceOf(LilToonNodeMaterial);
		expect(surface(face!)).toBeInstanceOf(MToonMaterial);
		expect(getMaterialType).not.toHaveBeenCalledWith(0);
		expect(extendMaterialParams).not.toHaveBeenCalledWith(0);
		expect(getMaterialType).toHaveBeenCalledWith(1);
		expect(gltf.userData.vrmMToonMaterials).not.toContain(surface(body!));
		expect(body!.renderOrder).toBe(0);
	});

	it("loads a VRM 1 material with both extensions as lilToon", async () => {
		const json = documentWith([
			{
				...lilToon("Body", {}),
				extensions: {
					...lilToon("Body", {}).extensions,
					VRMC_materials_mtoon: {
						specVersion: "1.0",
						shadeColorFactor: [1, 1, 1],
					},
				},
			},
		]);
		const { gltf } = await load(json, registerVRM());
		expect(surface(meshes(gltf)[0]!)).toBeInstanceOf(LilToonNodeMaterial);
		expect(gltf.userData.vrmMToonMaterials).toEqual([]);
	});

	it("adds the outline after the three-vrm afterRoot", async () => {
		const states: boolean[] = [];
		const { gltf } = await load(
			vrm0(),
			registerVRM((plugin) => {
				const original = plugin.afterRoot.bind(plugin);
				plugin.afterRoot = async (result) => {
					await original(result);
					states.push(Array.isArray(meshes(result)[0]!.material));
				};
			}),
		);
		expect(states).toEqual([false]);
		expect(meshes(gltf)[0]!.material).toHaveLength(2);
	});

	it("warns for a VRM 0 material value that targets a lilToon material", async () => {
		const { warnings } = await load(vrm0(), registerVRM());
		const binds = warnings.filter((w) => w.property === "_Color");
		expect(binds).toEqual([
			expect.objectContaining({
				code: "unsupported-feature",
				materialName: "Body",
				materialIndex: 0,
			}),
		]);
	});

	it("warns for a VRM 1 material color or texture transform bind on a lilToon material", async () => {
		const json = documentWith([lilToon("Body", {}), { name: "PBR" }]);
		json.extensionsUsed.push("VRMC_vrm");
		json.extensions = {
			VRMC_vrm: {
				specVersion: "1.0",
				expressions: {
					preset: {
						happy: {
							materialColorBinds: [
								{ material: 0, type: "color", targetValue: [1, 0, 0, 1] },
								{ material: 1, type: "color", targetValue: [1, 0, 0, 1] },
							],
						},
					},
					custom: {
						scroll: {
							textureTransformBinds: [
								{ material: 0, scale: [1, 1], offset: [0.5, 0] },
							],
						},
					},
				},
			},
		};
		const { warnings, gltf } = await load(json, registerVRM());
		const binds = warnings.filter((w) => w.code === "unsupported-feature");
		expect(
			binds.map((w) => [w.materialName, w.materialIndex, w.property]),
		).toEqual([
			["Body", 0, "materialColorBinds"],
			["Body", 0, "textureTransformBinds"],
		]);
		expect(gltf.userData.lilToonWarnings).toEqual(warnings);
	});

	it("enhances a plugin once", () => {
		const parser = {
			json: { materials: [] },
			associations: new Map(),
		} as unknown as GLTFParser;
		const plugin = enableLilToonNodeVRM(new VRMLoaderPlugin(parser));
		const hooks = [plugin.loadMaterial, plugin.afterRoot, plugin.beforeRoot];
		expect(enableLilToonNodeVRM(plugin)).toBe(plugin);
		expect([plugin.loadMaterial, plugin.afterRoot, plugin.beforeRoot]).toEqual(
			hooks,
		);
	});

	it("still loads a plain glTF scene", async () => {
		const { gltf } = await load(
			documentWith([lilToon("Body", {}), { name: "PBR" }]),
			registerVRM(),
		);
		const [body, pbr] = meshes(gltf).map(surface);
		expect(body).toBeInstanceOf(LilToonNodeMaterial);
		expect(pbr).toBeInstanceOf(MeshStandardMaterial);
		expect(gltf.userData.vrm).toBeUndefined();
	});
});
