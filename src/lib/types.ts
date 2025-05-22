
/**
 * @fileoverview Define as principais interfaces de tipo usadas em toda a aplicação Terminal 3D.
 * Estas estruturas de dados são cruciais para a consistência e tipagem do projeto.
 */

/**
 * Representa um equipamento na cena 3D.
 * @interface Equipment
 * @property {string} tag - Identificador único do equipamento (substitui o antigo 'id').
 * @property {string} name - Nome legível do equipamento.
 * @property {'Building' | 'Crane' | 'Tank' | 'Terrain' | 'Pipe' | 'Valve'} type - Tipo do equipamento.
 * @property {string} [sistema] - Sistema ao qual o equipamento pertence (anteriormente 'category').
 * @property {string} [area] - Área onde o equipamento está localizado.
 * @property {string} [operationalState] - Estado operacional atual do equipamento.
 * @property {string} [product] - Produto associado ao equipamento (e.g., código de produto).
 * @property {{ x: number; y: number; z: number }} position - Coordenadas da posição do equipamento.
 * @property {{ x: number; y: number; z: number }} [rotation] - Rotação do equipamento (opcional).
 * @property {{ width: number; height: number; depth: number }} [size] - Dimensões para equipamentos tipo caixa.
 * @property {number} [radius] - Raio para equipamentos cilíndricos ou esféricos.
 * @property {number} [height] - Altura para equipamentos cilíndricos (ou comprimento para tubos).
 * @property {string} color - Cor base do equipamento em formato hexadecimal.
 * @property {string} details - Detalhes textuais adicionais sobre o equipamento.
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
  details: string;
}

/**
 * Representa uma camada de visualização na interface.
 * Controla a visibilidade de grupos de equipamentos ou outros elementos.
 * @interface Layer
 * @property {string} id - Identificador único da camada.
 * @property {string} name - Nome legível da camada.
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
 * @property {{ x: number; y: number; z: number }} position - Posição da câmera no espaço 3D.
 * @property {{ x: number; y: number; z: number }} lookAt - Ponto para o qual a câmera está olhando.
 */
export interface CameraState {
  position: { x: number; y: number; z: number };
  lookAt: { x: number; y: number; z: number };
}

/**
 * Representa um comando executável e reversível para o sistema de Undo/Redo.
 * @interface Command
 * @property {string} id - Identificador único do comando.
 * @property {'CAMERA_MOVE' | 'LAYER_VISIBILITY' | 'EQUIPMENT_SELECT'} type - Tipo do comando, para categorização.
 * @property {() => void} execute - Função para executar a ação do comando.
 * @property {() => void} undo - Função para reverter a ação do comando.
 * @property {string} description - Descrição textual do comando, para logging ou UI.
 */
export interface Command {
  id: string;
  type: 'CAMERA_MOVE' | 'LAYER_VISIBILITY' | 'EQUIPMENT_SELECT'; // Adicionar 'ANNOTATION_CHANGE' se anotações forem incluídas no histórico
  execute: () => void;
  undo: () => void;
  description: string;
}

// PresetCameraView foi removido pois a funcionalidade mudou para focar em sistemas dinamicamente.

/**
 * Representa uma anotação textual associada a um equipamento.
 * @interface Annotation
 * @property {string} equipmentTag - A tag do equipamento ao qual a anotação está vinculada.
 * @property {string} text - O conteúdo textual da anotação.
 * @property {string} createdAt - A data e hora (string ISO) de quando a anotação foi criada ou última modificada.
 */
export interface Annotation {
  equipmentTag: string;
  text: string;
  createdAt: string; 
}

/**
 * Define os modos de colorização disponíveis para os equipamentos na cena 3D.
 * @type ColorMode
 */
export type ColorMode = 'Produto' | 'Estado Operacional' | 'Equipamento';
