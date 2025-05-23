
/**
 * @fileOverview Fábrica para criar geometrias de equipamentos para a cena Three.js.
 *
 * Responsabilidades:
 * - Encapsular a lógica de criação de diferentes tipos de `THREE.BufferGeometry`
 *   com base no tipo de equipamento (`item.type`) e suas dimensões (`item.size`, `item.radius`, `item.height`).
 * - Promover o Single Responsibility Principle, isolando a lógica de criação
 *   de geometrias do componente `ThreeScene` ou outras partes do sistema.
 * - Fornecer uma geometria padrão caso um tipo de equipamento desconhecido seja fornecido.
 */
import * as THREE from 'three';
import type { Equipment } from '@/lib/types';

/**
 * Cria e retorna uma `THREE.BufferGeometry` apropriada para o tipo de equipamento.
 * @param {Equipment} item - O objeto de equipamento contendo tipo e dimensões.
 * @returns {THREE.BufferGeometry} A geometria criada para o equipamento.
 * @throws {Error} Implicitamente, se as dimensões necessárias para um tipo não forem fornecidas
 *                 (embora o código tente usar padrões ou tratar `undefined` como 0).
 *                 Na prática, espera-se que os dados do equipamento sejam válidos.
 */
export function createGeometryForItem(item: Equipment): THREE.BufferGeometry {
  let geometry: THREE.BufferGeometry;

  switch (item.type) {
    case 'Building':
      geometry = new THREE.BoxGeometry(
        item.size?.width || 5, // Largura padrão 5 se não especificada
        item.size?.height || 5, // Altura padrão 5
        item.size?.depth || 5   // Profundidade padrão 5
      );
      break;
    case 'Crane':
      geometry = new THREE.BoxGeometry(
        item.size?.width || 3,
        item.size?.height || 10,
        item.size?.depth || 3
      );
      break;
    case 'Tank':
      geometry = new THREE.CylinderGeometry(
        item.radius || 2,    // Raio superior e inferior padrão 2
        item.radius || 2,
        item.height || 4,    // Altura padrão 4
        32                   // Segmentos radiais
      );
      break;
    case 'Pipe':
      // Para tubos, a 'altura' do cilindro representa o comprimento do tubo.
      geometry = new THREE.CylinderGeometry(
        item.radius || 0.2,
        item.radius || 0.2,
        item.height || 5,    // Comprimento padrão 5
        16                   // Segmentos radiais
      );
      break;
    case 'Valve':
      geometry = new THREE.SphereGeometry(
        item.radius || 0.3,  // Raio padrão 0.3
        16,                  // Segmentos de largura
        16                   // Segmentos de altura
      );
      break;
    default:
      // Geometria padrão para tipos desconhecidos ou não especificados.
      // Um cubo pequeno é usado como indicador visual de um item não mapeado.
      console.warn(`[GeometryFactory] Tipo de equipamento desconhecido: ${item.type}. Usando cubo padrão.`);
      geometry = new THREE.BoxGeometry(1, 1, 1);
      break;
  }
  return geometry;
}
