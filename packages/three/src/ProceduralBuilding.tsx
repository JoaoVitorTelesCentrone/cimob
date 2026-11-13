import type { ThreeEvent } from "@react-three/fiber";
import { useState } from "react";
import type { BuildingLayout, UnitBlock } from "./layout";
import { unitLook } from "./look";

const CONCRETE = "#F2EFE8";
const GLASS = "#8FB2C6";
const LOBBY = "#5B6E7C";
const GROUND = "#6F8A55";

export type SelectionProps = {
  /** Código da unidade escolhida (fica destacada). */
  selected?: string | null;
  onSelect?: (code: string) => void;
};

export type DisplayProps = {
  /** "Só disponíveis": apaga as unidades reservadas e vendidas. */
  onlyAvailable?: boolean;
  /** Noite: as janelas acendem. */
  night?: boolean;
};

/** Cursor de mão sobre as unidades (só no navegador). */
export function setPointer(active: boolean): void {
  if (typeof document !== "undefined") document.body.style.cursor = active ? "pointer" : "";
}

function UnitMesh({
  block,
  highlighted,
  onlyAvailable,
  night,
  onSelect,
  onHover,
}: {
  block: UnitBlock;
  highlighted: boolean;
  onlyAvailable: boolean;
  night: boolean;
  onSelect: (code: string) => void;
  onHover: (code: string | null) => void;
}) {
  const scale = highlighted ? 1.04 : 1;
  const look = unitLook({ status: block.status, highlighted, onlyAvailable, night });
  return (
    // O nome é o código da unidade (AUR-502); `highlighted` em userData deixa o destaque verificável.
    <mesh
      name={block.code}
      position={block.position}
      scale={[scale, scale, scale]}
      userData={{ code: block.code, highlighted, dimmed: look.dimmed }}
      castShadow={!look.dimmed}
      receiveShadow
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect(block.code);
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onHover(block.code);
        setPointer(true);
      }}
      onPointerOut={() => {
        onHover(null);
        setPointer(false);
      }}
    >
      <boxGeometry args={block.size} />
      {/* Trocar de opaco para translúcido pede outro shader: a chave recria o material. */}
      <meshStandardMaterial
        key={look.opacity < 1 ? "translucent" : "opaque"}
        color={GLASS}
        emissive={look.emissive}
        emissiveIntensity={look.emissiveIntensity}
        transparent={look.opacity < 1}
        opacity={look.opacity}
        roughness={0.35}
        metalness={0.05}
      />
    </mesh>
  );
}

/** Prédio montado a partir do layout: térreo, lajes, cobertura e um bloco por unidade. */
export function ProceduralBuilding({
  layout,
  selected = null,
  onSelect = () => undefined,
  onlyAvailable = false,
  night = false,
}: { layout: BuildingLayout } & SelectionProps & DisplayProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const { footprint, floors, floorHeight, roofY, blocks } = layout;
  const width = footprint.width;
  const depth = footprint.depth;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color={GROUND} roughness={1} />
      </mesh>
      <mesh position={[0, floorHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width - 1, floorHeight, depth - 1]} />
        <meshStandardMaterial color={LOBBY} roughness={0.35} metalness={0.1} />
      </mesh>
      {Array.from({ length: floors }, (_, i) => (
        <mesh key={i} position={[0, (i + 1) * floorHeight, 0]} castShadow receiveShadow>
          <boxGeometry args={[width, 0.3, depth]} />
          <meshStandardMaterial color={CONCRETE} roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, roofY - 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.4, 0.5, depth + 0.4]} />
        <meshStandardMaterial color={CONCRETE} roughness={0.85} />
      </mesh>
      {blocks.map((b) => (
        <UnitMesh
          key={b.code}
          block={b}
          highlighted={b.code === selected || b.code === hovered}
          onlyAvailable={onlyAvailable}
          night={night}
          onSelect={onSelect}
          onHover={setHovered}
        />
      ))}
    </group>
  );
}
