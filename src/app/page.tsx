
/**
 * @fileoverview Componente principal da página da aplicação Terminal 3D.
 * Orquestra os diversos hooks de gerenciamento de estado e renderiza a interface do usuário,
 * incluindo a cena 3D e a sidebar de controles.
 */
"use client";

import { useState, useMemo, useCallback } from 'react';
import type { Equipment, Layer, Command, CameraState, Annotation, ColorMode } from '@/lib/types'; // ColorMode precisa ser importado
import { useCommandHistory } from '@/hooks/use-command-history';
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

// Componentes de Layout
import { MainSceneArea } from '@/components/main-scene-area';
import { SidebarContentLayout } from '@/components/sidebar-content-layout';
import { AnnotationDialog } from '@/components/annotation-dialog';
// ThreeScene é importado por MainSceneArea

/**
 * Componente principal da página Terminal 3D (Terminal3DPage).
 *
 * Orquestra os diversos hooks de gerenciamento de estado da aplicação:
 * - `useCommandHistory`: Para funcionalidades de Undo/Redo.
 * - `useEquipmentDataManager`: Gerencia a "fonte da verdade" dos dados dos equipamentos e suas modificações diretas (estado operacional, produto).
 * - `useCameraManager`: Controla o estado da câmera 3D, incluindo presets e foco em sistemas.
 * - `useFilterManager`: Gerencia os estados e a lógica de filtragem dos equipamentos (busca por texto, sistema, área).
 * - `useAnnotationManager`: Lida com o estado e as operações CRUD para anotações dos equipamentos.
 * - `useEquipmentSelectionManager`: Gerencia a seleção de equipamentos (single, multi) e o estado de hover.
 * - `useLayerManager`: Controla o estado de visibilidade das diferentes camadas de objetos na cena.
 *
 * Também gerencia estados locais como `colorMode` para a colorização da cena.
 *
 * Responsável por:
 * - Renderizar a estrutura principal da UI, incluindo a `Sidebar` e a `MainSceneArea`.
 * - Passar os estados e callbacks apropriados dos hooks para os componentes filhos.
 * - Definir lógicas de alto nível que coordenam múltiplos hooks (e.g., `handleFocusAndSelectSystem`).
 * - Calcular dados derivados (e.g., `selectedEquipmentDetails`, listas de opções para filtros) usando `useMemo`.
 *
 * @returns {JSX.Element} O componente da página Terminal 3D.
 */
export default function Terminal3DPage(): JSX.Element {
  // console.log("[Page] Terminal3DPage rendering");

  // Hooks de gerenciamento de estado
  const { executeCommand, undo, redo, canUndo, canRedo } = useCommandHistory();

  const {
    equipmentData,
    handleOperationalStateChange,
    handleProductChange,
  } = useEquipmentDataManager();

  const {
    currentCameraState,
    targetSystemToFrame,
    handleSetCameraViewForSystem, // Renomeado no hook
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
    handleEquipmentClick, // Renomeado no hook
    handleSetHoveredEquipmentTag, // Renomeado no hook
    selectTagsBatch, // Renomeado no hook
  } = useEquipmentSelectionManager({ equipmentData, executeCommand });

  const { layers, handleToggleLayer } = useLayerManager({ executeCommand });

  const [colorMode, setColorMode] = useState<ColorMode>('Estado Operacional');

  /**
   * Lista de sistemas únicos disponíveis para o painel de controle da câmera ("Focus on System").
   * Exclui "All" se estiver presente em `availableSistemas`.
   */
  const cameraViewSystems = useMemo(() => {
    return availableSistemas.filter(s => s !== 'All');
  }, [availableSistemas]);

  /**
   * Manipula a ação de focar a câmera em um sistema e selecionar todos os equipamentos desse sistema.
   * @param {string} systemName - O nome do sistema para focar e selecionar.
   */
  const handleFocusAndSelectSystem = useCallback((systemName: string) => {
    console.log(`[Page] Focusing and selecting system: ${systemName}`);
    handleSetCameraViewForSystem(systemName); // Do useCameraManager
    const equipmentInSystem = equipmentData
      .filter(equip => equip.sistema === systemName)
      .map(equip => equip.tag);
    selectTagsBatch(equipmentInSystem, `Focado e selecionado sistema ${systemName}.`); // Do useEquipmentSelectionManager
  }, [equipmentData, handleSetCameraViewForSystem, selectTagsBatch]);


  /**
   * Deriva os detalhes do equipamento selecionado.
   * Mostra detalhes apenas se um único equipamento estiver selecionado.
   */
  const selectedEquipmentDetails = useMemo(() => {
    if (selectedEquipmentTags.length === 1) {
      const tag = selectedEquipmentTags[0];
      return equipmentData.find(e => e.tag === tag) || null;
    }
    return null;
  }, [selectedEquipmentTags, equipmentData]);

  /**
   * Obtém a anotação para o equipamento atualmente selecionado (se houver um único selecionado).
   */
  const equipmentAnnotation = useMemo(() => {
    if (selectedEquipmentDetails) {
      return getAnnotationForEquipment(selectedEquipmentDetails.tag);
    }
    return null;
  }, [selectedEquipmentDetails, getAnnotationForEquipment]);

  /**
   * Lista de estados operacionais únicos disponíveis, derivada dos dados dos equipamentos.
   * Usada para popular o dropdown de alteração de estado no InfoPanel.
   */
  const availableOperationalStatesList = useMemo(() => {
    const states = new Set<string>();
    equipmentData.forEach(equip => {
      if (equip.operationalState) states.add(equip.operationalState);
    });
    // Garante que "Não aplicável" fique no início se existir, depois ordena o resto.
    const sortedStates = Array.from(states).sort((a, b) => {
      if (a === "Não aplicável") return -1;
      if (b === "Não aplicável") return 1;
      return a.localeCompare(b);
    });
    return sortedStates;
  }, [equipmentData]);

  /**
   * Lista de produtos únicos disponíveis, derivada dos dados dos equipamentos.
   * Usada para popular o dropdown de alteração de produto no InfoPanel.
   */
  const availableProductsList = useMemo(() => {
    const products = new Set<string>();
    equipmentData.forEach(equip => {
      if (equip.product) products.add(equip.product);
    });
    // Garante que "Não aplicável" fique no início se existir, depois ordena o resto.
     const sortedProducts = Array.from(products).sort((a,b) => {
      if (a === "Não aplicável") return -1;
      if (b === "Não aplicável") return 1;
      return a.localeCompare(b);
    });
    return sortedProducts;
  }, [equipmentData]);


  return (
    <SidebarProvider defaultOpen={false}>
      <div className="h-screen w-full flex flex-col relative">
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

        <div className="absolute top-4 left-4 z-30">
          <SidebarTrigger asChild className="h-10 w-10 bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground rounded-md shadow-lg p-2">
            <PanelLeft />
          </SidebarTrigger>
        </div>
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
