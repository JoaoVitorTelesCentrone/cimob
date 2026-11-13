import { useGLTF } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { Box3, MeshStandardMaterial, Vector3, type Mesh, type Object3D } from "three";
import { unitLook } from "./look";
import { mapModel, type ModelMapping, type ModelUnit } from "./model";
import { setPointer, type DisplayProps, type SelectionProps } from "./ProceduralBuilding";
import type { Box } from "./views";

const GLASS = "#8FB2C6";

const isMesh = (o: Object3D): o is Mesh => (o as Mesh).isMesh;

/**
 * Modelo do arquiteto (GLB com Draco, doc 05). Cada objeto cujo nome bate com o `mesh_name` da
 * ficha vira a unidade: material pela cor do status, clique e destaque. O resto fica como veio.
 */
export function ModelBuilding({
  url,
  units,
  selected = null,
  onSelect = () => undefined,
  onlyAvailable = false,
  night = false,
  onLinked,
}: {
  url: string;
  units: readonly ModelUnit[];
  /** Avisa quais unidades foram ligadas e o tamanho do modelo (para as vistas). */
  onLinked?: (mapping: ModelMapping, box: Box) => void;
} & SelectionProps &
  DisplayProps) {
  const { scene } = useGLTF(url, true);
  const invalidate = useThree((s) => s.invalidate);
  // Cópia própria: a cena em cache do useGLTF não deve receber os materiais de status.
  const root = useMemo(() => scene.clone(true), [scene]);
  const meshes = useMemo(() => {
    const list: Mesh[] = [];
    root.traverse((o) => {
      if (isMesh(o)) {
        o.castShadow = true;
        o.receiveShadow = true;
        list.push(o);
      }
    });
    return list;
  }, [root]);
  const mapping = useMemo(
    () =>
      mapModel(
        meshes.map((m) => m.name),
        units,
      ),
    [meshes, units],
  );
  const [hovered, setHovered] = useState<string | null>(null);

  const box = useMemo((): Box => {
    const bounds = new Box3().setFromObject(root);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    return {
      width: size.x,
      depth: size.z,
      height: size.y,
      base: [center.x, bounds.min.y, center.z],
    };
  }, [root]);

  useEffect(() => {
    onLinked?.(mapping, box);
  }, [mapping, box, onLinked]);

  // Um material por objeto de unidade, criado uma vez por modelo; status, destaque, noite e
  // "só disponíveis" só mudam cor, brilho e transparência (o status muda ao vivo).
  const materials = useMemo(() => {
    const map = new Map<string, MeshStandardMaterial>();
    for (const mesh of meshes) {
      const material = new MeshStandardMaterial({ color: GLASS, roughness: 0.35, metalness: 0.05 });
      map.set(mesh.name, material);
    }
    return map;
  }, [meshes]);

  useEffect(() => {
    for (const mesh of meshes) {
      const link = mapping.byObject.get(mesh.name);
      const material = materials.get(mesh.name);
      if (!link || !material) continue;
      const highlighted = link.code === selected || link.code === hovered;
      const look = unitLook({ status: link.status, highlighted, onlyAvailable, night });
      mesh.material = material;
      material.emissive.set(look.emissive);
      material.emissiveIntensity = look.emissiveIntensity;
      material.opacity = look.opacity;
      const transparent = look.opacity < 1;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      mesh.castShadow = !look.dimmed;
      mesh.userData = { code: link.code, highlighted, dimmed: look.dimmed };
    }
    invalidate();
  }, [meshes, mapping, materials, selected, hovered, onlyAvailable, night, invalidate]);

  useEffect(
    () => () => {
      for (const material of materials.values()) material.dispose();
    },
    [materials],
  );

  const codeOf = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
    mapping.byObject.get(e.object.name)?.code ?? null;

  return (
    <primitive
      object={root}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        const code = codeOf(e);
        if (!code) return;
        e.stopPropagation();
        onSelect(code);
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        const code = codeOf(e);
        if (!code) return;
        e.stopPropagation();
        setHovered(code);
        setPointer(true);
      }}
      onPointerOut={() => {
        setHovered(null);
        setPointer(false);
      }}
    />
  );
}
