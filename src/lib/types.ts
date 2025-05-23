
/**
 * @fileoverview Define as principais interfaces de tipo usadas em toda a aplicação Terminal 3D.
 * Estas estruturas de dados são cruciais para a consistência e tipagem do projeto,
 * descrevendo entidades como Equipamentos, Camadas, Estado da Câmera, Comandos e Anotações.
 */

/**
 * Representa um equipamento na cena 3D.
 * @interface Equipment
 * @property {string} tag - Identificador único do equipamento.
 * @property {string} name - Nome legível do equipamento.
 * @property {'Building' | 'Crane' | 'Tank' | 'Terrain' | 'Pipe' | 'Valve'} type - Tipo do equipamento.
 * @property {string} [sistema] - Sistema ao qual o equipamento pertence.
 * @property {string} [area] - Área onde o equipamento está localizado.
 * @property {string} [operationalState] - Estado operacional atual do equipamento (e.g., 'operando', 'manutenção').
 * @property {string} [product] - Produto associado ao equipamento (e.g., código de produto como "70H" ou "Não aplicável").
 * @property {{ x: number; y: number; z: number }} position - Coordenadas do centro geométrico do equipamento.
 * @property {{ x: number; y: number; z: number }} [rotation] - Rotação do equipamento em radianos (opcional).
 * @property {{ width: number; height: number; depth: number }} [size] - Dimensões para equipamentos tipo caixa (Building, Crane).
 * @property {number} [radius] - Raio para equipamentos cilíndricos ou esféricos (Tank, Pipe, Valve).
 * @property {number} [height] - Altura para equipamentos cilíndricos (Tank, Pipe - onde representa o comprimento).
 * @property {string} color - Cor base do equipamento em formato hexadecimal (e.g., '#78909C').
 * @property {string} [details] - Detalhes textuais adicionais sobre o equipamento (opcional).
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
 * Controla a visibilidade de grupos de equipamentos ou outros elementos como anotações e terreno.
 * @interface Layer
 * @property {string} id - Identificador único da camada (e.g., 'layer-tanks').
 * @property {string} name - Nome legível da camada para exibição na UI (e.g., 'Tanques').
 * @property {Equipment['type'] | 'All' | 'Annotations' | 'Terrain'} equipmentType - O tipo de elemento que esta camada controla.
 *        'All' pode ser usado para uma camada que afeta todos os equipamentos.
 *        'Annotations' controla a visibilidade dos pins de anotação.
 *        'Terrain' controla a visibilidade do plano de chão.
 * @property {boolean} isVisible - Indica se a camada está atualmente visível.
 */
export interface Layer {
  id: string;
  name: string;
  equipmentType: Equipment['type'] | 'All' | 'Annotations' | 'Terrain';
  isVisible: boolean;
}

/**
 * Representa o estado da câmera 3D, incluindo sua posição e o ponto para o qual ela está olhando.
 * @interface CameraState
 * @property {{ x: number; y: number; z: number }} position - Posição da câmera no espaço 3D.
 * @property {{ x: number; y: number; z: number }} lookAt - Ponto no espaço 3D para o qual a câmera está direcionada.
 */
export interface CameraState {
  position: { x: number; y: number; z: number };
  lookAt: { x: number; y: number; z: number };
}

/**
 * Representa um comando executável e reversível para o sistema de Undo/Redo.
 * @interface Command
 * @property {string} id - Identificador único do comando, geralmente incluindo um timestamp para unicidade.
 * @property {'CAMERA_MOVE' | 'LAYER_VISIBILITY' | 'EQUIPMENT_SELECT'} type - Tipo do comando, para categorização.
 * @property {() => void} execute - Função para executar a ação do comando.
 * @property {() => void} undo - Função para reverter a ação do comando.
 * @property {string} description - Descrição textual do comando, útil para logging ou UI de histórico.
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
 * @property {string} equipmentTag - A tag do equipamento ao qual a anotação está vinculada (chave estrangeira).
 * @property {string} text - O conteúdo textual da anotação.
 * @property {string} createdAt - A data e hora (string no formato ISO 8601) de quando a anotação foi criada ou última modificada.
 */
export interface Annotation {
  equipmentTag: string;
  text: string;
  createdAt: string; 
}

/**
 * Define os modos de colorização disponíveis para os equipamentos na cena 3D.
 * - 'Equipamento': Usa a cor base do equipamento.
 * - 'Estado Operacional': Colore com base no estado operacional do equipamento.
 * - 'Produto': Colore com base no produto associado ao equipamento.
 * @type ColorMode
 */
export type ColorMode = 'Produto' | 'Estado Operacional' | 'Equipamento';
