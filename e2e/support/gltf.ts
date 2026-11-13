/**
 * Modelo glTF mínimo para o E2E: um cubo por objeto, com o nome do objeto (como o arquiteto
 * exporta do Blender/SketchUp). O buffer vai embutido (data URI), então é um arquivo só.
 */
export function boxesGltf(names: readonly string[]): string {
  // 8 vértices de um cubo 1×1×1 e 12 triângulos.
  const positions = new Float32Array([
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5,
    0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
  ]);
  const indices = new Uint16Array([
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6, 1, 2, 6, 1, 6, 5, 0, 4,
    7, 0, 7, 3,
  ]);
  const buffer = Buffer.concat([Buffer.from(positions.buffer), Buffer.from(indices.buffer)]);
  return JSON.stringify({
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: names.map((_, i) => i) }],
    nodes: names.map((name, i) => ({
      name,
      mesh: 0,
      translation: [(i % 4) * 1.2, Math.floor(i / 4) * 1.2, 0],
    })),
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 8,
        type: "VEC3",
        min: [-0.5, -0.5, -0.5],
        max: [0.5, 0.5, 0.5],
      },
      { bufferView: 1, componentType: 5123, count: indices.length, type: "SCALAR" },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positions.byteLength },
      { buffer: 0, byteOffset: positions.byteLength, byteLength: indices.byteLength },
    ],
    buffers: [
      {
        byteLength: buffer.length,
        uri: `data:application/octet-stream;base64,${buffer.toString("base64")}`,
      },
    ],
  });
}
