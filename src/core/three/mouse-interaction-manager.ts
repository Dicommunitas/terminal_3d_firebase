
/**
 * @fileoverview Gerencia interações do mouse dentro da cena Three.js para seleção e hover de equipamentos.
 *
 * Responsabilidades:
 * - Processar eventos de clique do mouse para detectar seleção de equipamentos (single e multi-select).
 * - Processar eventos de movimento do mouse para detectar equipamentos sob o cursor (hover).
 * - Utilizar raycasting para identificar os objetos 3D intersectados pelo ponteiro do mouse.
 * - Invocar callbacks fornecidos (`onSelectEquipment` e `setHoveredEquipmentTag`) para notificar
 *   o componente `ThreeScene` sobre as interações detectadas.
 *
 * Exporta:
 * - `processSceneClick`: Função para processar cliques na cena.
 * - `processSceneMouseMove`: Função para processar movimentos do mouse na cena.
 */
import * as THREE from 'three';

// Instâncias reutilizáveis para raycasting para otimizar performance.
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

/**
 * Processa um evento de clique do mouse na cena para selecionar equipamento.
 * Realiza raycasting para identificar o equipamento clicado e chama o callback `onSelectEquipmentCallback`.
 *
 * @param {MouseEvent} event O evento de clique do mouse.
 * @param {HTMLDivElement} mountRefCurrent O elemento DOM atual onde a cena está montada.
 * @param {THREE.PerspectiveCamera} camera A câmera de perspectiva da cena.
 * @param {THREE.Object3D[]} equipmentMeshes Array de meshes 3D representando os equipamentos visíveis.
 * @param {(tag: string | null, isMultiSelect: boolean) => void} onSelectEquipmentCallback Callback a ser chamado
 *        com a tag do equipamento selecionado (ou null) e um booleano para seleção múltipla.
 */
export function processSceneClick(
  event: MouseEvent,
  mountRefCurrent: HTMLDivElement,
  camera: THREE.PerspectiveCamera,
  equipmentMeshes: THREE.Object3D[],
  onSelectEquipmentCallback: (tag: string | null, isMultiSelect: boolean) => void
): void {
  if (!mountRefCurrent || !camera) {
    // console.warn("[MouseInteraction] processSceneClick: Mount or camera ref not available.");
    return;
  }

  const rect = mountRefCurrent.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(equipmentMeshes.filter(m => m.visible), true);

  const isMultiSelectModifierPressed = event.ctrlKey || event.metaKey;
  let tagToSelect: string | null = null;

  if (intersects.length > 0) {
    let selectedObject = intersects[0].object;
    while (selectedObject.parent && !selectedObject.userData.tag) {
      if (selectedObject.parent instanceof THREE.Scene) break;
      selectedObject = selectedObject.parent;
    }
    if (selectedObject.userData.tag) {
      tagToSelect = selectedObject.userData.tag as string;
    }
  }

  // console.log(`[MouseInteraction] Click processed. Tag: ${tagToSelect}, Multi: ${isMultiSelectModifierPressed}`);
  if (typeof onSelectEquipmentCallback === 'function') {
    onSelectEquipmentCallback(tagToSelect, isMultiSelectModifierPressed);
  } else {
    // console.error("[MouseInteraction] onSelectEquipmentCallback is not a function.");
  }
}

/**
 * Processa um evento de movimento do mouse na cena para detectar equipamento em hover.
 * Realiza raycasting para identificar o equipamento sob o cursor e chama o callback `setHoveredEquipmentTagCallback`.
 *
 * @param {MouseEvent} event O evento de movimento do mouse.
 * @param {HTMLDivElement} mountRefCurrent O elemento DOM atual onde a cena está montada.
 * @param {THREE.PerspectiveCamera} camera A câmera de perspectiva da cena.
 * @param {THREE.Object3D[]} equipmentMeshes Array de meshes 3D representando os equipamentos visíveis.
 * @param {(tag: string | null) => void} setHoveredEquipmentTagCallback Callback para definir a tag do equipamento em hover.
 */
export function processSceneMouseMove(
  event: MouseEvent,
  mountRefCurrent: HTMLDivElement,
  camera: THREE.PerspectiveCamera,
  equipmentMeshes: THREE.Object3D[],
  setHoveredEquipmentTagCallback: (tag: string | null) => void
): void {
  if (!mountRefCurrent || !camera) {
    // console.warn("[MouseInteraction] processSceneMouseMove: Mount or camera ref not available.");
    return;
  }

  const rect = mountRefCurrent.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
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

  if (typeof setHoveredEquipmentTagCallback === 'function') {
    setHoveredEquipmentTagCallback(foundHoverTag);
  } else {
    // console.error("[MouseInteraction] setHoveredEquipmentTagCallback is not a function.");
  }
}

    