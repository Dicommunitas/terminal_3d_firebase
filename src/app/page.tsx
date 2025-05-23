
/**
 * @fileoverview Componente principal da página da aplicação Terminal 3D.
 * Orquestra os diversos hooks de gerenciamento de estado (dados de equipamentos,
 * seleção, filtros, câmera, camadas, anotações, histórico de comandos) e renderiza
 * a interface do usuário, incluindo a cena 3D e a sidebar de controles.
 */
"use client";

import { useMemo, useState } from 'react';
import type { Annotation, ColorMode, Equipment } from '@/lib/types';
import { useCommandHistory } from '@/hooks/use-command-history';
import ThreeScene from '@/components/three-scene';
import { CameraControlsPanel } from '@/components/camera-controls-panel';
import { InfoPanel } from '@/components/info-panel';
import { AnnotationDialog } from '@/components/annotation-dialog';
import { LayerManager as LayerManagerUI } from '@/components/layer-manager';
import { ColorModeSelector } from '@/components/color-mode-selector';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Undo2Icon, Redo2Icon, PanelLeft, XIcon, Settings2Icon, LocateIcon, PanelLeftClose } from 'lucide-react';

import { useAnnotationManager } from '@/hooks/use-annotation-manager';
import { useEquipmentSelectionManager } from '@/hooks/use-equipment-selection-manager';
import { useFilterManager } from '@/hooks/use-filter-manager';
import { useEquipmentDataManager } from '@/hooks/use-equipment-data-manager';
import { useCameraManager } from '@/hooks/use-camera-manager';
import { useLayerManager } from '@/hooks/use-layer-manager';

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
    defaultInitialCameraPosition,
    defaultInitialCameraLookAt,
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

  /**
   * Foca a câmera em um sistema específico e seleciona todos os equipamentos desse sistema.
   * @param {string} systemName - O nome do sistema para focar e selecionar.
   */
  const handleFocusAndSelectSystem = (systemName: string) => {
    handleSetCameraViewForSystem(systemName);
    const equipmentInSystem = equipmentData
      .filter(equip => equip.sistema === systemName)
      .map(equip => equip.tag);
    selectTagsBatch(equipmentInSystem, `Focado e selecionado sistema ${systemName}.`);
  };

  /**
   * Detalhes do equipamento selecionado para exibição no InfoPanel.
   * Mostra detalhes apenas se um único equipamento estiver selecionado.
   * @type {Equipment | null}
   */
  const selectedEquipmentDetails = useMemo(() => {
    if (selectedEquipmentTags.length === 1) {
      const tag = selectedEquipmentTags[0];
      return equipmentData.find(e => e.tag === tag) || null;
    }
    return null;
  }, [selectedEquipmentTags, equipmentData]);

  /**
   * Anotação para o equipamento atualmente selecionado (se houver um único selecionado).
   * @type {Annotation | null}
   */
  const equipmentAnnotation = useMemo(() => {
    if (selectedEquipmentDetails) {
      return getAnnotationForEquipment(selectedEquipmentDetails.tag);
    }
    return null;
  }, [selectedEquipmentDetails, getAnnotationForEquipment]);

  /**
   * Lista de estados operacionais únicos disponíveis, excluindo "All".
   * Usado para popular o dropdown de alteração de estado no InfoPanel.
   * @type {string[]}
   */
  const availableOperationalStatesList = useMemo(() => {
    const states = new Set<string>();
    equipmentData.forEach(equip => {
      if (equip.operationalState) states.add(equip.operationalState);
    });
    // Não adiciona "All" aqui, pois o InfoPanel não precisa dele.
    const sortedStates = Array.from(states).sort((a, b) => {
      if (a === "Não aplicável") return -1; // "Não aplicável" primeiro
      if (b === "Não aplicável") return 1;
      return a.localeCompare(b);
    });
    return sortedStates;
  }, [equipmentData]);

  /**
   * Lista de produtos únicos disponíveis, excluindo "All".
   * Usado para popular o dropdown de alteração de produto no InfoPanel.
   * @type {string[]}
   */
  const availableProductsList = useMemo(() => {
    const products = new Set<string>();
    equipmentData.forEach(equip => {
      if (equip.product) products.add(equip.product);
    });
    // Não adiciona "All" aqui.
    const sortedProducts = Array.from(products).sort((a,b) => {
      if (a === "Não aplicável") return -1;
      if (b === "Não aplicável") return 1;
      return a.localeCompare(b);
    });
    return sortedProducts;
  }, [equipmentData]);

  /**
   * Lista de sistemas únicos para os quais existem vistas de câmera (usado no CameraControlsPanel).
   * @type {string[]}
   */
  const cameraViewSystems = useMemo(() => {
    const sistemas = new Set<string>();
    equipmentData.forEach(equip => {
      if (equip.sistema) sistemas.add(equip.sistema);
    });
    return Array.from(sistemas).sort();
  }, [equipmentData]);

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="h-screen w-full flex flex-col">
        {/* Botão para abrir a sidebar em telas menores ou quando fechada */}
        <div className="absolute top-4 left-4 z-30">
          <SidebarTrigger asChild className="h-10 w-10 bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground rounded-md shadow-lg p-2">
            <PanelLeft />
          </SidebarTrigger>
        </div>

        {/* Contêiner principal para a cena 3D e o InfoPanel */}
        <div className="flex-1 relative min-h-0"> {/* Adicionado min-h-0 */}
          <ThreeScene
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
          />
          {selectedEquipmentDetails && (
            <InfoPanel
              equipment={selectedEquipmentDetails}
              annotation={equipmentAnnotation}
              onClose={() => handleEquipmentClick(null, false)} // Limpa a seleção
              onOpenAnnotationDialog={() => handleOpenAnnotationDialog(selectedEquipmentDetails)}
              onDeleteAnnotation={handleDeleteAnnotation}
              onOperationalStateChange={handleOperationalStateChange}
              availableOperationalStatesList={availableOperationalStatesList}
              onProductChange={handleProductChange}
              availableProductsList={availableProductsList}
            />
          )}
        </div>
      </div>

      {/* Sidebar */}
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
            {/* O botão de fechar a sidebar foi movido para ser o próprio texto "Terminal 3D" */}
          </SidebarHeader>
          <SidebarContent className="p-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-6 pb-6">
                {/* Card de Filtros */}
                <Card className="shadow-md">
                  <CardContent className="p-3 space-y-3">
                    <div className="relative">
                      <Input
                        type="search"
                        placeholder="Buscar por nome, tipo, tag..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-9 pr-9"
                      />
                      {searchTerm && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSearchTerm('')}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0 h-6 w-6 text-muted-foreground hover:text-foreground"
                          aria-label="Limpar busca"
                        >
                          <XIcon className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="sistema-filter" className="text-xs text-muted-foreground flex items-center">
                        <Settings2Icon className="mr-1.5 h-3.5 w-3.5" />
                        Filtrar por Sistema
                      </Label>
                      <Select value={selectedSistema} onValueChange={setSelectedSistema}>
                        <SelectTrigger id="sistema-filter" className="h-9">
                          <SelectValue placeholder="Selecionar sistema" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableSistemas.map(sistema => (
                            <SelectItem key={sistema} value={sistema}>
                              {sistema}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="area-filter" className="text-xs text-muted-foreground flex items-center">
                        <LocateIcon className="mr-1.5 h-3.5 w-3.5" />
                        Filtrar por Área
                      </Label>
                      <Select value={selectedArea} onValueChange={setSelectedArea}>
                        <SelectTrigger id="area-filter" className="h-9">
                          <SelectValue placeholder="Selecionar área" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableAreas.map(area => (
                            <SelectItem key={area} value={area}>
                              {area}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Seletor de Modo de Coloração */}
                <ColorModeSelector
                  colorMode={colorMode}
                  onColorModeChange={setColorMode}
                />

                {/* Gerenciador de Camadas de Visibilidade */}
                <LayerManagerUI
                  layers={layers}
                  onToggleLayer={handleToggleLayer}
                />

                {/* Painel de Controles da Câmera (Focus on System) */}
                <CameraControlsPanel
                  systems={cameraViewSystems}
                  onSetView={handleFocusAndSelectSystem}
                />
              </div>
            </ScrollArea>
          </SidebarContent>
        </div>
      </Sidebar>

      {/* Diálogo de Anotação */}
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
