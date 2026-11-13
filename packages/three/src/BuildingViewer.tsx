"use client";

import { OrbitControls, Sky, Stars } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Vector3, type DirectionalLight, type PerspectiveCamera } from "three";
import { layoutBuilding, type UnitInput } from "./layout";
import { ModelBuilding } from "./ModelBuilding";
import type { ModelMapping } from "./model";
import { ProceduralBuilding, type DisplayProps, type SelectionProps } from "./ProceduralBuilding";
import { DEFAULT_SUN, sunAt, type Location } from "./sun";
import {
  viewDistance,
  viewPresets,
  type Box,
  type ViewName,
  type ViewPreset,
  type ViewRequest,
} from "./views";

export type ViewerUnit = UnitInput & { meshName: string | null };

export type { ViewRequest } from "./views";

/** Se o GLB não carregar (URL quebrada, arquivo inválido), mostra o prédio montado pela ficha. */
class ModelFallback extends Component<
  { fallback: ReactNode; onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch() {
    this.props.onError();
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

type OrbitLike = { target: Vector3; update(): void };

/**
 * Leva a câmera até a vista pedida (0,6 s, com desaceleração). Na primeira vez, e quando o
 * tamanho do prédio muda (modelo carregou), vai direto para a vista aérea.
 */
function CameraRig({
  presets,
  request,
  distance,
}: {
  presets: Record<ViewName, ViewPreset>;
  request: ViewRequest | null;
  distance: number;
}) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const controls = useThree((s) => s.controls) as OrbitLike | null;
  const invalidate = useThree((s) => s.invalidate);
  const anim = useRef<{ from: [Vector3, Vector3]; to: [Vector3, Vector3]; start: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    const aerial = presets.Aérea;
    camera.position.set(...aerial.position);
    camera.far = distance * 20;
    camera.near = Math.max(0.05, distance / 500);
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.set(...aerial.target);
      controls.update();
    }
    camera.lookAt(...aerial.target);
    invalidate();
  }, [presets, distance, camera, controls, invalidate]);

  useEffect(() => {
    if (!request) return;
    const p = presets[request.name];
    anim.current = {
      from: [camera.position.clone(), controls?.target.clone() ?? new Vector3(...p.target)],
      to: [new Vector3(...p.position), new Vector3(...p.target)],
      start: performance.now(),
    };
    invalidate();
  }, [request, presets, camera, controls, invalidate]);

  useFrame(() => {
    const a = anim.current;
    if (!a) return;
    const k = Math.min(1, (performance.now() - a.start) / 600);
    const e = 1 - (1 - k) ** 3;
    camera.position.lerpVectors(a.from[0], a.to[0], e);
    if (controls) {
      controls.target.lerpVectors(a.from[1], a.to[1], e);
      controls.update();
    } else {
      camera.lookAt(a.to[1]);
    }
    if (k < 1) invalidate();
    else anim.current = null;
  });

  return null;
}

/** Luz do sol mirando o centro do prédio, com a sombra do tamanho dele. */
function SunLight({
  position,
  intensity,
  box,
}: {
  position: [number, number, number];
  intensity: number;
  box: Box;
}) {
  const light = useRef<DirectionalLight>(null);
  const [bx, by, bz] = box.base ?? [0, 0, 0];
  const size = Math.max(box.width, box.depth, box.height) * 0.8;
  const scale = viewDistance(box) / 50;
  useLayoutEffect(() => {
    const l = light.current;
    if (!l) return;
    l.target.position.set(bx, by + box.height / 2, bz);
    l.target.updateMatrixWorld();
    const cam = l.shadow.camera;
    cam.left = -size;
    cam.right = size;
    cam.top = size;
    cam.bottom = -size;
    cam.far = scale * 400;
    cam.updateProjectionMatrix();
  }, [bx, by, bz, box.height, size, scale]);
  return (
    <directionalLight
      ref={light}
      position={[bx + position[0] * scale, by + position[1] * scale, bz + position[2] * scale]}
      intensity={intensity}
      castShadow={intensity > 0}
      shadow-mapSize={[2048, 2048]}
      // Sem bias, as faces ficam serrilhadas.
      shadow-bias={-0.0005}
      shadow-normalBias={0.04}
    />
  );
}

/**
 * Espelho de vendas 3D (doc 05). Com `modelUrl`, usa o modelo do arquiteto; sem ele (ou se ele
 * falhar), monta o prédio a partir da ficha. Sol pela localização e pela hora (`date`); sem
 * localização, luz fixa. `frameloop="demand"`: só desenha quando algo muda.
 */
export function BuildingViewer({
  units,
  modelUrl = null,
  location = null,
  date = null,
  view = null,
  className,
  label,
  selected = null,
  onSelect,
  onlyAvailable = false,
}: {
  units: readonly ViewerUnit[];
  modelUrl?: string | null;
  location?: Location | null;
  /** Data e hora do sol; null = agora não importa (luz fixa até a página escolher a hora). */
  date?: Date | null;
  view?: ViewRequest | null;
  className?: string;
  /** Texto para leitor de tela (o canvas em si não tem conteúdo acessível). */
  label: string;
} & SelectionProps &
  Omit<DisplayProps, "night">) {
  const layout = useMemo(() => layoutBuilding(units), [units]);
  const [linked, setLinked] = useState<number | null>(null);
  const [modelBox, setModelBox] = useState<Box | null>(null);
  const [modelFailed, setModelFailed] = useState(false);
  const onLinked = useCallback((m: ModelMapping, box: Box) => {
    setLinked(m.byObject.size);
    setModelBox((old) =>
      old && old.width === box.width && old.height === box.height && old.depth === box.depth
        ? old
        : box,
    );
  }, []);
  const onModelError = useCallback(() => {
    setModelFailed(true);
  }, []);

  const usingModel = Boolean(modelUrl) && !modelFailed;
  // Só as medidas: o status ao vivo refaz o layout, mas não pode mexer na câmera.
  const { width, depth } = layout.footprint;
  const roofY = layout.roofY;
  const box: Box = useMemo(
    () => (usingModel && modelBox ? modelBox : { width, depth, height: roofY }),
    [usingModel, modelBox, width, depth, roofY],
  );
  const presets = useMemo(() => viewPresets(box), [box]);
  const distance = viewDistance(box);
  const sun = date ? sunAt(location, date) : DEFAULT_SUN;
  const display = { onlyAvailable, night: sun.night };
  const selection = { selected, ...(onSelect ? { onSelect } : {}) };
  const procedural = <ProceduralBuilding layout={layout} {...selection} {...display} />;

  return (
    <div
      className={className}
      role="img"
      aria-label={label}
      data-source={usingModel ? (linked === null ? "loading" : "model") : "procedural"}
      data-units={usingModel ? (linked ?? 0) : layout.blocks.length}
      data-floors={layout.floors}
      data-night={sun.night}
    >
      <Canvas shadows="soft" frameloop="demand" dpr={[1, 2]} camera={{ fov: 38 }}>
        {sun.night ? (
          <>
            <color attach="background" args={["#0B1426"]} />
            <Stars radius={distance * 4} depth={distance} count={1500} factor={4} fade />
            <hemisphereLight args={["#5A6E9A", "#1C2433", 0.35]} />
          </>
        ) : (
          <>
            <Sky sunPosition={sun.position} distance={distance * 40} />
            <hemisphereLight args={["#DFEFFF", "#51603F", 0.6]} />
          </>
        )}
        <SunLight position={sun.position} intensity={sun.intensity} box={box} />
        {usingModel && modelUrl ? (
          <ModelFallback fallback={procedural} onError={onModelError}>
            <Suspense fallback={null}>
              <ModelBuilding
                url={modelUrl}
                units={units}
                onLinked={onLinked}
                {...selection}
                {...display}
              />
            </Suspense>
          </ModelFallback>
        ) : (
          procedural
        )}
        <OrbitControls
          makeDefault
          enablePan={false}
          minDistance={distance * 0.2}
          maxDistance={distance * 3}
          maxPolarAngle={Math.PI / 2.1}
        />
        <CameraRig presets={presets} request={view} distance={distance} />
      </Canvas>
    </div>
  );
}
