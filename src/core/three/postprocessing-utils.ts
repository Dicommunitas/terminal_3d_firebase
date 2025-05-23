
/**
 * @fileOverview Utilitários para configurar e gerenciar o pipeline de pós-processamento
 * para a cena Three.js, especificamente o EffectComposer e o OutlinePass.
 *
 * Responsabilidades:
 * - Inicializar o EffectComposer com o renderizador principal.
 * - Configurar o RenderPass (passo de renderização base da cena).
 * - Configurar o OutlinePass (para efeitos de contorno/aura), incluindo seus parâmetros iniciais.
 * - Fornecer uma função para atualizar o tamanho do composer e do outline pass quando a janela é redimensionada.
 * - Fornecer uma função para definir os objetos que devem ser contornados pelo OutlinePass.
 * - Fornecer uma função para aplicar estilos visuais específicos ao OutlinePass (e.g., para seleção ou hover).
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';

/**
 * Configura o pipeline de pós-processamento, incluindo o EffectComposer e o OutlinePass.
 * @param {THREE.WebGLRenderer} renderer O renderizador WebGL principal.
 * @param {THREE.Scene} scene A cena 3D.
 * @param {THREE.PerspectiveCamera} camera A câmera da cena.
 * @param {number} initialWidth A largura inicial do canvas de renderização.
 * @param {number} initialHeight A altura inicial do canvas de renderização.
 * @returns {{ composer: EffectComposer, outlinePass: OutlinePass }} Um objeto contendo o EffectComposer e o OutlinePass configurados.
 */
export function setupPostProcessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  initialWidth: number,
  initialHeight: number
): { composer: EffectComposer, outlinePass: OutlinePass } {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const outlinePass = new OutlinePass(new THREE.Vector2(initialWidth, initialHeight), scene, camera);
  // Parâmetros iniciais do OutlinePass - podem ser ajustados dinamicamente depois
  outlinePass.edgeStrength = 0; // Começa desabilitado
  outlinePass.edgeGlow = 0.0;
  outlinePass.edgeThickness = 1.0;
  outlinePass.visibleEdgeColor.set('#ffffff'); // Cor padrão, será sobrescrita
  outlinePass.hiddenEdgeColor.set('#190a05');  // Cor para bordas ocultas (geralmente não muito visível com edgeGlow)
  outlinePass.pulsePeriod = 0; // Desabilita a pulsação padrão
  composer.addPass(outlinePass);

  return { composer, outlinePass };
}

/**
 * Atualiza o tamanho do EffectComposer e do OutlinePass.
 * Deve ser chamado quando o contêiner de renderização é redimensionado.
 * @param {EffectComposer} composer O EffectComposer a ser atualizado.
 * @param {OutlinePass} outlinePass O OutlinePass a ser atualizado.
 * @param {number} width A nova largura.
 * @param {number} height A nova altura.
 */
export function updatePostProcessingSize(
  composer: EffectComposer,
  outlinePass: OutlinePass,
  width: number,
  height: number
): void {
  composer.setSize(width, height);
  outlinePass.resolution.set(width, height);
}

/**
 * Define os objetos que devem ser contornados pelo OutlinePass.
 * @param {OutlinePass} outlinePass A instância do OutlinePass.
 * @param {THREE.Object3D[]} objectsToOutline Um array de objetos 3D a serem contornados.
 *        Se vazio, nenhum objeto será contornado.
 */
export function setOutlinePassObjects(outlinePass: OutlinePass, objectsToOutline: THREE.Object3D[]): void {
  outlinePass.selectedObjects = objectsToOutline;
}

/**
 * Aplica um estilo visual específico ao OutlinePass.
 * Modifica parâmetros como cor da borda visível, força, espessura e brilho.
 * @param {OutlinePass} outlinePass A instância do OutlinePass.
 * @param {'selected' | 'hover' | 'none'} styleType O tipo de estilo a ser aplicado:
 *        - 'selected': Para equipamentos selecionados (aura azul mais forte).
 *        - 'hover': Para equipamentos sob o cursor (aura azul mais clara).
 *        - 'none': Desabilita o contorno (força da borda = 0).
 */
export function applyOutlinePassStyle(outlinePass: OutlinePass, styleType: 'selected' | 'hover' | 'none'): void {
  outlinePass.pulsePeriod = 0; // Garante que não haja pulsação indesejada

  switch (styleType) {
    case 'selected':
      outlinePass.visibleEdgeColor.set('#0000FF'); // Azul forte
      outlinePass.edgeStrength = 10.0; // Aumentado para mais visibilidade
      outlinePass.edgeThickness = 2.0; // Aumentado
      outlinePass.edgeGlow = 0.7;
      // console.log('[PostProcessingUtils] Style: SELECTED applied.');
      break;
    case 'hover':
      outlinePass.visibleEdgeColor.set('#87CEFA'); // LightSkyBlue
      outlinePass.edgeStrength = 7.0; // Aumentado
      outlinePass.edgeThickness = 1.5; // Aumentado
      outlinePass.edgeGlow = 0.5;
      // console.log('[PostProcessingUtils] Style: HOVER applied.');
      break;
    case 'none':
    default:
      outlinePass.edgeStrength = 0; // Desabilita o contorno
      outlinePass.edgeGlow = 0;
      outlinePass.edgeThickness = 0;
      // console.log('[PostProcessingUtils] Style: NONE applied.');
      break;
  }
}
