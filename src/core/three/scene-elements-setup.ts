
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
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
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
  const ambientLight = new THREE.AmbientLight(0xffffff, 2.0); // Increased intensity
  scene.add(ambientLight);

  const hemisphereLight = new THREE.HemisphereLight(0xADD8E6, 0x495436, 0.8);
  scene.add(hemisphereLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 3.0); // Increased intensity
  directionalLight.position.set(10, 15, 10);
  directionalLight.castShadow = false; // Sombras desabilitadas
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
    opacity: 0.4, // Increased transparency
  });
  const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = 0;
  groundMesh.receiveShadow = false; // Sombras desabilitadas
  groundMesh.userData = { tag: 'terrain-ground-plane' };
  scene.add(groundMesh);
  return groundMesh;
}


/**
 * Configura os renderizadores principais (WebGL, CSS2D) e o pipeline de pós-processamento.
 * Centraliza a criação do WebGLRenderer, CSS2DRenderer, EffectComposer e OutlinePass.
 * @param {HTMLElement} mountElement - O elemento DOM onde o canvas WebGL será montado.
 * @param {THREE.Scene} scene - A cena Three.js.
 * @param {THREE.PerspectiveCamera} camera - A câmera da cena.
 * @returns {{
 *   renderer: THREE.WebGLRenderer;
 *   labelRenderer: CSS2DRenderer;
 *   composer: EffectComposer;
 *   outlinePass: OutlinePass;
 * }} Um objeto contendo as instâncias configuradas, ou null se mountElement não for válido.
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
  renderer.shadowMap.enabled = false; // Sombras desabilitadas globalmente no renderer
  scene.background = new THREE.Color(0xA9C1D1); // Cinza azulado claro para o fundo
  scene.fog = new THREE.Fog(0xA9C1D1, 40, 150);  // Névoa da mesma cor do fundo


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
  // Configurações padrão do OutlinePass são definidas em postprocessing-utils
  composer.addPass(outlinePass);

  // Adiciona os renderizadores ao DOM apenas se não estiverem já lá
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
 * @property {(item: Equipment, colorMode: ColorMode) => THREE.Object3D} createSingleEquipmentMesh - Função para criar um mesh de equipamento individual.
 * @property {React.MutableRefObject<THREE.Mesh | null>} groundMeshRef - Ref para o mesh do plano de chão, para controle de visibilidade.
 */
interface UpdateEquipmentMeshesParams {
  scene: THREE.Scene;
  equipmentMeshesRef: React.MutableRefObject<THREE.Object3D[]>;
  newEquipmentData: Equipment[];
  layers: Layer[];
  colorMode: ColorMode;
  createSingleEquipmentMesh: (item: Equipment, colorMode: ColorMode) => THREE.Object3D;
  groundMeshRef: React.MutableRefObject<THREE.Mesh | null>;
}

/**
 * Atualiza a lista de meshes de equipamentos na cena com base nos novos dados.
 * Remove meshes antigos, atualiza existentes e adiciona novos, considerando a visibilidade das camadas.
 * Também gerencia a visibilidade do plano de chão com base na camada 'Terrain'.
 *
 * @param {UpdateEquipmentMeshesParams} params - Os parâmetros para a função.
 */
export function updateEquipmentMeshesInScene({
  scene,
  equipmentMeshesRef,
  newEquipmentData,
  layers,
  colorMode,
  createSingleEquipmentMesh,
  groundMeshRef,
}: UpdateEquipmentMeshesParams): void {
  if (!scene) {
    // console.warn('[SceneElementsSetup] updateEquipmentMeshesInScene: scene is null.');
    return;
  }
  if (!equipmentMeshesRef) {
    console.error('[SceneElementsSetup] updateEquipmentMeshesInScene: equipmentMeshesRef parameter is undefined or null.');
    return;
  }
   if (!equipmentMeshesRef.current) {
    console.error('[SceneElementsSetup] updateEquipmentMeshesInScene: equipmentMeshesRef.current is undefined or null.');
    return;
  }


  const currentMeshesByTag: Map<string, THREE.Object3D> = new Map();
  equipmentMeshesRef.current.forEach(mesh => {
    if (mesh.userData.tag) {
      currentMeshesByTag.set(mesh.userData.tag, mesh);
    }
  });

  const tagsInNewData = new Set(newEquipmentData.map(e => e.tag));
  const newVisibleMeshes: THREE.Object3D[] = [];

  // Remover meshes que não estão nos novos dados ou cuja camada os tornou invisíveis
  equipmentMeshesRef.current.forEach(mesh => {
    const itemInNewData = newEquipmentData.find(e => e.tag === mesh.userData.tag);
    const layer = itemInNewData ? layers.find(l => l.equipmentType === itemInNewData.type) : undefined;
    const isVisibleByLayer = layer?.isVisible ?? (itemInNewData ? true : false); // Se não há camada específica, assume visível se o item existe

    if (!tagsInNewData.has(mesh.userData.tag) || (itemInNewData && !isVisibleByLayer)) {
      // console.log(`[SceneElementsSetup] Removing mesh ${mesh.userData.tag}`);
      scene.remove(mesh);
      if (mesh instanceof THREE.Mesh) {
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else if (mesh.material) {
          (mesh.material as THREE.Material).dispose();
        }
      }
      currentMeshesByTag.delete(mesh.userData.tag); // Remove from map to avoid re-adding
    }
  });

  // Adicionar novos ou atualizar existentes
  newEquipmentData.forEach(item => {
    const layer = layers.find(l => l.equipmentType === item.type);
    const isVisibleByLayer = layer?.isVisible ?? true;

    if (!isVisibleByLayer) {
      // Se a camada torna o item invisível, e ele existia, já foi removido acima.
      // Se não existia, não fazemos nada.
      return;
    }

    let existingMesh = currentMeshesByTag.get(item.tag);

    if (existingMesh) { // Mesh já existe, precisa ser atualizado (cor/material)
      // console.log(`[SceneElementsSetup] Updating existing mesh for ${item.tag}.`);
      // Remove o antigo para recriar com o novo material/cor, se necessário
      // Ou, idealmente, apenas atualiza o material do mesh existente
      scene.remove(existingMesh);
      if (existingMesh instanceof THREE.Mesh) {
        existingMesh.geometry?.dispose(); // A geometria geralmente não muda, mas o material sim
        if (Array.isArray(existingMesh.material)) {
            existingMesh.material.forEach(m => m.dispose());
        } else if (existingMesh.material) {
            (existingMesh.material as THREE.Material).dispose();
        }
      }
      const updatedMesh = createSingleEquipmentMesh(item, colorMode);
      scene.add(updatedMesh);
      newVisibleMeshes.push(updatedMesh);
    } else { // Mesh não existe, criar novo
      // console.log(`[SceneElementsSetup] Creating new mesh for ${item.tag}.`);
      const newMesh = createSingleEquipmentMesh(item, colorMode);
      scene.add(newMesh);
      newVisibleMeshes.push(newMesh);
    }
  });

  equipmentMeshesRef.current = newVisibleMeshes;

  // Gerenciar visibilidade do plano de chão
  const terrainLayer = layers.find(l => l.id === 'layer-terrain');
  if (terrainLayer && groundMeshRef && groundMeshRef.current) { // Check groundMeshRef itself
    const isGroundInScene = scene.children.some(child => child.uuid === groundMeshRef.current?.uuid);
    if (terrainLayer.isVisible && !isGroundInScene) {
      scene.add(groundMeshRef.current);
    } else if (!terrainLayer.isVisible && isGroundInScene) {
      scene.remove(groundMeshRef.current);
    }
  } else if (terrainLayer && !groundMeshRef) {
      console.warn('[SceneElementsSetup] Terrain layer exists but groundMeshRef is not provided.');
  }
}
