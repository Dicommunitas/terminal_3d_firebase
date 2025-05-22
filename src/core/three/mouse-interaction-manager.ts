
/**
 * @fileoverview Gerencia interações do mouse dentro da cena Three.js.
 *
 * Responsabilidades:
 * - Processar eventos de clique do mouse para detectar seleção de equipamentos.
 * - Processar eventos de movimento do mouse para detectar equipamentos sob o cursor (hover).
 * - Utilizar raycasting para identificar os objetos 3D intersectados pelo ponteiro do mouse.
 * - Invocar callbacks fornecidos para notificar sobre seleções e hovers.
 */
import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

/**
 * Processa um evento de clique do mouse na cena para selecionar equipamento.
 * @param {MouseEvent} event O evento de clique do mouse.
 * @param {HTMLDivElement} mountRefCurrent O elemento DOM atual onde a cena está montada.
 * @param {THREE.PerspectiveCamera} camera A câmera de perspectiva da cena.
 * @param {THREE.Object3D[]} equipmentMeshes Array de meshes 3D representando os equipamentos visíveis.
 * @param {(tag: string | null, isMultiSelect: boolean) => void} onSelectEquipmentCallback Callback para lidar com a seleção de equipamento.
 */
export function processSceneClick(
  event: MouseEvent,
  mountRefCurrent: HTMLDivElement,
  camera: THREE.PerspectiveCamera,
  equipmentMeshes: THREE.Object3D[],
  onSelectEquipmentCallback: (tag: string | null, isMultiSelect: boolean) => void
): void {
  if (!mountRefCurrent || !camera) return;

  const rect = mountRefCurrent.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  // Considera apenas meshes visíveis para interseção
  const intersects = raycaster.intersectObjects(equipmentMeshes.filter(m => m.visible), true);

  const isMultiSelectModifierPressed = event.ctrlKey || event.metaKey;
  let tagToSelect: string | null = null;

  if (intersects.length > 0) {
    let selectedObject = intersects[0].object;
    // Percorre a hierarquia para encontrar o mesh pai com userData.tag,
    // pois o raycaster pode atingir um filho de um grupo.
    while (selectedObject.parent && !selectedObject.userData.tag) {
      if (selectedObject.parent instanceof THREE.Scene) break; 
      selectedObject = selectedObject.parent;
    }
    if (selectedObject.userData.tag) {
      tagToSelect = selectedObject.userData.tag as string;
    }
  }
  
  // console.log(`[MouseInteractionManager] Click processed. Tag: ${tagToSelect}, Multi: ${isMultiSelectModifierPressed}`);
  onSelectEquipmentCallback(tagToSelect, isMultiSelectModifierPressed);
}

/**
 * Processa um evento de movimento do mouse na cena para detectar equipamento em hover.
 * @param {MouseEvent} event O evento de movimento do mouse.
 * @param {HTMLDivElement} mountRefCurrent O elemento DOM atual onde a cena está montada.
 * @param {THREE.PerspectiveCamera} camera A câmera de perspectiva da cena.
 * @param {THREE.Object3D[]} equipmentMeshes Array de meshes 3D representando os equipamentos visíveis.
 * @param {(tag: string | null) => void} setHoveredEquipmentTagCallback Callback para definir a tag do equipamento em hover.
 * @param {string | null} currentHoveredTag A tag atualmente em hover, para evitar atualizações redundantes.
 */
export function processSceneMouseMove(
  event: MouseEvent,
  mountRefCurrent: HTMLDivElement,
  camera: THREE.PerspectiveCamera,
  equipmentMeshes: THREE.Object3D[],
  setHoveredEquipmentTagCallback: (tag: string | null) => void,
  currentHoveredTag: string | null 
): void {
  if (!mountRefCurrent || !camera) return;

  const rect = mountRefCurrent.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  // Considera apenas meshes visíveis para interseção
  const intersects = raycaster.intersectObjects(equipmentMeshes.filter(m => m.visible), true);

  let foundHoverTag: string | null = null;
  if (intersects.length > 0) {
    let hoveredObjectCandidate = intersects[0].object;
    while (hoveredObjectCandidate.parent && !hoveredObjectCandidate.userData.tag) {
      if (hoveredObjectCandidate.parent instanceof THREE.Scene) break;
      hoveredObjectCandidate = hoveredObjectCandidate.parent;
    }
    if (hoveredObjectCandidate.userData.tag) {
      foundHoverTag = hoveredObjectCandidate.userData.tag as string;
    }
  }

  // Atualiza o estado de hover apenas se o objeto em hover mudou,
  // para evitar re-renderizações desnecessárias.
  if (currentHoveredTag !== foundHoverTag) {
    // console.log(`[MouseInteractionManager] MouseMove processed. New Hover Tag: ${foundHoverTag}`);
    setHoveredEquipmentTagCallback(foundHoverTag);
  }
}
