
/**
 * @fileOverview Utilitários para configurar elementos básicos de uma cena Three.js.
 *
 * Responsabilidades:
 * - Configurar a iluminação padrão da cena (ambiente, hemisférica, direcional).
 * - Configurar o plano de chão (terreno) da cena.
 */
import * as THREE from 'three';

/**
 * Configura a iluminação padrão para a cena.
 * Adiciona uma AmbientLight, HemisphereLight e DirectionalLight.
 * @param {THREE.Scene} scene A instância da cena Three.js onde as luzes serão adicionadas.
 */
export function setupLighting(scene: THREE.Scene): void {
  // Luz ambiente para iluminar todos os objetos uniformemente
  const ambientLight = new THREE.AmbientLight(0xffffff, 2.0); // Intensidade aumentada
  scene.add(ambientLight);

  // Luz hemisférica para simular luz do céu e do chão
  const hemisphereLight = new THREE.HemisphereLight(0xADD8E6, 0x495436, 0.8); // SkyBlue, GroundGreenish
  scene.add(hemisphereLight);

  // Luz direcional para simular o sol e criar sombras (se habilitadas)
  const directionalLight = new THREE.DirectionalLight(0xffffff, 3.0); // Intensidade aumentada
  directionalLight.position.set(10, 15, 10);
  directionalLight.castShadow = false; // Sombras desabilitadas conforme solicitado anteriormente
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
    color: 0xE6D8B0, // Cor de areia pastel suave
    side: THREE.DoubleSide,
    metalness: 0.1,
    roughness: 0.8,
    transparent: true,
    opacity: 0.4, // Transparência aumentada
  });
  const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = 0; // Base do chão em y=0
  groundMesh.receiveShadow = false; // Sombras desabilitadas
  scene.add(groundMesh);
  return groundMesh;
}
