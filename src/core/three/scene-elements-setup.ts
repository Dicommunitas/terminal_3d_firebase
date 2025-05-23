
/**
 * @fileOverview Utilitários para configurar elementos básicos (luzes, chão, renderizadores, pós-processamento)
 * de uma cena Three.js e para gerenciar os meshes dos equipamentos.
 *
 * Responsabilidades:
 * - Configurar a iluminação da cena.
 * - Configurar o plano de chão (terreno).
 * - Configurar o pipeline de renderização (WebGL renderer, CSS2D renderer, EffectComposer, OutlinePass).
 * - Atualizar os meshes dos equipamentos na cena com base nos dados e camadas.
 */
import * as THREE from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'; // Importado
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import type { Equipment, Layer, ColorMode } from '@/lib/types';

/**
 * Configura a iluminação padrão para a cena.
 * Adiciona uma AmbientLight, HemisphereLight e DirectionalLight.
 * @param {THREE.Scene} scene A instância da cena Three.js onde as luzes serão adicionadas.
 */
export function setupLighting(scene: THREE.Scene): void {
  const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
  scene.add(ambientLight);

  const hemisphereLight = new THREE.HemisphereLight(0xADD8E6, 0x495436, 0.8);
  scene.add(hemisphereLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 3.0);
  directionalLight.position.set(10, 15, 10);
  directionalLight.castShadow = false;
  scene.add(directionalLight);
}

/**
 * Configura o plano de chão (terreno) para a cena.
 * @param {THREE.Scene} scene A instância da cena Three.js onde o plano será adicionado.
 * @returns {THREE.Mesh} O mesh do plano de chão criado.
 */
export function setupGroundPlane(scene: THREE.Scene): THREE.Mesh {
  const groundGeometry = new THREE.PlaneGeometry(100, 100);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0xE6D8B0, // Sand color
    side: THREE.DoubleSide,
    metalness: 0.1,
    roughness: 0.8,
    transparent: true,
    opacity: 0.4,
  });
  const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = 0;
  groundMesh.receiveShadow = false;
  groundMesh.userData = { tag: 'terrain-ground-plane' }; // Adiciona tag para identificação, se necessário
  scene.add(groundMesh);
  return groundMesh;
}


/**
 * Configura os renderizadores principais (WebGL, CSS2D) e o pipeline de pós-processamento.
 * Centraliza a criação do WebGLRenderer, CSS2DRenderer, EffectComposer e OutlinePass.
 * @param {HTMLElement} mountElement - O elemento DOM onde o canvas WebGL e o renderer de labels serão montados.
 * @param {THREE.Scene} scene - A cena Three.js.
 * @param {THREE.PerspectiveCamera} camera - A câmera da cena.
 * @returns {{
 *   renderer: THREE.WebGLRenderer;
 *   labelRenderer: CSS2DRenderer;
 *   composer: EffectComposer;
 *   outlinePass: OutlinePass;
 * } | null} Um objeto contendo as instâncias configuradas, ou null se mountElement não for válido.
 */
export function setupRenderPipeline(
  mountElement: HTMLElement,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): {
  renderer: THREE.WebGLRenderer;
  labelRenderer: CSS2DRenderer;
  composer: EffectComposer;
  outlinePass: OutlinePass;
} | null {
  if (!mountElement) {
    console.error("[SceneElementsSetup] setupRenderPipeline: mountElement is not valid.");
    return null;
  }
  const initialWidth = Math.max(1, mountElement.clientWidth);
  const initialHeight = Math.max(1, mountElement.clientHeight);

  // WebGL Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(initialWidth, initialHeight);
  renderer.shadowMap.enabled = false;
  scene.background = new THREE.Color(0xA9C1D1); 
  scene.fog = new THREE.Fog(0xA9C1D1, 40, 150);


  // CSS2D Renderer para rótulos HTML
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(initialWidth, initialHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0px';
  labelRenderer.domElement.style.left = '0px';
  labelRenderer.domElement.style.pointerEvents = 'none';

  // EffectComposer e Passes para Pós-Processamento
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const outlinePass = new OutlinePass(new THREE.Vector2(initialWidth, initialHeight), scene, camera);
  outlinePass.edgeStrength = 0;
  outlinePass.edgeGlow = 0.0;
  outlinePass.edgeThickness = 1.0;
  outlinePass.visibleEdgeColor.set('#ffffff');
  outlinePass.hiddenEdgeColor.set('#190a05');
  outlinePass.pulsePeriod = 0;
  composer.addPass(outlinePass);

  if (!renderer.domElement.parentNode) {
    mountElement.appendChild(renderer.domElement);
  }
  if (!labelRenderer.domElement.parentNode) {
    mountElement.appendChild(labelRenderer.domElement);
  }

  return { renderer, labelRenderer, composer, outlinePass };
}

/**
 * Interface para os parâmetros da função `updateEquipmentMeshesInScene`.
 * @interface UpdateEquipmentMeshesParams
 * @property {THREE.Scene} scene - A cena Three.js.
 * @property {React.MutableRefObject<THREE.Object3D[]>} equipmentMeshesRef - Ref para o array de meshes de equipamentos existentes.
 * @property {Equipment[]} newEquipmentData - A nova lista de equipamentos a serem renderizados (já filtrada).
 * @property {Layer[]} layers - A lista de camadas para determinar a visibilidade por tipo.
 * @property {ColorMode} colorMode - O modo de colorização atual para os equipamentos.
 * @property {(item: Equipment) => THREE.Object3D} createSingleEquipmentMesh - Função callback para criar um mesh de equipamento individual.
 * @property {React.MutableRefObject<THREE.Mesh | null>} groundMeshRef - Ref para o mesh do plano de chão, para controle de visibilidade.
 */
interface UpdateEquipmentMeshesParams {
  scene: THREE.Scene;
  equipmentMeshesRef: React.MutableRefObject<THREE.Object3D[]>;
  newEquipmentData: Equipment[];
  layers: Layer[];
  colorMode: ColorMode; // colorMode é usado por createSingleEquipmentMesh, que é chamado aqui
  createSingleEquipmentMesh: (item: Equipment) => THREE.Object3D;
  groundMeshRef: React.MutableRefObject<THREE.Mesh | null>;
}

/**
 * Atualiza a lista de meshes de equipamentos na cena com base nos novos dados.
 * Remove meshes antigos, atualiza existentes (se necessário, recriando-os) e adiciona novos,
 * considerando a visibilidade das camadas. Também gerencia a visibilidade do plano de chão.
 *
 * @param {UpdateEquipmentMeshesParams} params - Os parâmetros para a função.
 */
export function updateEquipmentMeshesInScene({
  scene,
  equipmentMeshesRef,
  newEquipmentData,
  layers,
  colorMode, // colorMode é recebido para ser passado para createSingleEquipmentMesh, se necessário
  createSingleEquipmentMesh,
  groundMeshRef,
}: UpdateEquipmentMeshesParams): void {
  if (!scene) {
    // console.warn('[SceneElementsSetup updateEquipmentMeshesInScene] scene is null.');
    return;
  }
  if (!equipmentMeshesRef || equipmentMeshesRef.current === undefined || equipmentMeshesRef.current === null) {
    console.error('[SceneElementsSetup updateEquipmentMeshesInScene] equipmentMeshesRef or its .current is undefined/null.');
    return;
  }
   
  const currentMeshesByTag: Map<string, THREE.Object3D> = new Map();
  equipmentMeshesRef.current.forEach(mesh => {
    if (mesh.userData.tag) {
      currentMeshesByTag.set(mesh.userData.tag, mesh);
    }
  });

  const tagsInNewData = new Set(newEquipmentData.map(e => e.tag));
  const newVisibleMeshesList: THREE.Object3D[] = [];

  // 1. Remover meshes que não estão nos novos dados ou cuja camada os tornou invisíveis
  equipmentMeshesRef.current.forEach(mesh => {
    const itemTag = mesh.userData.tag;
    const itemInNewData = newEquipmentData.find(e => e.tag === itemTag);
    const layer = itemInNewData ? layers.find(l => l.equipmentType === itemInNewData.type) : undefined;
    const isVisibleByLayer = layer?.isVisible ?? (itemInNewData ? true : false);

    if (!tagsInNewData.has(itemTag) || (itemInNewData && !isVisibleByLayer)) {
      // console.log(`[SceneElementsSetup] Removing mesh ${itemTag}`);
      scene.remove(mesh);
      if (mesh instanceof THREE.Mesh) {
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else if (mesh.material) {
          (mesh.material as THREE.Material).dispose();
        }
      }
      currentMeshesByTag.delete(itemTag);
    }
  });

  // 2. Adicionar novos ou atualizar existentes
  newEquipmentData.forEach(item => {
    const layer = layers.find(l => l.equipmentType === item.type);
    const isVisibleByLayer = layer?.isVisible ?? true;

    if (!isVisibleByLayer) {
      // Se a camada torna o item invisível, e ele existia, já foi removido acima.
      // Se não existia, não fazemos nada aqui.
      return;
    }

    let existingMesh = currentMeshesByTag.get(item.tag);

    // Se o mesh deve estar visível (passou pelo filtro de camada)
    // E se ele não existe, ou se existe mas algo mudou (aqui, a cor é a principal preocupação)
    // Para simplificar a atualização de cor, sempre recriamos o mesh se ele precisa ser visível.
    // Uma otimização seria verificar se apenas o material precisa ser atualizado.
    if (existingMesh) {
        // Remove o antigo para recriar (garante que a cor/material esteja atualizado)
        scene.remove(existingMesh);
        if (existingMesh instanceof THREE.Mesh) {
            existingMesh.geometry?.dispose();
             if (Array.isArray(existingMesh.material)) {
                existingMesh.material.forEach(m => m.dispose());
            } else if (existingMesh.material) {
                (existingMesh.material as THREE.Material).dispose();
            }
        }
    }
    
    // Cria um novo mesh (ou recria com material atualizado)
    // console.log(`[SceneElementsSetup] Creating/Recreating mesh for ${item.tag} with colorMode: ${colorMode}`);
    const newOrUpdatedMesh = createSingleEquipmentMesh(item); // createSingleEquipmentMesh já usa o colorMode do seu próprio escopo
    scene.add(newOrUpdatedMesh);
    newVisibleMeshesList.push(newOrUpdatedMesh);
  });

  equipmentMeshesRef.current = newVisibleMeshesList;

  // 3. Gerenciar visibilidade do plano de chão
  const terrainLayer = layers.find(l => l.id === 'layer-terrain');
  if (terrainLayer && groundMeshRef && groundMeshRef.current) {
    const isGroundInScene = scene.children.some(child => child.uuid === groundMeshRef.current?.uuid);
    if (terrainLayer.isVisible && !isGroundInScene) {
      scene.add(groundMeshRef.current);
    } else if (!terrainLayer.isVisible && isGroundInScene) {
      scene.remove(groundMeshRef.current);
    }
  } else if (terrainLayer && !groundMeshRef) {
      // console.warn('[SceneElementsSetup] Terrain layer exists but groundMeshRef is not provided or its .current is null.');
  }
}
