
/**
 * @fileOverview Utilitários para configurar elementos básicos (luzes, chão)
 * e o pipeline de renderização de uma cena Three.js.
 * Também gerencia a adição, remoção e atualização dos meshes dos equipamentos na cena.
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
  directionalLight.castShadow = false; // Shadows disabled
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
  groundMesh.receiveShadow = false; // Shadows disabled
  groundMesh.userData = { tag: 'terrain-ground-plane' };
  scene.add(groundMesh);
  return groundMesh;
}


/**
 * Configura os renderizadores principais (WebGL, CSS2D) e o pipeline de pós-processamento.
 * @param {HTMLElement} mountElement - O elemento DOM onde o canvas WebGL será montado.
 * @param {THREE.Scene} scene - A cena Three.js.
 * @param {THREE.PerspectiveCamera} camera - A câmera da cena.
 * @returns {{
 *   renderer: THREE.WebGLRenderer;
 *   labelRenderer: CSS2DRenderer;
 *   composer: EffectComposer;
 *   outlinePass: OutlinePass;
 * }} Um objeto contendo as instâncias configuradas.
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
} {
  const initialWidth = Math.max(1, mountElement.clientWidth);
  const initialHeight = Math.max(1, mountElement.clientHeight);
  
  // WebGL Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(initialWidth, initialHeight);
  renderer.shadowMap.enabled = false; // Shadows disabled globally for renderer
  scene.background = new THREE.Color(0xA9C1D1); // Light grayish-blue background
  scene.fog = new THREE.Fog(0xA9C1D1, 40, 150); // Fog matching background

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
  outlinePass.edgeStrength = 3.0;
  outlinePass.edgeGlow = 0.0; 
  outlinePass.edgeThickness = 1.0;
  outlinePass.visibleEdgeColor.set('#ffffff'); 
  outlinePass.hiddenEdgeColor.set('#190a05');
  outlinePass.pulsePeriod = 0;
  composer.addPass(outlinePass);

  // Adicionar renderers ao DOM depois de configurar
  // É importante adicionar o labelRenderer sobre o renderer principal
  mountElement.appendChild(renderer.domElement);
  mountElement.appendChild(labelRenderer.domElement);


  return { renderer, labelRenderer, composer, outlinePass };
}

/**
 * Atualiza a lista de meshes de equipamentos na cena com base nos novos dados.
 * Remove meshes antigos, atualiza existentes e adiciona novos, considerando a visibilidade das camadas.
 *
 * @param {THREE.Scene} scene - A cena Three.js.
 * @param {React.MutableRefObject<THREE.Object3D[]>} equipmentMeshesRef - Ref para o array de meshes de equipamentos existentes.
 * @param {Equipment[]} newEquipmentData - A nova lista de equipamentos a serem renderizados (já filtrada).
 * @param {Layer[]} layers - A lista de camadas para determinar a visibilidade por tipo.
 * @param {(item: Equipment) => THREE.Object3D} createSingleEquipmentMesh - Função para criar um mesh de equipamento individual.
 * @param {React.MutableRefObject<THREE.Mesh | null>} groundMeshRef - Ref para o mesh do plano de chão, para controle de visibilidade.
 */
export function updateEquipmentMeshesInScene(
  scene: THREE.Scene,
  equipmentMeshesRef: React.MutableRefObject<THREE.Object3D[]>,
  newEquipmentData: Equipment[],
  layers: Layer[],
  createSingleEquipmentMesh: (item: Equipment) => THREE.Object3D,
  groundMeshRef: React.MutableRefObject<THREE.Mesh | null> // Added groundMeshRef parameter
): void {
  // console.log('[SceneElementsSetup updateEquipmentMeshesInScene] Updating equipment. New data count:', newEquipmentData.length);
  
  const currentMeshesByTag: Map<string, THREE.Object3D> = new Map();
  equipmentMeshesRef.current.forEach(mesh => {
    if (mesh.userData.tag) { // Changed from equipmentTag to tag
      currentMeshesByTag.set(mesh.userData.tag, mesh);
    }
  });

  const newVisibleMeshes: THREE.Object3D[] = [];
  const tagsInNewData = new Set(newEquipmentData.map(e => e.tag));

  // Remover meshes que não estão nos novos dados ou cuja camada foi desativada
  equipmentMeshesRef.current.forEach(mesh => {
    const equipmentDetails = newEquipmentData.find(e => e.tag === mesh.userData.tag);
    const layer = equipmentDetails ? layers.find(l => l.equipmentType === equipmentDetails.type) : undefined;
    const isVisibleByLayer = layer?.isVisible ?? true;

    if (!tagsInNewData.has(mesh.userData.tag) || !isVisibleByLayer) {
      // console.log(`[SceneElementsSetup] Removing mesh: ${mesh.userData.tag}`);
      scene.remove(mesh);
      if (mesh instanceof THREE.Mesh) {
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else if (mesh.material) {
          (mesh.material as THREE.Material).dispose();
        }
      }
    }
  });

  // Adicionar ou atualizar meshes
  newEquipmentData.forEach(item => {
    const layer = layers.find(l => l.equipmentType === item.type);
    const isVisibleByLayer = layer?.isVisible ?? true;

    if (!isVisibleByLayer) {
      // Se um mesh existente para este item estava na cena, ele já foi removido acima.
      return; 
    }

    let existingMesh = currentMeshesByTag.get(item.tag);

    // Sempre recria/atualiza o mesh se a camada estiver visível para refletir mudanças de cor/estado
    if (existingMesh) {
      scene.remove(existingMesh);
      // Dispor geometria/material do mesh antigo antes de criar um novo
       if (existingMesh instanceof THREE.Mesh) {
        existingMesh.geometry?.dispose();
        if (Array.isArray(existingMesh.material)) {
          existingMesh.material.forEach(m => m.dispose());
        } else if (existingMesh.material) {
          (existingMesh.material as THREE.Material).dispose();
        }
      }
    }
    
    const newOrUpdatedMesh = createSingleEquipmentMesh(item);
    scene.add(newOrUpdatedMesh);
    newVisibleMeshes.push(newOrUpdatedMesh);
  });

  equipmentMeshesRef.current = newVisibleMeshes;
  // console.log('[SceneElementsSetup] Equipment meshes updated. Active mesh count:', newVisibleMeshes.length);

  // Gerenciar visibilidade do plano de chão
  const terrainLayer = layers.find(l => l.id === 'layer-terrain');
  if (terrainLayer && groundMeshRef && groundMeshRef.current) { // Check if groundMeshRef itself is defined
    const isGroundInScene = scene.children.some(child => child.uuid === groundMeshRef.current?.uuid);
    if (terrainLayer.isVisible && !isGroundInScene) {
      scene.add(groundMeshRef.current);
    } else if (!terrainLayer.isVisible && isGroundInScene) {
      scene.remove(groundMeshRef.current);
    }
  }
}
