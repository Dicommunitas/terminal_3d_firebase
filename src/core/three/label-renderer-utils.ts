
/**
 * @fileOverview Utilitários para configurar e gerenciar o CSS2DRenderer
 * para exibir rótulos HTML (como os pins de anotação) sobrepostos à cena Three.js.
 *
 * Responsabilidades:
 * - Inicializar e configurar o `CSS2DRenderer`.
 * - Anexar o elemento DOM do renderizador de rótulos ao contêiner da cena apropriado.
 * - Fornecer uma função para atualizar o tamanho do renderizador de rótulos quando a janela/contêiner é redimensionada.
 */
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

/**
 * Configura o CSS2DRenderer para a exibição de rótulos 2D (HTML) na cena.
 * Cria uma instância do renderizador, define seu tamanho inicial, estiliza seu elemento DOM
 * para sobreposição correta e o anexa ao contêiner da cena.
 * @param {HTMLElement} containerElement O elemento DOM que conterá o renderizador de rótulos (geralmente o `mountRef.current`).
 * @param {number} initialWidth A largura inicial do canvas de rótulos, geralmente correspondendo à largura da cena.
 * @param {number} initialHeight A altura inicial do canvas de rótulos, geralmente correspondendo à altura da cena.
 * @returns {CSS2DRenderer} A instância configurada do CSS2DRenderer.
 */
export function setupLabelRenderer(
  containerElement: HTMLElement,
  initialWidth: number,
  initialHeight: number
): CSS2DRenderer {
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(initialWidth, initialHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0px';
  labelRenderer.domElement.style.left = '0px'; // Adicionado para garantir o alinhamento
  labelRenderer.domElement.style.pointerEvents = 'none'; // Importante para não bloquear interações com a cena 3D principal
  containerElement.appendChild(labelRenderer.domElement);
  return labelRenderer;
}

/**
 * Atualiza o tamanho do CSS2DRenderer.
 * Deve ser chamado quando o contêiner de renderização da cena é redimensionado.
 * @param {CSS2DRenderer} labelRenderer A instância do CSS2DRenderer a ser atualizada.
 * @param {number} width A nova largura para o renderizador de rótulos.
 * @param {number} height A nova altura para o renderizador de rótulos.
 */
export function updateLabelRendererSize(
  labelRenderer: CSS2DRenderer,
  width: number,
  height: number
): void {
  labelRenderer.setSize(width, height);
}
