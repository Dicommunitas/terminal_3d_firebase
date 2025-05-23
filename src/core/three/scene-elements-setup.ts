/**
 * @fileOverview Utilitários para configurar elementos básicos e o pipeline de renderização de uma cena Three.js.
 *
 * Responsabilidades:
 * - Configurar a iluminação padrão da cena.
 * - Configurar o plano de chão (terreno) da cena.
 * - Configurar os renderizadores (WebGL, CSS2D) e o EffectComposer para pós-processamento.
 * - Gerenciar a adição, remoção e atualização dos meshes dos equipamentos na cena.
 */
import * as THREE from 'three';
import type { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
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
 * Cria uma geometria de plano com um material de cor de areia e transparência.
 * @param {THREE.Scene} scene A instância da cena Three.js onde o plano será adicionado.
 * @returns {THREE.Mesh} O mesh do plano de chão criado.
 */
export function setupGroundPlane(scene: THREE.Scene): THREE.Mesh {
  const groundGeometry = new THREE.PlaneGeometry(100, 100);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0xE6D8B0, 
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
  mountElement.appendChild(renderer.domElement);

  // CSS2D Renderer para rótulos HTML
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(initialWidth, initialHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0px';
  labelRenderer.domElement.style.left = '0px';
  labelRenderer.domElement.style.pointerEvents = 'none'; // Importante para não bloquear interações com o canvas 3D
  mountElement.appendChild(labelRenderer.domElement);
  
  // EffectComposer e Passes para Pós-Processamento
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const outlinePass = new OutlinePass(new THREE.Vector2(initialWidth, initialHeight), scene, camera);
  outlinePass.edgeStrength = 3.0;
  outlinePass.edgeGlow = 0.0; // Desabilitado por padrão, pode ser ajustado dinamicamente
  outlinePass.edgeThickness = 1.0;
  outlinePass.visibleEdgeColor.set('#ffffff'); // Cor padrão, será sobrescrita
  outlinePass.hiddenEdgeColor.set('#190a05'); // Cor para bordas ocultas
  outlinePass.pulsePeriod = 0; // Desabilita pulsação por padrão
  composer.addPass(outlinePass);

  return { renderer, labelRenderer, composer, outlinePass };
}

/**
 * Atualiza a lista de meshes de equipamentos na cena com base nos novos dados.
 * Remove meshes antigos, atualiza existentes e adiciona novos.
 * @param {THREE.Scene} scene - A cena Three.js.
 * @param {React.MutableRefObject<THREE.Object3D[]>} equipmentMeshesRef - Ref para o array de meshes de equipamentos existentes.
 * @param {Equipment[]} newEquipmentData - A nova lista de equipamentos a serem renderizados.
 * @param {Layer[]} layers - A lista de camadas para determinar a visibilidade.
 * @param {ColorMode} colorMode - O modo de colorização atual.
 * @param {(item: Equipment) => THREE.Object3D} createSingleEquipmentMesh - Função para criar um mesh de equipamento individual.
 * @param {React.MutableRefObject<THREE.Mesh | null>} groundMeshRef - Ref para o mesh do plano de chão.
 */
export function updateEquipmentMeshesInScene(
  scene: THREE.Scene,
  equipmentMeshesRef: React.MutableRefObject<THREE.Object3D[]>,
  newEquipmentData: Equipment[],
  layers: Layer[],
  colorMode: ColorMode, // Necessário para a função createSingleEquipmentMesh se ela depende disso
  createSingleEquipmentMesh: (item: Equipment, colorMode: ColorMode) => THREE.Object3D,
  groundMeshRef: React.MutableRefObject<THREE.Mesh | null>
): void {
  const currentMeshesByTag: Map<string, THREE.Object3D> = new Map();
  equipmentMeshesRef.current.forEach(mesh => {
    if (mesh.userData.tag) {
      currentMeshesByTag.set(mesh.userData.tag, mesh);
    }
  });

  const newMeshes: THREE.Object3D[] = [];
  const tagsInNewData = new Set(newEquipmentData.map(e => e.tag));

  // Remover/dispor meshes que não estão nos novos dados
  equipmentMeshesRef.current.forEach(mesh => {
    if (!tagsInNewData.has(mesh.userData.tag)) {
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
      const existingMesh = currentMeshesByTag.get(item.tag);
      if (existingMesh) {
        scene.remove(existingMesh); // Remove da cena se a camada está oculta
        currentMeshesByTag.delete(item.tag); // Remove do mapa para não ser adicionado de volta
      }
      return; // Pula para o próximo item se a camada estiver oculta
    }

    let mesh = currentMeshesByTag.get(item.tag);
    if (mesh) { // Mesh existe, potencialmente atualizar material
      newMeshes.push(mesh); // Mantém o mesh
      // A atualização de material (cor, opacidade) é feita dentro de createSingleEquipmentMesh
      // ou poderia ser feita aqui se createSingleEquipmentMesh apenas retornasse geometria
      // Por simplicidade, vamos assumir que createSingleEquipmentMesh lida com isso
      // e que precisamos recriar/reatualizar se colorMode ou operationalState mudarem significativamente.
      // Para uma atualização completa, podemos remover e recriar:
      scene.remove(mesh);
      if (mesh instanceof THREE.Mesh) {
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
        else if (mesh.material) (mesh.material as THREE.Material).dispose();
      }
      const newMesh = createSingleEquipmentMesh(item, colorMode);
      scene.add(newMesh);
      newMeshes.push(newMesh);


    } else { // Mesh não existe, criar novo
      const newMesh = createSingleEquipmentMesh(item, colorMode);
      scene.add(newMesh);
      newMeshes.push(newMesh);
    }
  });

  equipmentMeshesRef.current = newMeshes;

  // Gerenciar visibilidade do plano de chão
  const terrainLayer = layers.find(l => l.id === 'layer-terrain');
  if (terrainLayer && groundMeshRef.current) {
    const isGroundInScene = scene.children.includes(groundMeshRef.current);
    if (terrainLayer.isVisible && !isGroundInScene) {
      scene.add(groundMeshRef.current);
    } else if (!terrainLayer.isVisible && isGroundInScene) {
      scene.remove(groundMeshRef.current);
    }
  }
}
