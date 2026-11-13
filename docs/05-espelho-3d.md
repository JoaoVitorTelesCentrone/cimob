# 05 · Espelho de vendas 3D

## Pipeline do modelo
1. Receber Revit, SketchUp ou FBX do arquiteto ou da incorporadora.
2. No Blender: limpar, reduzir polígonos, separar **cada unidade como um objeto** chamado pelo código (`AUR-502`). Lajes, fachada e entorno ficam em objetos separados.
3. Exportar GLB e otimizar com `gltf-transform` (draco, dedup, resize de texturas para no máximo 2048, webp). Meta: **até 8 MB** e no máximo 150 mil triângulos.
4. Subir no Storage e gravar em `developments.model_url`. Mapear `units.mesh_name`.

Sem modelo, o componente `ProceduralBuilding` (como na demo) gera um prédio a partir de andares × unidades, para pré-venda e demonstração.

## Componentes (packages/three)
- `BuildingViewer`: Canvas, CameraControls, luz, céu e sombras. Props: `modelUrl`, `units`, `brand`.
- `UnitLayer`: percorre as meshes cujo nome bate com `units.mesh_name`; aplica material por status; hover e clique.
- `SunController`: `suncalc` com lat/lng do empreendimento e hora do slider; modo noite com janelas acesas.
- `ViewPresets`: Aérea, Frente, Lateral, Fundos, Cobertura (câmeras salvas por empreendimento).
- Estado com `zustand`: `selectedUnit`, `highlightAvailable`, `hour`, `autoRotate`.

## Status ao vivo
Assinar o Supabase Realtime em `units` filtrado por `development_id`. Mudou o status, muda a cor sem recarregar a página.

## Ações da unidade
O card mostra planta, área, preço e status. O botão "Quero essa" abre `wa.me/<numero_org>?text=...Código: AUR-502`, e o código vai para o bot como origem.

## Performance (mobile primeiro)
- `dpr={[1, 2]}`, sombra só na luz do sol, `frameloop="demand"` quando parado.
- Carregar o 3D com `next/dynamic` (ssr: false) e mostrar uma imagem estática primeiro.
- Fallback 2D (grade de unidades) quando não houver WebGL.
- Meta: 30 fps num Android intermediário; LCP abaixo de 2,5 s com a imagem estática.
