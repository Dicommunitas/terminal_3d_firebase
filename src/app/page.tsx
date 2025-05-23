/**
 * @fileoverview Componente principal da página da aplicação Terminal 3D.
 * Orquestra os diversos hooks de gerenciamento de estado (dados de equipamentos,
 * seleção, filtros, câmera, camadas, anotações, histórico de comandos) e renderiza
 * a interface do usuário, incluindo a cena 3D e a sidebar de controles.
 */
"use client";

import { useMemo, useState, useCallback } from 'react'; // Ensured useState, useMemo, useCallback are imported
import type { Annotation, ColorMode, Equipment } from '@/lib/types';
import { useCommandHistory } from '@/hooks/use-command-history';
import ThreeScene from '@/components/three-scene';
import { AnnotationDialog } from '@/components/annotation-dialog';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Undo2Icon, Redo2Icon, PanelLeft } from 'lucide-react';

// Hooks de gerenciamento de estado
import { useAnnotationManager } from '@/hooks/use-annotation-manager';
import { useEquipmentSelectionManager } from '@/hooks/use-equipment-selection-manager';
import { useFilterManager } from '@/hooks/use-filter-manager';
import { useEquipmentDataManager } from '@/hooks/use-equipment-data-manager';
import { useCameraManager, defaultInitialCameraPosition, defaultInitialCameraLookAt } from '@/hooks/use-camera-manager';
import { useLayerManager } from '@/hooks/use-layer-manager';

// Layout Components
import { MainSceneArea } from '@/components/main-scene-area';
import { SidebarContentLayout } from '@/components/sidebar-content-layout';


/**
 * Componente principal da página Terminal 3D.
 * Este componente integra todos os hooks de gerenciamento de estado e renderiza
 * a UI principal da aplicação.
 * @returns {JSX.Element} O componente da página Terminal 3D.
 */
export default function Terminal3DPage() {
  const { executeCommand, undo, redo, canUndo, canRedo } = useCommandHistory();

  const {
    equipmentData,
    handleOperationalStateChange,
    handleProductChange,
  } = useEquipmentDataManager();

  const {
    currentCameraState,
    targetSystemToFrame,
    handleSetCameraViewForSystem,
    handleCameraChangeFromScene,
    onSystemFramed,
  } = useCameraManager({ executeCommand });

  const {
    searchTerm,
    setSearchTerm,
    selectedSistema,
    setSelectedSistema,
    selectedArea,
    setSelectedArea,
    availableSistemas,
    availableAreas,
    filteredEquipment,
  } = useFilterManager({ allEquipment: equipmentData });

  const {
    annotations,
    isAnnotationDialogOpen,
    annotationTargetEquipment,
    editingAnnotation,
    handleOpenAnnotationDialog,
    handleSaveAnnotation,
    handleDeleteAnnotation,
    getAnnotationForEquipment,
    setIsAnnotationDialogOpen,
  } = useAnnotationManager({ equipmentData });

  const {
    selectedEquipmentTags,
    hoveredEquipmentTag,
    handleEquipmentClick,
    handleSetHoveredEquipmentTag,
    selectTagsBatch,
  } = useEquipmentSelectionManager({ equipmentData, executeCommand });

  const { layers, handleToggleLayer } = useLayerManager({ executeCommand });
  const [colorMode, setColorMode] = useState<ColorMode>('Equipamento');

  const handleFocusAndSelectSystem = useCallback((systemName: string) => {
    handleSetCameraViewForSystem(systemName);
    const equipmentInSystem = equipmentData
      .filter(equip => equip.sistema === systemName)
      .map(equip => equip.tag);
    selectTagsBatch(equipmentInSystem, `Focado e selecionado sistema ${systemName}.`);
  }, [equipmentData, handleSetCameraViewForSystem, selectTagsBatch]);

  const selectedEquipmentDetails = useMemo(() => {
    if (selectedEquipmentTags.length === 1) {
      const tag = selectedEquipmentTags[0];
      return equipmentData.find(e => e.tag === tag) || null;
    }
    return null;
  }, [selectedEquipmentTags, equipmentData]);

  const equipmentAnnotation = useMemo(() => {
    if (selectedEquipmentDetails) {
      return getAnnotationForEquipment(selectedEquipmentDetails.tag);
    }
    return null;
  }, [selectedEquipmentDetails, getAnnotationForEquipment]);

  const availableOperationalStatesList = useMemo(() => {
    const states = new Set<string>();
    equipmentData.forEach(equip => {
      if (equip.operationalState) states.add(equip.operationalState);
    });
    const sortedStates = Array.from(states).sort((a, b) => {
      if (a === "Não aplicável") return -1;
      if (b === "Não aplicável") return 1;
      return a.localeCompare(b);
    });
    return sortedStates;
  }, [equipmentData]);

  const availableProductsList = useMemo(() => {
    const products = new Set<string>();
    equipmentData.forEach(equip => {
      if (equip.product) products.add(equip.product);
    });
    const sortedProducts = Array.from(products).sort((a,b) => {
      if (a === "Não aplicável") return -1;
      if (b === "Não aplicável") return 1;
      return a.localeCompare(b);
    });
    return sortedProducts;
  }, [equipmentData]);

  const cameraViewSystems = useMemo(() => {
    const sistemas = new Set<string>();
    equipmentData.forEach(equip => {
      if (equip.sistema) sistemas.add(equip.sistema);
    });
    return Array.from(sistemas).sort();
  }, [equipmentData]);

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="h-screen w-full flex flex-col relative">
        <div className="absolute top-4 left-4 z-30">
          <SidebarTrigger asChild className="h-10 w-10 bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground rounded-md shadow-lg p-2">
            <PanelLeft />
          </SidebarTrigger>
        </div>

        <MainSceneArea
          equipment={filteredEquipment}
          layers={layers}
          annotations={annotations}
          selectedEquipmentTags={selectedEquipmentTags}
          onSelectEquipment={handleEquipmentClick}
          hoveredEquipmentTag={hoveredEquipmentTag}
          setHoveredEquipmentTag={handleSetHoveredEquipmentTag}
          cameraState={currentCameraState}
          onCameraChange={handleCameraChangeFromScene}
          initialCameraPosition={defaultInitialCameraPosition}
          initialCameraLookAt={defaultInitialCameraLookAt}
          colorMode={colorMode}
          targetSystemToFrame={targetSystemToFrame}
          onSystemFramed={onSystemFramed}
          selectedEquipmentDetails={selectedEquipmentDetails}
          equipmentAnnotation={equipmentAnnotation}
          onOpenAnnotationDialog={() => selectedEquipmentDetails && handleOpenAnnotationDialog(selectedEquipmentDetails)}
          onDeleteAnnotation={handleDeleteAnnotation}
          onOperationalStateChange={handleOperationalStateChange}
          availableOperationalStatesList={availableOperationalStatesList}
          onProductChange={handleProductChange}
          availableProductsList={availableProductsList}
        />
      </div>

      <Sidebar collapsible="offcanvas" className="border-r z-40">
        <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
          <SidebarHeader className="p-3 flex justify-between items-center border-b">
            <div className="flex items-center space-x-1">
              <Button variant="ghost" size="icon" onClick={undo} disabled={!canUndo} aria-label="Desfazer" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                <Undo2Icon className="h-5 w-5" />
              </Button>
              <SidebarTrigger
                asChild
                variant="ghost"
                size="default"
                className="p-0 h-auto w-auto hover:bg-transparent dark:hover:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              >
                <span className="font-semibold text-lg cursor-pointer hover:underline">
                  Terminal 3D
                </span>
              </SidebarTrigger>
              <Button variant="ghost" size="icon" onClick={redo} disabled={!canRedo} aria-label="Refazer" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                <Redo2Icon className="h-5 w-5" />
              </Button>
            </div>
          </SidebarHeader>
          <SidebarContentLayout
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedSistema={selectedSistema}
            setSelectedSistema={setSelectedSistema}
            availableSistemas={availableSistemas}
            selectedArea={selectedArea}
            setSelectedArea={setSelectedArea}
            availableAreas={availableAreas}
            colorMode={colorMode}
            onColorModeChange={setColorMode}
            layers={layers}
            onToggleLayer={handleToggleLayer}
            cameraViewSystems={cameraViewSystems}
            onFocusAndSelectSystem={handleFocusAndSelectSystem}
          />
        </div>
      </Sidebar>

      <AnnotationDialog
        isOpen={isAnnotationDialogOpen}
        onOpenChange={setIsAnnotationDialogOpen}
        onConfirm={handleSaveAnnotation}
        currentAnnotation={editingAnnotation}
        equipmentName={annotationTargetEquipment?.name || ''}
      />
    </SidebarProvider>
  );
}
