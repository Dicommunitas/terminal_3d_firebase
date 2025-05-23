/**
 * @fileoverview Component responsible for rendering the main 3D scene area,
 * including the ThreeScene and the InfoPanel.
 */
"use client";

import type { Equipment, Layer, CameraState, Annotation, ColorMode } from '@/lib/types';
import ThreeScene from '@/components/three-scene'; // Default import
import { InfoPanel } from '@/components/info-panel';

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
}: MainSceneAreaProps) {
  return (
    <div className="flex-1 relative w-full bg-muted/20 min-w-0">
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
