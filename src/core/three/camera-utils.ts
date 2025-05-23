/**
 * @fileOverview Utilitários para cálculos e manipulações relacionados à câmera em cenas Three.js.
 *
 * Responsabilidades:
 * - Calcular a posição e o ponto de observação ideais da câmera para enquadrar um conjunto de objetos.
 */
import * as THREE from 'three';

/**
 * Calcula uma posição e um ponto de observação (lookAt) para a câmera
 * de forma a enquadrar um conjunto de meshes fornecidos.
 *
 * @param {THREE.Object3D[]} meshes - Um array de meshes 3D a serem enquadrados.
 * @param {THREE.PerspectiveCamera} camera - A câmera de perspectiva da cena.
 * @returns {{ position: THREE.Vector3, lookAt: THREE.Vector3 } | null} Um objeto contendo a nova posição e o ponto de observação da câmera, ou null se não for possível calcular (e.g., nenhum mesh fornecido).
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
    if ((mesh as THREE.Mesh).geometry) { // Garante que é um mesh com geometria
      mesh.updateMatrixWorld(true); // Garante que a matriz do mundo esteja atualizada
      const meshBox = new THREE.Box3().setFromObject(mesh);
      boundingBox.union(meshBox);
    }
  });

  if (boundingBox.isEmpty()) {
    return null;
  }

  const center = new THREE.Vector3();
  boundingBox.getCenter(center);

  const size = new THREE.Vector3();
  boundingBox.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180);
  let cameraDistance = maxDim / (2 * Math.tan(fov / 2));

  // Adiciona um fator de preenchimento para não ficar muito colado
  cameraDistance *= 1.5;
  // Garante uma distância mínima
  cameraDistance = Math.max(cameraDistance, 5);


  // Posição da câmera um pouco acima e atrás, olhando para o centro
  // Tenta uma posição diagonal para melhor visualização, mas ajusta se o objeto for muito plano
  const newCamPos = new THREE.Vector3(
    center.x,
    center.y + Math.max(size.y * 0.5, maxDim * 0.3), // Eleva um pouco baseado na altura ou dimensão máxima
    center.z + cameraDistance // Afasta baseado na distância calculada
  );

  // Uma heurística simples para objetos predominantemente planos no eixo Y (como o chão ou um sistema muito espalhado)
  // para evitar que a câmera fique muito "de cima".
  if (size.y < maxDim * 0.2) { // Se a altura é significativamente menor que a maior dimensão
    newCamPos.y = center.y + cameraDistance * 0.5; // Posiciona a câmera mais alto para uma vista angular
  }
  newCamPos.y = Math.max(newCamPos.y, center.y + 2); // Garante uma altura mínima da câmera em relação ao centro do objeto

  return {
    position: newCamPos,
    lookAt: center,
  };
}
