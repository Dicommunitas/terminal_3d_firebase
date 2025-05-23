
/**
 * @fileOverview Utilitários para configurar e gerenciar o pipeline de pós-processamento
 * para a cena Three.js, especificamente o EffectComposer e o OutlinePass.
 * Responsável pelo setup inicial e pela atualização dinâmica do efeito de contorno.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';

/**
 * Define os objetos que devem ser contornados pelo OutlinePass.
 * @param {OutlinePass} outlinePass A instância do OutlinePass.
 * @param {THREE.Object3D[]} objectsToOutline Um array de objetos 3D a serem contornados.
 */
function setOutlinePassObjects(outlinePass: OutlinePass, objectsToOutline: THREE.Object3D[]): void {
  outlinePass.selectedObjects = objectsToOutline;
}

/**
 * Aplica um estilo visual específico ao OutlinePass.
 * Modifica parâmetros como cor da borda visível, força, espessura e brilho.
 * @param {OutlinePass} outlinePass A instância do OutlinePass.
 * @param {'selected' | 'hover' | 'none'} styleType O tipo de estilo a ser aplicado.
 */
function applyOutlinePassStyle(outlinePass: OutlinePass, styleType: 'selected' | 'hover' | 'none'): void {
  outlinePass.pulsePeriod = 0; // Garante que não haja pulsação indesejada

  switch (styleType) {
    case 'selected':
      // console.log('[applyOutlinePassStyle] Applying SELECTED style');
      outlinePass.visibleEdgeColor.set('#0000FF'); // Azul forte
      outlinePass.edgeStrength = 10.0; 
      outlinePass.edgeThickness = 2.0; 
      outlinePass.edgeGlow = 0.7; 
      break;
    case 'hover':
      // console.log('[applyOutlinePassStyle] Applying HOVER style');
      outlinePass.visibleEdgeColor.set('#87CEFA'); // LightSkyBlue
      outlinePass.edgeStrength = 7.0; 
      outlinePass.edgeThickness = 1.5; 
      outlinePass.edgeGlow = 0.5; 
      break;
    case 'none':
    default:
      // console.log('[applyOutlinePassStyle] Applying NONE style');
      outlinePass.edgeStrength = 0;
      outlinePass.edgeGlow = 0;
      outlinePass.edgeThickness = 0;
      break;
  }
}

/**
 * Configura o pipeline de pós-processamento, incluindo o EffectComposer e o OutlinePass.
 * Esta função é chamada uma vez durante o setup inicial da cena.
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
  outlinePass.edgeStrength = 0; // Inicialmente desligado
  outlinePass.edgeGlow = 0.0;
  outlinePass.edgeThickness = 1.0;
  outlinePass.visibleEdgeColor.set('#ffffff'); // Cor padrão, será sobrescrita
  outlinePass.hiddenEdgeColor.set('#190a05'); // Cor para bordas ocultas (geralmente não visível com força 0)
  outlinePass.pulsePeriod = 0; // Sem pulsação por padrão
  composer.addPass(outlinePass);

  return { composer, outlinePass };
}

/**
 * Atualiza o tamanho do EffectComposer e do OutlinePass.
 * Deve ser chamado quando o contêiner de renderização é redimensionado.
 * @param {EffectComposer | null} composer O EffectComposer a ser atualizado.
 * @param {OutlinePass | null} outlinePass O OutlinePass a ser atualizado.
 * @param {number} width A nova largura.
 * @param {number} height A nova altura.
 */
export function updatePostProcessingSize(
  composer: EffectComposer | null,
  outlinePass: OutlinePass | null,
  width: number,
  height: number
): void {
  if (composer) {
    composer.setSize(width, height);
  }
  if (outlinePass) {
    outlinePass.resolution.set(width, height);
  }
}

/**
 * Atualiza o efeito de contorno (OutlinePass) com base nos equipamentos selecionados e em hover.
 * Determina quais objetos contornar e qual estilo aplicar.
 * @param {OutlinePass | null} outlinePass A instância do OutlinePass.
 * @param {THREE.Object3D[]} allMeshes A lista de todos os meshes de equipamentos na cena.
 * @param {string[]} selectedTags As tags dos equipamentos atualmente selecionados.
 * @param {string | null} hoveredTag A tag do equipamento atualmente sob o cursor.
 */
export function updateOutlineEffect(
  outlinePass: OutlinePass | null,
  allMeshes: THREE.Object3D[],
  selectedTags: string[],
  hoveredTag: string | null
): void {
  if (!outlinePass) {
    // console.log('[updateOutlineEffect] OutlinePass is null, returning.');
    return;
  }

  const objectsToOutline: THREE.Object3D[] = [];
  const meshesToConsider = allMeshes.filter(mesh => mesh.visible);
  let styleType: 'selected' | 'hover' | 'none' = 'none';

  // console.log(`[updateOutlineEffect] Input: selectedTags=${JSON.stringify(selectedTags)}, hoveredTag=${hoveredTag}`);

  if (Array.isArray(selectedTags) && selectedTags.length > 0) {
    selectedTags.forEach(tag => {
      const selectedMesh = meshesToConsider.find(mesh => mesh.userData.tag === tag);
      if (selectedMesh) {
        objectsToOutline.push(selectedMesh);
        // console.log(`[updateOutlineEffect] Adding selected mesh to outline: ${tag}`);
      }
    });
    if (objectsToOutline.length > 0) {
      styleType = 'selected';
    }
  }

  // Adiciona o item em hover APENAS se ele não estiver já selecionado para o contorno principal
  // E se não houver seleção múltipla (pois o hover em um item não selecionado quando há outros selecionados
  // pode ser confuso se ambos tiverem auras).
  // Por simplicidade, o hover só se aplica se não houver seleção, ou se o hover for no item já selecionado.
  if (hoveredTag) {
    const isHoveredAlreadyInOutline = objectsToOutline.some(obj => obj.userData.tag === hoveredTag);
    if (!isHoveredAlreadyInOutline) {
        const hoveredMesh = meshesToConsider.find(mesh => mesh.userData.tag === hoveredTag);
        if (hoveredMesh) {
            objectsToOutline.push(hoveredMesh);
            // console.log(`[updateOutlineEffect] Adding hovered mesh to outline: ${hoveredTag}`);
            if (styleType !== 'selected') { // Só aplica estilo de hover se não for sobrepor o de seleção
                styleType = 'hover';
            }
        }
    } else if (styleType === 'selected') {
        // Se o item em hover já está selecionado, mantém o estilo de seleção.
    }
  }


  if (objectsToOutline.length === 0) {
    styleType = 'none';
  }
  
  // Se há seleção, o estilo de seleção prevalece mesmo que o mouse esteja sobre um deles.
  // Se não há seleção e há hover, aplica estilo de hover.
  // Senão, nenhum estilo.
  if (Array.isArray(selectedTags) && selectedTags.length > 0) {
    styleType = 'selected';
  } else if (hoveredTag && objectsToOutline.some(obj => obj.userData.tag === hoveredTag)) {
    styleType = 'hover';
  } else {
    styleType = 'none';
  }


  // console.log(`[updateOutlineEffect] Style: ${styleType}. Outlining: ${objectsToOutline.map(o => o.userData.tag).join(', ') || 'None'}`);
  
  setOutlinePassObjects(outlinePass, objectsToOutline);
  applyOutlinePassStyle(outlinePass, styleType);
  // console.log(`[updateOutlineEffect] OutlinePass strength: ${outlinePass.edgeStrength}`);
}
