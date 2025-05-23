/**
 * @fileOverview Utilitários para configurar e gerenciar o CSS2DRenderer
 * para exibir rótulos HTML sobrepostos à cena Three.js.
 *
 * Responsabilidades:
 * - Inicializar e configurar o CSS2DRenderer.
 * - Anexar o elemento DOM do renderizador ao contêiner apropriado.
 * - Fornecer uma função para atualizar o tamanho do renderizador de rótulos.
 */
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

/**
 * Configura o CSS2DRenderer para rótulos 2D.
 * @param {HTMLElement} containerElement O elemento DOM que conterá o renderizador de rótulos.
 * @param {number} initialWidth A largura inicial do canvas de rótulos.
 * @param {number} initialHeight A altura inicial do canvas de rótulos.
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
  labelRenderer.domElement.style.pointerEvents = 'none'; // Importante para não bloquear interações com a cena 3D
  containerElement.appendChild(labelRenderer.domElement);
  return labelRenderer;
}

/**
 * Atualiza o tamanho do CSS2DRenderer.
 * @param {CSS2DRenderer} labelRenderer A instância do CSS2DRenderer.
 * @param {number} width A nova largura.
 * @param {number} height A nova altura.
 */
export function updateLabelRendererSize(
  labelRenderer: CSS2DRenderer,
  width: number,
  height: number
): void {
  labelRenderer.setSize(width, height);
}
