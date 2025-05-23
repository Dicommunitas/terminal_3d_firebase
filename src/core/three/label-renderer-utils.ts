
/**
 * @fileOverview Utilitários para configurar e gerenciar o CSS2DRenderer
 * para exibir rótulos HTML (como os pins de anotação) sobrepostos à cena Three.js.
 *
 * Responsabilidades:
 * - Configurar o `CSS2DRenderer`.
 * - Anexar o elemento DOM do renderizador de rótulos ao contêiner da cena.
 * - Fornecer uma função para atualizar o tamanho do renderizador de rótulos.
 * - Gerenciar a criação, atualização e remoção dos pins de anotação (CSS2DObjects).
 */
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Annotation, Equipment, Layer } from '@/lib/types';

// Não mais exportamos setupLabelRenderer diretamente, pois ele é chamado por setupRenderPipeline
// export function setupLabelRenderer ...

/**
 * Atualiza o tamanho do CSS2DRenderer.
 * Deve ser chamado quando o contêiner de renderização da cena é redimensionado.
 * @param {CSS2DRenderer | null} labelRenderer A instância do CSS2DRenderer a ser atualizada.
 * @param {number} width A nova largura para o renderizador de rótulos.
 * @param {number} height A nova altura para o renderizador de rótulos.
 */
export function updateLabelRendererSize(
  labelRenderer: CSS2DRenderer | null,
  width: number,
  height: number
): void {
  if (labelRenderer) {
    labelRenderer.setSize(width, height);
  }
}

/**
 * Parâmetros para a função `updateAnnotationPins`.
 * @interface UpdateAnnotationPinsParams
 * @property {THREE.Scene | null} scene A cena Three.js.
 * @property {CSS2DRenderer | null} labelRenderer O renderizador CSS2D.
 * @property {Annotation[]} annotations A lista de anotações.
 * @property {Equipment[]} equipmentData A lista completa de equipamentos (para encontrar posições e dimensões).
 * @property {Layer[]} layers A lista de camadas (para verificar visibilidade da camada de anotações).
 * @property {React.MutableRefObject<CSS2DObject[]>} existingPinsRef Ref para o array de objetos CSS2DObject existentes (pins).
 */
interface UpdateAnnotationPinsParams {
  scene: THREE.Scene | null;
  labelRenderer: CSS2DRenderer | null;
  annotations: Annotation[];
  equipmentData: Equipment[];
  layers: Layer[];
  existingPinsRef: React.MutableRefObject<CSS2DObject[]>;
}

/**
 * Atualiza os pins de anotação visíveis na cena 3D.
 * Remove pins antigos e cria/atualiza novos com base nos dados atuais e na visibilidade da camada de anotações.
 * Cada pin é um ícone SVG amarelo posicionado acima do equipamento correspondente.
 * @param {UpdateAnnotationPinsParams} params Parâmetros para atualizar os pins.
 */
export function updateAnnotationPins({
  scene,
  labelRenderer,
  annotations,
  equipmentData,
  layers,
  existingPinsRef,
}: UpdateAnnotationPinsParams): void {
  if (!scene || !labelRenderer || !Array.isArray(annotations) || !Array.isArray(equipmentData) || !Array.isArray(layers)) {
    // console.log('[updateAnnotationPins] Skipping due to missing refs or invalid data.');
    return;
  }

  // Limpa pins de anotação antigos da cena e do DOM
  existingPinsRef.current.forEach(pinObj => {
    scene.remove(pinObj); 
    if (pinObj.element.parentNode) { 
      pinObj.element.parentNode.removeChild(pinObj.element);
    }
  });
  existingPinsRef.current = []; 

  const annotationsLayer = layers.find(l => l.id === 'layer-annotations');
  const areAnnotationsVisibleByLayer = annotationsLayer?.isVisible ?? true;

  labelRenderer.domElement.style.display = areAnnotationsVisibleByLayer ? '' : 'none';

  if (areAnnotationsVisibleByLayer) {
    annotations.forEach(anno => {
      const equipmentForItem = equipmentData.find(e => e.tag === anno.equipmentTag);
      if (equipmentForItem) {
        const pinDiv = document.createElement('div');
        pinDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#FFD700" style="opacity: 0.9; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5));"><path d="M12 2C8.13 2 5 5.13 5 9c0 4.17 4.42 9.92 6.24 12.11.4.48 1.13.48 1.53 0C14.58 18.92 19 13.17 19 9c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>`;
        pinDiv.style.pointerEvents = 'none'; 
        pinDiv.style.width = '24px';
        pinDiv.style.height = '24px';

        const pinLabel = new CSS2DObject(pinDiv);

        let yOffset = 0;
        const defaultSize = { width: 1, height: 1, depth: 1 }; 
        const itemSize = equipmentForItem.size || defaultSize;
        const itemHeight = equipmentForItem.height !== undefined ? equipmentForItem.height : itemSize.height;

        if (equipmentForItem.type === 'Tank' || equipmentForItem.type === 'Pipe' || equipmentForItem.type === 'Crane') {
          yOffset = (itemHeight || 0) / 2 + 0.8; 
        } else if (equipmentForItem.type === 'Valve' || equipmentForItem.type === 'Building' ) {
            yOffset = (itemSize.height || equipmentForItem.radius || 0.3) /2 + 0.8;
        } else {
           yOffset = (itemSize.height || 0.5) + 0.8;
        }
        pinLabel.position.set(equipmentForItem.position.x, equipmentForItem.position.y + yOffset, equipmentForItem.position.z);

        scene.add(pinLabel);
        existingPinsRef.current.push(pinLabel);
      }
    });
  }
}
