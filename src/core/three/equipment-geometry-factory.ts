
/**
 * @fileOverview Fábrica para criar geometrias de equipamentos para a cena Three.js.
 *
 * Responsabilidade Principal:
 * - Encapsular a lógica de criação de diferentes tipos de `THREE.BufferGeometry`
 *   com base no tipo de equipamento (`item.type`) e suas dimensões (`item.size`, `item.radius`, `item.height`).
 * - Promover o Single Responsibility Principle, isolando a lógica de criação
 *   de geometrias do componente `ThreeScene` ou outras partes do sistema.
 * - Fornecer uma geometria padrão caso um tipo de equipamento desconhecido seja fornecido.
 *
 * Exporta:
 * - `createGeometryForItem`: Função para criar a geometria apropriada para um equipamento.
 */
import * as THREE from 'three';
import type { Equipment } from '@/lib/types';

/**
 * Cria e retorna uma `THREE.BufferGeometry` apropriada para o tipo de equipamento.
 * Seleciona a geometria correta (Box, Cylinder, Sphere) com base no `item.type`
 * e utiliza as dimensões fornecidas no objeto `item`.
 * @param {Equipment} item - O objeto de equipamento contendo tipo e dimensões.
 * @returns {THREE.BufferGeometry} A geometria criada para o equipamento.
 *                                  Retorna um `BoxGeometry(1,1,1)` para tipos desconhecidos.
 */
export function createGeometryForItem(item: Equipment): THREE.BufferGeometry {
  let geometry: THREE.BufferGeometry;

  switch (item.type) {
    case 'Building':
      geometry = new THREE.BoxGeometry(
        item.size?.width || 5,
        item.size?.height || 5,
        item.size?.depth || 5
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
        item.radius || 2,
        item.radius || 2,
        item.height || 4,
        32 // Segmentos radiais
      );
      break;
    case 'Pipe':
      geometry = new THREE.CylinderGeometry(
        item.radius || 0.2,
        item.radius || 0.2,
        item.height || 5, // Comprimento do tubo
        16 // Segmentos radiais
      );
      break;
    case 'Valve':
      geometry = new THREE.SphereGeometry(
        item.radius || 0.3,
        16, // Segmentos de largura
        16  // Segmentos de altura
      );
      break;
    default:
      console.warn(`[GeometryFactory] Tipo de equipamento desconhecido: ${item.type}. Usando cubo padrão.`);
      geometry = new THREE.BoxGeometry(1, 1, 1);
      break;
  }
  return geometry;
}

    