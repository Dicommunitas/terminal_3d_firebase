/**
 * @fileOverview Fábrica para criar geometrias de equipamentos para a cena Three.js.
 *
 * Responsável por encapsular a lógica de criação de diferentes tipos de
 * THREE.BufferGeometry com base no tipo de equipamento fornecido.
 */
import * as THREE from 'three';
import type { Equipment } from '@/lib/types';

/**
 * Cria e retorna uma THREE.BufferGeometry apropriada para o tipo de equipamento.
 * @param {Equipment} item - O objeto de equipamento contendo tipo e dimensões.
 * @returns {THREE.BufferGeometry} A geometria criada.
 */
export function createGeometryForItem(item: Equipment): THREE.BufferGeometry {
  let geometry: THREE.BufferGeometry;

  switch (item.type) {
    case 'Building':
      geometry = new THREE.BoxGeometry(item.size?.width || 5, item.size?.height || 5, item.size?.depth || 5);
      break;
    case 'Crane':
      geometry = new THREE.BoxGeometry(item.size?.width || 3, item.size?.height || 10, item.size?.depth || 3);
      break;
    case 'Tank':
      geometry = new THREE.CylinderGeometry(item.radius || 2, item.radius || 2, item.height || 4, 32);
      break;
    case 'Pipe':
      // Para tubos, a 'altura' do cilindro representa o comprimento do tubo.
      geometry = new THREE.CylinderGeometry(item.radius || 0.2, item.radius || 0.2, item.height || 5, 16);
      break;
    case 'Valve':
      geometry = new THREE.SphereGeometry(item.radius || 0.3, 16, 16);
      break;
    default:
      // Geometria padrão para tipos desconhecidos ou não especificados
      console.warn(`[GeometryFactory] Tipo de equipamento desconhecido: ${item.type}. Usando esfera padrão.`);
      geometry = new THREE.SphereGeometry(1, 16, 16);
      break;
  }
  return geometry;
}
