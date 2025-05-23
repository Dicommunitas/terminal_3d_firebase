
/**
 * @fileOverview Utilitários para cálculos e manipulações relacionados à câmera em cenas Three.js.
 *
 * Responsabilidade Principal:
 * - Calcular a posição e o ponto de observação ideais da câmera para enquadrar um conjunto de objetos 3D.
 *
 * Exporta:
 * - `calculateViewForMeshes`: Função para calcular a visão da câmera para um conjunto de meshes.
 */
import * as THREE from 'three';

/**
 * Calcula uma posição e um ponto de observação (lookAt) para a câmera
 * de forma a enquadrar um conjunto de meshes fornecidos.
 * Tenta encontrar uma posição que mostre todos os meshes de forma clara.
 *
 * @param {THREE.Object3D[]} meshes - Um array de meshes 3D a serem enquadrados.
 * @param {THREE.PerspectiveCamera} camera - A câmera de perspectiva da cena.
 * @returns {{ position: THREE.Vector3, lookAt: THREE.Vector3 } | null} Um objeto contendo a nova posição
 *          e o ponto de observação da câmera, ou null se não for possível calcular
 *          (e.g., nenhum mesh fornecido ou meshes sem geometria).
 */
export function calculateViewForMeshes(
  meshes: THREE.Object3D[],
  camera: THREE.PerspectiveCamera
): { position: THREE.Vector3; lookAt: THREE.Vector3 } | null {
  if (!meshes || meshes.length === 0) {
    return null;
  }

  const boundingBox = new THREE.Box3();
  meshes.forEach(mesh => {
    // Garante que o objeto seja um Mesh e tenha geometria antes de calcular o bounding box
    if (mesh instanceof THREE.Mesh && mesh.geometry) {
      mesh.updateMatrixWorld(true); // Garante que a matriz do mundo esteja atualizada
      const meshBox = new THREE.Box3().setFromObject(mesh);
      if (!meshBox.isEmpty()) { // Apenas une se a caixa não estiver vazia
        boundingBox.union(meshBox);
      }
    }
  });

  if (boundingBox.isEmpty()) {
    // console.warn("[CameraUtils] BoundingBox is empty for provided meshes. Cannot calculate view.");
    return null;
  }

  const center = new THREE.Vector3();
  boundingBox.getCenter(center);

  const size = new THREE.Vector3();
  boundingBox.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  let cameraDistance = maxDim / (2 * Math.tan(fov / 2));

  cameraDistance *= 1.5; // Fator de preenchimento
  cameraDistance = Math.max(cameraDistance, 5); // Distância mínima

  const newCamPos = new THREE.Vector3(
    center.x,
    center.y + Math.max(size.y * 0.5, maxDim * 0.3),
    center.z + cameraDistance
  );

  if (size.y < maxDim * 0.2) {
    newCamPos.y = center.y + cameraDistance * 0.5;
  }
  newCamPos.y = Math.max(newCamPos.y, center.y + 2);

  return {
    position: newCamPos,
    lookAt: center,
  };
}

    