
/**
 * @fileoverview Componente responsável por renderizar a área principal da cena 3D,
 * que inclui o componente `ThreeScene` (a própria cena 3D) e o `InfoPanel` (painel de detalhes).
 * Este componente atua como um contêiner para os elementos visuais centrais da aplicação.
 */
"use client";

import type { Equipment, Layer, CameraState, Annotation, ColorMode } from '@/lib/types';
import ThreeScene from '@/components/three-scene';
import { InfoPanel } from '@/components/info-panel';

/**
 * Props para o componente MainSceneArea.
 * @interface MainSceneAreaProps
 * @property {Equipment[]} equipment - Lista de equipamentos filtrados a serem renderizados na cena.
 * @property {Layer[]} layers - Configuração das camadas de visibilidade.
 * @property {Annotation[]} annotations - Lista de anotações a serem exibidas.
 * @property {string[]} selectedEquipmentTags - Tags dos equipamentos atualmente selecionados.
 * @property {(tag: string | null, isMultiSelect: boolean) => void} onSelectEquipment - Callback para quando um equipamento é selecionado/deselecionado.
 * @property {string | null} hoveredEquipmentTag - Tag do equipamento atualmente sob o cursor.
 * @property {(tag: string | null) => void} setHoveredEquipmentTag - Callback para definir o equipamento em hover.
 * @property {CameraState | undefined} cameraState - O estado atual da câmera (posição, lookAt).
 * @property {(cameraState: CameraState) => void} onCameraChange - Callback para quando o estado da câmera muda devido à interação do usuário na cena.
 * @property {{ x: number; y: number; z: number }} initialCameraPosition - Posição inicial da câmera.
 * @property {{ x: number; y: number; z: number }} initialCameraLookAt - Ponto de observação (lookAt) inicial da câmera.
 * @property {ColorMode} colorMode - O modo de colorização atual para os equipamentos.
 * @property {string | null} targetSystemToFrame - O sistema que deve ser enquadrado pela câmera (se houver).
 * @property {() => void} onSystemFramed - Callback chamado após a câmera terminar de enquadrar um sistema.
 * @property {Equipment | null} selectedEquipmentDetails - Detalhes do equipamento único selecionado (para InfoPanel).
 * @property {Annotation | null} equipmentAnnotation - Anotação do equipamento único selecionado (para InfoPanel).
 * @property {() => void} onOpenAnnotationDialog - Callback para abrir o diálogo de anotação.
 * @property {(equipmentTag: string) => void} onDeleteAnnotation - Callback para excluir uma anotação.
 * @property {(equipmentTag: string, newState: string) => void} onOperationalStateChange - Callback para alterar o estado operacional de um equipamento.
 * @property {string[]} availableOperationalStatesList - Lista de estados operacionais disponíveis.
 * @property {(equipmentTag: string, newProduct: string) => void} onProductChange - Callback para alterar o produto de um equipamento.
 * @property {string[]} availableProductsList - Lista de produtos disponíveis.
 */
interface MainSceneAreaProps {
  equipment: Equipment[];
  layers: Layer[];
  annotations: Annotation[];
  selectedEquipmentTags: string[];
  onSelectEquipment: (tag: string | null, isMultiSelect: boolean) => void;
  hoveredEquipmentTag: string | null;
  setHoveredEquipmentTag: (tag: string | null) => void;
  cameraState: CameraState | undefined;
  onCameraChange: (cameraState: CameraState) => void;
  initialCameraPosition: { x: number; y: number; z: number };
  initialCameraLookAt: { x: number; y: number; z: number };
  colorMode: ColorMode;
  targetSystemToFrame: string | null;
  onSystemFramed: () => void;
  selectedEquipmentDetails: Equipment | null;
  equipmentAnnotation: Annotation | null;
  onOpenAnnotationDialog: () => void;
  onDeleteAnnotation: (equipmentTag: string) => void;
  onOperationalStateChange: (equipmentTag: string, newState: string) => void;
  availableOperationalStatesList: string[];
  onProductChange: (equipmentTag: string, newProduct: string) => void;
  availableProductsList: string[];
}

/**
 * Renderiza a área principal da cena 3D e o InfoPanel sobreposto.
 * Passa todas as props necessárias para os componentes filhos `ThreeScene` e `InfoPanel`.
 * @param {MainSceneAreaProps} props As props do componente.
 * @returns {JSX.Element} O componente MainSceneArea.
 */
export function MainSceneArea({
  equipment,
  layers,
  annotations,
  selectedEquipmentTags,
  onSelectEquipment,
  hoveredEquipmentTag,
  setHoveredEquipmentTag,
  cameraState,
  onCameraChange,
  initialCameraPosition,
  initialCameraLookAt,
  colorMode,
  targetSystemToFrame,
  onSystemFramed,
  selectedEquipmentDetails,
  equipmentAnnotation,
  onOpenAnnotationDialog,
  onDeleteAnnotation,
  onOperationalStateChange,
  availableOperationalStatesList,
  onProductChange,
  availableProductsList,
}: MainSceneAreaProps): JSX.Element {
  return (
    <div className="flex-1 relative w-full bg-muted/20 min-w-0"> {/* min-w-0 é importante para flexbox */}
      <ThreeScene
        equipment={equipment}
        layers={layers}
        annotations={annotations}
        selectedEquipmentTags={selectedEquipmentTags}
        onSelectEquipment={onSelectEquipment}
        hoveredEquipmentTag={hoveredEquipmentTag}
        setHoveredEquipmentTag={setHoveredEquipmentTag}
        cameraState={cameraState}
        onCameraChange={onCameraChange}
        initialCameraPosition={initialCameraPosition}
        initialCameraLookAt={initialCameraLookAt}
        colorMode={colorMode}
        targetSystemToFrame={targetSystemToFrame}
        onSystemFramed={onSystemFramed}
      />
      <InfoPanel
        equipment={selectedEquipmentDetails}
        annotation={equipmentAnnotation}
        onClose={() => onSelectEquipment(null, false)} // Simple way to close: deselect all
        onOpenAnnotationDialog={onOpenAnnotationDialog}
        onDeleteAnnotation={onDeleteAnnotation}
        onOperationalStateChange={onOperationalStateChange}
        availableOperationalStatesList={availableOperationalStatesList}
        onProductChange={onProductChange}
        availableProductsList={availableProductsList}
      />
    </div>
  );
}

    