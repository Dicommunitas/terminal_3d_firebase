/**
 * @fileoverview Manages mouse interactions within the Three.js scene,
 * such as clicks and mouse movements for equipment selection and hover effects.
 */
import * as THREE from 'three';
import type { Equipment } from '@/lib/types'; // Ensure Equipment type is available if needed for userData typing

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

/**
 * Processes a mouse click event on the scene to select equipment.
 * @param {MouseEvent} event The mouse click event.
 * @param {HTMLDivElement} mountRefCurrent The current DOM element where the scene is mounted.
 * @param {THREE.PerspectiveCamera} camera The scene's perspective camera.
 * @param {THREE.Object3D[]} equipmentMeshes An array of 3D meshes representing the equipment.
 * @param {(tag: string | null, isMultiSelect: boolean) => void} onSelectEquipmentCallback Callback function to handle equipment selection.
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
  const intersects = raycaster.intersectObjects(equipmentMeshes.filter(m => m.visible), true);

  const isMultiSelectModifierPressed = event.ctrlKey || event.metaKey;
  let tagToSelect: string | null = null;

  if (intersects.length > 0) {
    let selectedObject = intersects[0].object;
    // Traverse up the hierarchy to find the parent mesh with userData.tag
    while (selectedObject.parent && !selectedObject.userData.tag) {
      if (selectedObject.parent instanceof THREE.Scene) break; // Stop if we reach the scene itself
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
 * Processes a mouse move event on the scene to detect hovered equipment.
 * @param {MouseEvent} event The mouse move event.
 * @param {HTMLDivElement} mountRefCurrent The current DOM element where the scene is mounted.
 * @param {THREE.PerspectiveCamera} camera The scene's perspective camera.
 * @param {THREE.Object3D[]} equipmentMeshes An array of 3D meshes representing the equipment.
 * @param {(tag: string | null) => void} setHoveredEquipmentTagCallback Callback function to set the hovered equipment tag.
 * @param {string | null} currentHoveredTag The currently hovered tag to avoid redundant updates.
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

  if (currentHoveredTag !== foundHoverTag) {
    // console.log(`[MouseInteractionManager] MouseMove processed. New Hover Tag: ${foundHoverTag}`);
    setHoveredEquipmentTagCallback(foundHoverTag);
  }
}
