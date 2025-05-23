
/**
 * @fileoverview Define as principais interfaces de tipo usadas em toda a aplicação Terminal 3D.
 * Estas estruturas de dados são cruciais para a consistência e tipagem do projeto,
 * descrevendo entidades como Equipamentos, Camadas, Estado da Câmera, Comandos e Anotações.
 *
 * Exporta:
 * - `Equipment`: Interface para os dados de um equipamento.
 * - `Layer`: Interface para as camadas de visibilidade.
 * - `CameraState`: Interface para o estado da câmera (posição e lookAt).
 * - `Command`: Interface para os comandos do sistema de Undo/Redo.
 * - `Annotation`: Interface para as anotações textuais dos equipamentos.
 * - `ColorMode`: Tipo para os modos de colorização disponíveis.
 */

/**
 * Representa um equipamento na cena 3D.
 * @interface Equipment
 * @property {string} tag - Identificador único do equipamento.
 * @property {string} name - Nome legível do equipamento.
 * @property {'Building' | 'Crane' | 'Tank' | 'Terrain' | 'Pipe' | 'Valve'} type - Tipo do equipamento.
 * @property {string} [sistema] - Sistema ao qual o equipamento pertence.
 * @property {string} [area] - Área onde o equipamento está localizado.
 * @property {string} [operationalState] - Estado operacional atual (e.g., 'operando', 'manutenção').
 * @property {string} [product] - Produto associado (e.g., "70H" ou "Não aplicável").
 * @property {{ x: number; y: number; z: number }} position - Coordenadas do centro geométrico.
 * @property {{ x: number; y: number; z: number }} [rotation] - Rotação em radianos (opcional).
 * @property {{ width: number; height: number; depth: number }} [size] - Dimensões para equipamentos tipo caixa.
 * @property {number} [radius] - Raio para equipamentos cilíndricos ou esféricos.
 * @property {number} [height] - Altura para equipamentos cilíndricos (comprimento para tubos).
 * @property {string} color - Cor base em formato hexadecimal (e.g., '#78909C').
 * @property {string} [details] - Detalhes textuais adicionais (opcional).
 */
export interface Equipment {
  tag: string;
  name: string;
  type: 'Building' | 'Crane' | 'Tank' | 'Terrain' | 'Pipe' | 'Valve';
  sistema?: string;
  area?: string;
  operationalState?: string;
  product?: string;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  size?: { width: number; height: number; depth: number };
  radius?: number;
  height?: number;
  color: string;
  details?: string;
}

/**
 * Representa uma camada de visualização na interface.
 * Controla a visibilidade de grupos de equipamentos ou outros elementos.
 * @interface Layer
 * @property {string} id - Identificador único da camada (e.g., 'layer-tanks').
 * @property {string} name - Nome legível da camada para exibição na UI.
 * @property {Equipment['type'] | 'All' | 'Annotations' | 'Terrain'} equipmentType - O tipo de elemento que esta camada controla.
 * @property {boolean} isVisible - Indica se a camada está atualmente visível.
 */
export interface Layer {
  id: string;
  name: string;
  equipmentType: Equipment['type'] | 'All' | 'Annotations' | 'Terrain';
  isVisible: boolean;
}

/**
 * Representa o estado da câmera 3D.
 * @interface CameraState
 * @property {{ x: number; y: number; z: number }} position - Posição da câmera.
 * @property {{ x: number; y: number; z: number }} lookAt - Ponto para o qual a câmera está direcionada.
 */
export interface CameraState {
  position: { x: number; y: number; z: number };
  lookAt: { x: number; y: number; z: number };
}

/**
 * Representa um comando executável e reversível para o sistema de Undo/Redo.
 * @interface Command
 * @property {string} id - Identificador único do comando.
 * @property {'CAMERA_MOVE' | 'LAYER_VISIBILITY' | 'EQUIPMENT_SELECT'} type - Tipo do comando.
 * @property {() => void} execute - Função para executar a ação do comando.
 * @property {() => void} undo - Função para reverter a ação do comando.
 * @property {string} description - Descrição textual do comando.
 */
export interface Command {
  id: string;
  type: 'CAMERA_MOVE' | 'LAYER_VISIBILITY' | 'EQUIPMENT_SELECT';
  execute: () => void;
  undo: () => void;
  description: string;
}

/**
 * Representa uma anotação textual associada a um equipamento.
 * Cada equipamento pode ter no máximo uma anotação.
 * @interface Annotation
 * @property {string} equipmentTag - A tag do equipamento ao qual a anotação está vinculada.
 * @property {string} text - O conteúdo textual da anotação.
 * @property {string} createdAt - Data e hora (ISO 8601) de criação/modificação.
 */
export interface Annotation {
  equipmentTag: string;
  text: string;
  createdAt: string;
}

/**
 * Define os modos de colorização disponíveis para os equipamentos na cena 3D.
 * - 'Equipamento': Usa a cor base do equipamento.
 * - 'Estado Operacional': Colore com base no estado operacional.
 * - 'Produto': Colore com base no produto associado.
 * @type ColorMode
 */
export type ColorMode = 'Produto' | 'Estado Operacional' | 'Equipamento';

    