
/**
 * @fileOverview Utilitários para configurar elementos básicos (luzes, chão)
 * e o pipeline de renderização de uma cena Three.js.
 * Também gerencia a adição, remoção e atualização dos meshes dos equipamentos na cena.
 */
import * as THREE from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import type { Equipment, Layer } from '@/lib/types'; // ColorMode é usado implicitamente via createSingleEquipmentMesh

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
 * Cria uma geometria de plano com um material de cor de areia e transparência.
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
  groundMesh.userData = { tag: 'terrain-ground-plane' }; // Add a tag for identification
  scene.add(groundMesh);
  return groundMesh;
}


/**
 * Configura os renderizadores principais (WebGL, CSS2D) e o pipeline de pós-processamento.
 * @param {HTMLElement} mountElement - O elemento DOM onde o canvas WebGL será montado.
 * @param {THREE.Scene} scene - A cena Three.js.
 * @param {THREE.PerspectiveCamera} camera - A câmera da cena.
 * @param {number} initialWidth - A largura inicial para os renderizadores.
 * @param {number} initialHeight - A altura inicial para os renderizadores.
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
  initialWidth: number,
  initialHeight: number
): {
  renderer: THREE.WebGLRenderer;
  labelRenderer: CSS2DRenderer;
  composer: EffectComposer;
  outlinePass: OutlinePass;
} {
  // WebGL Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(initialWidth, initialHeight);
  renderer.shadowMap.enabled = false;
  scene.background = new THREE.Color(0xA9C1D1);
  scene.fog = new THREE.Fog(0xA9C1D1, 40, 150);
  mountElement.appendChild(renderer.domElement);

  // CSS2D Renderer para rótulos HTML
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(initialWidth, initialHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0px';
  labelRenderer.domElement.style.left = '0px';
  labelRenderer.domElement.style.pointerEvents = 'none'; // Crucial para não bloquear interações com a cena 3D
  mountElement.appendChild(labelRenderer.domElement);
  
  // EffectComposer e Passes para Pós-Processamento
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const outlinePass = new OutlinePass(new THREE.Vector2(initialWidth, initialHeight), scene, camera);
  outlinePass.edgeStrength = 3.0;
  outlinePass.edgeGlow = 0.0; // Começa sem brilho, será ajustado dinamicamente
  outlinePass.edgeThickness = 1.0;
  outlinePass.visibleEdgeColor.set('#ffffff'); // Cor padrão, será sobrescrita
  outlinePass.hiddenEdgeColor.set('#190a05'); // Cor para bordas ocultas
  outlinePass.pulsePeriod = 0; // Desabilita pulsação por padrão
  composer.addPass(outlinePass);

  return { renderer, labelRenderer, composer, outlinePass };
}

/**
 * Atualiza a lista de meshes de equipamentos na cena com base nos novos dados.
 * Remove meshes antigos, atualiza existentes (recriando-os para refletir mudanças de cor/estado) e adiciona novos.
 * Esta função é responsável por manter a cena sincronizada com o estado dos dados dos equipamentos.
 *
 * @param {THREE.Scene} scene - A cena Three.js.
 * @param {React.MutableRefObject<THREE.Object3D[]>} equipmentMeshesRef - Ref para o array de meshes de equipamentos existentes.
 * @param {Equipment[]} newEquipmentData - A nova lista de equipamentos a serem renderizados (já filtrada).
 * @param {Layer[]} layers - A lista de camadas para determinar a visibilidade por tipo.
 * @param {(item: Equipment) => THREE.Object3D} createMeshFn - Função para criar um mesh de equipamento individual.
 *        Esta função é definida em ThreeScene e encapsula a lógica de geometria e coloração (via getEquipmentColor).
 * @param {React.MutableRefObject<THREE.Mesh | null>} groundMeshRef - Ref para o mesh do plano de chão, para controle de visibilidade.
 */
export function updateEquipmentMeshesInScene(
  scene: THREE.Scene,
  equipmentMeshesRef: React.MutableRefObject<THREE.Object3D[]>,
  newEquipmentData: Equipment[],
  layers: Layer[],
  createMeshFn: (item: Equipment) => THREE.Object3D,
  groundMeshRef: React.MutableRefObject<THREE.Mesh | null>
): void {
  // console.log('[SceneElementsSetup updateEquipmentMeshesInScene] Updating equipment meshes. New data count:', newEquipmentData.length);

  const currentMeshesByTag: Map<string, THREE.Object3D> = new Map();
  equipmentMeshesRef.current.forEach(mesh => {
    if (mesh.userData.tag) {
      currentMeshesByTag.set(mesh.userData.tag, mesh);
    }
  });

  const newVisibleMeshes: THREE.Object3D[] = [];
  const tagsInNewData = new Set(newEquipmentData.map(e => e.tag));

  // Remover meshes que não estão nos novos dados (já filtrados)
  equipmentMeshesRef.current.forEach(mesh => {
    if (!tagsInNewData.has(mesh.userData.tag)) {
      // console.log(`[SceneElementsSetup updateEquipmentMeshesInScene] Removing old mesh: ${mesh.userData.tag}`);
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

  // Adicionar ou atualizar meshes com base em newEquipmentData (que já está filtrada)
  newEquipmentData.forEach(item => {
    const layer = layers.find(l => l.equipmentType === item.type);
    const isVisibleByLayer = layer?.isVisible ?? true; // Assume visível se a camada não for encontrada (deve ser raro)

    let existingMesh = currentMeshesByTag.get(item.tag);

    if (!isVisibleByLayer) {
      if (existingMesh) {
        // console.log(`[SceneElementsSetup updateEquipmentMeshesInScene] Layer ${layer?.name} for ${item.tag} is not visible. Removing existing mesh.`);
        scene.remove(existingMesh);
        // Não adiciona à newVisibleMeshes
      }
      return; // Pula para o próximo item se a camada estiver oculta
    }

    // Se a camada está visível, o mesh deve existir ou ser criado.
    // Para garantir que a cor e a opacidade sejam atualizadas (especialmente após uma mudança de colorMode ou estado),
    // a abordagem mais simples e robusta é recriar o mesh.
    if (existingMesh) {
      // console.log(`[SceneElementsSetup updateEquipmentMeshesInScene] Removing and recreating mesh for ${item.tag} to update properties.`);
      scene.remove(existingMesh);
      if (existingMesh instanceof THREE.Mesh) {
        existingMesh.geometry?.dispose();
        if (Array.isArray(existingMesh.material)) existingMesh.material.forEach(m => m.dispose());
        else if (existingMesh.material) (existingMesh.material as THREE.Material).dispose();
      }
    }
    
    // console.log(`[SceneElementsSetup updateEquipmentMeshesInScene] Creating/Recreating mesh for ${item.tag}.`);
    const newOrUpdatedMesh = createMeshFn(item); // Usa a função passada para criar o mesh
    scene.add(newOrUpdatedMesh);
    newVisibleMeshes.push(newOrUpdatedMesh);
  });

  equipmentMeshesRef.current = newVisibleMeshes;
  // console.log('[SceneElementsSetup updateEquipmentMeshesInScene] Equipment meshes updated. Active mesh count:', newVisibleMeshes.length);

  // Gerenciar visibilidade do plano de chão
  const terrainLayer = layers.find(l => l.id === 'layer-terrain');
  if (terrainLayer && groundMeshRef.current) {
    const isGroundInScene = scene.children.some(child => child.uuid === groundMeshRef.current?.uuid);
    if (terrainLayer.isVisible && !isGroundInScene) {
      scene.add(groundMeshRef.current);
    } else if (!terrainLayer.isVisible && isGroundInScene) {
      scene.remove(groundMeshRef.current);
    }
  }
}
