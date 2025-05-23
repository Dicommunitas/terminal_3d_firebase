
/**
 * @fileOverview Fornece os dados iniciais para equipamentos e camadas da aplicação.
 * Estes dados são usados para popular o estado inicial da aplicação quando ela é carregada.
 * Define a estrutura de cada equipamento e as camadas de visibilidade padrão.
 *
 * Exporta:
 * - `initialEquipment`: Array de objetos `Equipment` representando os itens 3D na cena.
 * - `initialLayers`: Array de objetos `Layer` especificando as camadas de visibilidade.
 */
import type { Equipment, Layer } from '@/lib/types';

/**
 * Lista inicial de equipamentos para a cena 3D.
 * Cada equipamento possui propriedades como tag, nome, tipo, sistema, área, estado operacional,
 * produto, posição, dimensões (ou raio/altura), cor, detalhes e categoria.
 */
export const initialEquipment: Equipment[] = [
  // Buildings
  { tag: 'bldg-01', name: 'Main Office', type: 'Building', sistema: 'NDD', area: 'Área 20', operationalState: 'Não aplicável', product: 'Não aplicável', position: { x: -15, y: 3, z: -10 }, size: { width: 8, height: 6, depth: 10 }, color: '#78909C', details: 'Primary administrative building.' },
  { tag: 'bldg-02', name: 'Warehouse A', type: 'Building', sistema: 'GA', area: 'Área 31', operationalState: 'Não aplicável', product: 'Não aplicável', position: { x: 15, y: 4, z: -12 }, size: { width: 15, height: 8, depth: 12 }, color: '#78909C', details: 'Storage for dry goods.' },
  { tag: 'bldg-03', name: 'Control Room', type: 'Building', sistema: 'MTBE', area: 'Área 32', operationalState: 'Não aplicável', product: 'Não aplicável', position: { x: 0, y: 2, z: -15 }, size: { width: 6, height: 4, depth: 6 }, color: '#78909C', details: 'Central operations control.' },

  // Cranes
  { tag: 'crane-01', name: 'Gantry Crane 1', type: 'Crane', sistema: 'QAV', area: 'Área 40', operationalState: 'operando', product: "Não aplicável", position: { x: 0, y: 5, z: 8 }, size: { width: 12, height: 10, depth: 2 }, color: '#FF8A65', details: 'Heavy lift gantry crane.' },
  { tag: 'crane-02', name: 'Jib Crane', type: 'Crane', sistema: 'LASTRO', area: 'Área 50', operationalState: 'manutenção', product: "Não aplicável", position: { x: -10, y: 3.5, z: 5 }, size: { width: 1.5, height: 7, depth: 1.5 }, color: '#FFB74D', details: 'Small jib crane for workshop.' },

  // Tanks
  { tag: 'tank-01', name: 'Storage Tank Alpha', type: 'Tank', sistema: 'ODB', area: 'Área 33', operationalState: 'operando', product: '70H', position: { x: -8, y: 2.5, z: 12 }, radius: 3, height: 5, color: '#4FC3F7', details: 'Liquid storage tank for product 70H.' },
  { tag: 'tank-02', name: 'Storage Tank Beta', type: 'Tank', sistema: 'ESCUROS', area: 'Área 33', operationalState: 'não operando', product: '6DH', position: { x: -2, y: 2, z: 12 }, radius: 2.5, height: 4, color: '#4DD0E1', details: 'Auxiliary liquid storage for product 6DH.' },
  { tag: 'tank-03', name: 'Process Tank Gamma', type: 'Tank', sistema: 'NDD', area: 'Área 34', operationalState: 'em falha', product: '660', position: { x: 5, y: 3, z: 10 }, radius: 2, height: 6, color: '#4DB6AC', details: 'Processing tank for product 660.' },

  // Pipes
  { tag: 'pipe-01', name: 'Main Feed Pipe', type: 'Pipe', sistema: 'GA', area: 'Área 35', operationalState: 'operando', product: '70H', position: { x: -5, y: 1, z: 5 }, radius: 0.3, height: 10, color: '#B0BEC5', details: 'Connects Tank Alpha to Process Area.', rotation: { x: 0, y: 0, z: Math.PI / 2 } },
  { tag: 'pipe-02', name: 'Process Output Pipe', type: 'Pipe', sistema: 'MTBE', area: 'Área 34', operationalState: 'não operando', product: '660', position: { x: 0, y: 2.5, z: 9 }, radius: 0.2, height: 8, color: '#90A4AE', details: 'Carries product from Process Tank Gamma.', rotation: { x: Math.PI / 2, y: 0, z: 0 } },
  { tag: 'pipe-03', name: 'Vertical Riser', type: 'Pipe', sistema: 'QAV', area: 'Área 60', operationalState: 'manutenção', product: '198', position: { x: 8, y: 3.5, z: 8 }, radius: 0.25, height: 7, color: '#B0BEC5', details: 'Vertical pipe section for product 198.' },

  // Valves
  { tag: 'valve-01', name: 'Tank Alpha Outlet Valve', type: 'Valve', sistema: 'LASTRO', area: 'Área 33', operationalState: 'operando', product: '70H', position: { x: -8, y: 0.5, z: 8.8 }, radius: 0.4, color: '#EF5350', details: 'Controls flow from Tank Alpha.' },
  { tag: 'valve-02', name: 'Process Inlet Valve', type: 'Valve', sistema: 'ODB', area: 'Área 34', operationalState: 'manutenção', product: '70H', position: { x: -1, y: 2.5, z: 5 }, radius: 0.3, color: '#F44336', details: 'Controls input to Process Tank Gamma.' },
  { tag: 'valve-03', name: 'Safety Bypass Valve', type: 'Valve', sistema: 'ESCUROS', area: 'Área 60', operationalState: 'em falha', product: '198', position: { x: 8, y: 0.5, z: 4.5 }, radius: 0.3, color: '#E57373', details: 'Emergency bypass valve for product 198.' },
];

/**
 * Lista inicial de camadas para controle de visibilidade na interface.
 * Cada camada define um nome, o tipo de equipamento que ela controla (ou 'Annotations' para pins de anotação, 'Terrain' para o chão),
 * e seu estado de visibilidade inicial.
 */
export const initialLayers: Layer[] = [
  { id: 'layer-terrain', name: 'Terreno', equipmentType: 'Terrain', isVisible: true },
  { id: 'layer-buildings', name: 'Prédios', equipmentType: 'Building', isVisible: true },
  { id: 'layer-cranes', name: 'Guindastes', equipmentType: 'Crane', isVisible: true },
  { id: 'layer-tanks', name: 'Tanques', equipmentType: 'Tank', isVisible: true },
  { id: 'layer-pipes', name: 'Tubulações', equipmentType: 'Pipe', isVisible: true },
  { id: 'layer-valves', name: 'Válvulas', equipmentType: 'Valve', isVisible: true },
  { id: 'layer-annotations', name: 'Anotações', equipmentType: 'Annotations', isVisible: true },
];

    