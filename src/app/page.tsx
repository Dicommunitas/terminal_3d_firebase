
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Equipment, Layer, Command, CameraState, Annotation } from '@/lib/types';
import { useCommandHistory } from '@/hooks/use-command-history';
import ThreeScene from '@/components/three-scene';
import { CameraControlsPanel } from '@/components/camera-controls-panel';
import { InfoPanel } from '@/components/info-panel';
import { AnnotationDialog } from '@/components/annotation-dialog';
import { LayerManager, type ColorMode } from '@/components/layer-manager';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Undo2Icon, Redo2Icon, PanelLeft, XIcon, Settings2Icon, LocateIcon, SearchIcon, LayersIcon, PanelLeftClose } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { initialEquipment, initialLayers } from '@/core/data/initial-data';
import { getFilteredEquipment, type EquipmentFilterCriteria } from '@/core/logic/equipment-filter';


const defaultInitialCameraPosition = { x: 25, y: 20, z: 25 };
const defaultInitialCameraLookAt = { x: 0, y: 2, z: 0 };

export default function Terminal3DPage() {
  const [equipmentData, setEquipmentData] = useState<Equipment[]>(initialEquipment);
  const [layers, setLayers] = useState<Layer[]>(initialLayers);
  const [selectedEquipmentTags, setSelectedEquipmentTags] = useState<string[]>([]);
  const [currentCameraState, setCurrentCameraState] = useState<CameraState | undefined>({
    position: defaultInitialCameraPosition,
    lookAt: defaultInitialCameraLookAt,
  });
  const [hoveredEquipmentTag, setHoveredEquipmentTag] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSistema, setSelectedSistema] = useState<string>('All');
  const [selectedArea, setSelectedArea] = useState<string>('All');
  
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isAnnotationDialogOpen, setIsAnnotationDialogOpen] = useState(false);
  const [annotationTargetEquipment, setAnnotationTargetEquipment] = useState<Equipment | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(null);

  const [colorMode, setColorMode] = useState<ColorMode>('Equipamento');
  const [targetSystemToFrame, setTargetSystemToFrame] = useState<string | null>(null);

  const { toast } = useToast();
  const { executeCommand, undo, redo, canUndo, canRedo } = useCommandHistory();

  const handleSetHoveredEquipmentTag = useCallback((tag: string | null) => {
    // console.log('[Page] handleSetHoveredEquipmentTag CALLED with tag:', tag);
    setHoveredEquipmentTag(tag);
  }, []);

  const availableSistemas = useMemo(() => {
    const sistemas = new Set<string>();
    initialEquipment.forEach(equip => {
      if (equip.sistema) sistemas.add(equip.sistema);
    });
    return ['All', ...Array.from(sistemas).sort()];
  }, []);

  const availableAreas = useMemo(() => {
    const areas = new Set<string>();
    initialEquipment.forEach(equip => {
      if (equip.area) areas.add(equip.area);
    });
    return ['All', ...Array.from(areas).sort()];
  }, []);
  
  const availableOperationalStates = useMemo(() => {
    const states = new Set<string>();
    initialEquipment.forEach(equip => {
      if (equip.operationalState) states.add(equip.operationalState);
    });
    const sortedStates = Array.from(states).filter(s => s !== 'Não aplicável' && s !== 'All').sort();
    return ['All', 'Não aplicável', ...sortedStates];
  }, []);

  const availableProducts = useMemo(() => {
    const products = new Set<string>();
    initialEquipment.forEach(equip => {
      if (equip.product && equip.product !== "Não aplicável") products.add(equip.product);
    });
    const sortedProducts = Array.from(products).sort();
    const finalProducts = new Set(['All', 'Não aplicável', ...sortedProducts]);
    return Array.from(finalProducts);
  }, []);

  const filteredEquipment = useMemo(() => {
    const criteria: EquipmentFilterCriteria = {
      searchTerm,
      selectedSistema,
      selectedArea,
    };
    return getFilteredEquipment(equipmentData, criteria);
  }, [equipmentData, searchTerm, selectedSistema, selectedArea]);

  const handleSelectEquipment = useCallback((equipmentTag: string | null, isMultiSelectModifierPressed: boolean) => {
    const oldSelection = [...selectedEquipmentTags];
    let newSelection: string[];

    if (isMultiSelectModifierPressed) {
      if (equipmentTag) {
        if (oldSelection.includes(equipmentTag)) {
          newSelection = oldSelection.filter(tag => tag !== equipmentTag);
        } else {
          newSelection = [...oldSelection, equipmentTag];
        }
      } else {
        newSelection = oldSelection; 
      }
    } else {
      if (equipmentTag) {
        if (oldSelection.length === 1 && oldSelection[0] === equipmentTag) {
             newSelection = []; 
        } else {
            newSelection = [equipmentTag]; 
        }
      } else {
        newSelection = []; 
      }
    }

    const oldSelectionSorted = [...oldSelection].sort();
    const newSelectionSorted = [...newSelection].sort();

    if (JSON.stringify(oldSelectionSorted) === JSON.stringify(newSelectionSorted)) {
      setSelectedEquipmentTags(newSelection); 
      return;
    }

    const command: Command = {
      id: `select-equipment-${Date.now()}`,
      type: 'EQUIPMENT_SELECT',
      description: `Update equipment selection. ${newSelection.length} item(s) selected.`,
      execute: () => {
        setSelectedEquipmentTags(newSelection);
      },
      undo: () => {
        setSelectedEquipmentTags(oldSelection);
      },
    };
    executeCommand(command);

    if (newSelection.length === 1) {
      const item = equipmentData.find(e => e.tag === newSelection[0]);
      toast({ title: "Selected", description: `${item?.name || 'Equipment'} selected.` });
    } else if (newSelection.length > 1) {
      toast({ title: "Selection Updated", description: `${newSelection.length} items selected.` });
    } else if (oldSelection.length > 0 && newSelection.length === 0) {
      toast({ title: "Selection Cleared" });
    }

  }, [selectedEquipmentTags, executeCommand, toast, equipmentData]);


  const handleToggleLayer = useCallback((layerId: string) => {
    const layerIndex = layers.findIndex(l => l.id === layerId);
    if (layerIndex === -1) return;

    const oldLayers = [...layers];
    const newLayers = oldLayers.map(l => l.id === layerId ? { ...l, isVisible: !l.isVisible } : l);

    const command: Command = {
      id: `toggle-layer-${layerId}-${Date.now()}`,
      type: 'LAYER_VISIBILITY',
      description: `Toggle layer ${oldLayers[layerIndex].name}`,
      execute: () => setLayers(newLayers),
      undo: () => setLayers(oldLayers),
    };
    executeCommand(command);
  }, [layers, executeCommand]);

  const handleSetCameraView = useCallback((systemName: string) => {
    const equipmentInSystem = initialEquipment
      .filter(equip => equip.sistema === systemName)
      .map(equip => equip.tag);

    const newSelection = equipmentInSystem;
    const oldSelection = selectedEquipmentTags; 

    const oldSelectionSorted = [...oldSelection].sort();
    const newSelectionSorted = [...newSelection].sort();

    if (JSON.stringify(oldSelectionSorted) !== JSON.stringify(newSelectionSorted)) {
        const command: Command = {
            id: `select-system-equipment-${systemName}-${Date.now()}`,
            type: 'EQUIPMENT_SELECT',
            description: `Selected all equipment in system ${systemName}.`,
            execute: () => {
              setSelectedEquipmentTags(newSelection);
            },
            undo: () => {
              setSelectedEquipmentTags(oldSelection);
            },
        };
        executeCommand(command);
        if (newSelection.length > 0) {
            toast({ title: "System Focused", description: `Selected all ${newSelection.length} equipment in system ${systemName}.` });
        }
    }
    
    setTargetSystemToFrame(systemName);
  }, [selectedEquipmentTags, executeCommand, toast]);


  const handleCameraChangeFromScene = useCallback((newSceneCameraState: CameraState) => {
    if (currentCameraState &&
        Math.abs(currentCameraState.position.x - newSceneCameraState.position.x) < 0.01 &&
        Math.abs(currentCameraState.position.y - newSceneCameraState.position.y) < 0.01 &&
        Math.abs(currentCameraState.position.z - newSceneCameraState.position.z) < 0.01 &&
        Math.abs(currentCameraState.lookAt.x - newSceneCameraState.lookAt.x) < 0.01 &&
        Math.abs(currentCameraState.lookAt.y - newSceneCameraState.lookAt.y) < 0.01 &&
        Math.abs(currentCameraState.lookAt.z - newSceneCameraState.lookAt.z) < 0.01) {
      return;
    }

    const oldCameraState = currentCameraState ? { ...currentCameraState } : undefined;
    const command: Command = {
        id: `orbit-camera-${Date.now()}`,
        type: 'CAMERA_MOVE',
        description: 'Orbit camera',
        execute: () => setCurrentCameraState(newSceneCameraState),
        undo: () => setCurrentCameraState(oldCameraState),
    };
    executeCommand(command);
  }, [currentCameraState, executeCommand]);


  const selectedEquipmentDetails = useMemo(() => {
    if (selectedEquipmentTags.length === 1) {
      const tag = selectedEquipmentTags[0];
      return equipmentData.find(e => e.tag === tag) || null;
    }
    return null;
  }, [selectedEquipmentTags, equipmentData]);

  const handleOpenAnnotationDialog = useCallback(() => {
    if (selectedEquipmentDetails) { 
      const existing = annotations.find(a => a.equipmentTag === selectedEquipmentDetails.tag);
      setEditingAnnotation(existing || null);
      setAnnotationTargetEquipment(selectedEquipmentDetails);
      setIsAnnotationDialogOpen(true);
    } else {
      toast({ title: "No Single Equipment Selected", description: "Please select a single equipment to manage its annotation.", variant: "destructive" });
    }
  }, [selectedEquipmentDetails, annotations, toast]);

  const handleSaveAnnotation = useCallback((text: string) => {
    if (!annotationTargetEquipment) return;

    setAnnotations(prevAnnotations => {
        const existingAnnotation = prevAnnotations.find(a => a.equipmentTag === annotationTargetEquipment.tag);
        let newAnnotationsList: Annotation[];
        let toastDescription: string;

        if (existingAnnotation) {
          newAnnotationsList = prevAnnotations.map(anno =>
            anno.equipmentTag === annotationTargetEquipment.tag
              ? { ...anno, text: text, createdAt: new Date().toISOString() }
              : anno
          );
          toastDescription = `Annotation for ${annotationTargetEquipment.name} updated.`;
        } else {
          const newAnnotation: Annotation = {
            equipmentTag: annotationTargetEquipment.tag,
            text,
            createdAt: new Date().toISOString(),
          };
          newAnnotationsList = [...prevAnnotations, newAnnotation];
          toastDescription = `Annotation for ${annotationTargetEquipment.name} added.`;
        }
        toast({ title: "Annotation Saved", description: toastDescription });
        return newAnnotationsList;
    });
    
    setIsAnnotationDialogOpen(false);
    setEditingAnnotation(null);
    setAnnotationTargetEquipment(null);

  }, [annotationTargetEquipment, toast]);

  const handleDeleteAnnotation = useCallback((equipmentTag: string) => {
    const equipment = equipmentData.find(e => e.tag === equipmentTag);
    if (!equipment) return;

    setAnnotations(prevAnnotations => {
        const newAnnotationsList = prevAnnotations.filter(a => a.equipmentTag !== equipmentTag);
        if (prevAnnotations.length === newAnnotationsList.length) {
          toast({ title: "No Annotation", description: `No annotation found for ${equipment.name} to delete.`, variant: "destructive" });
          return prevAnnotations;
        }
        toast({ title: "Annotation Deleted", description: `Annotation for ${equipment.name} has been deleted.` });
        return newAnnotationsList;
    });
  }, [toast, equipmentData]);


  const equipmentAnnotation = useMemo(() => {
    if (selectedEquipmentDetails) { 
      return annotations.find(a => a.equipmentTag === selectedEquipmentDetails.tag) || null;
    }
    return null;
  }, [selectedEquipmentDetails, annotations]);

  const handleOperationalStateChange = useCallback((equipmentTag: string, newState: string) => {
    setEquipmentData(prevData =>
      prevData.map(equip =>
        equip.tag === equipmentTag ? { ...equip, operationalState: newState } : equip
      )
    );
    const equip = equipmentData.find(e => e.tag === equipmentTag);
    toast({ title: "State Updated", description: `${equip?.name || 'Equipment'} state changed to ${newState}.`});
  }, [equipmentData, toast]);

  const handleProductChange = useCallback((equipmentTag: string, newProduct: string) => {
    setEquipmentData(prevData =>
      prevData.map(equip =>
        equip.tag === equipmentTag ? { ...equip, product: newProduct } : equip
      )
    );
    const equip = equipmentData.find(e => e.tag === equipmentTag);
    toast({ title: "Product Updated", description: `${equip?.name || 'Equipment'} product changed to ${newProduct}.`});
  }, [equipmentData, toast]);


  const cameraViewSystems = useMemo(() => {
    const sistemas = new Set<string>();
    initialEquipment.forEach(equip => {
      if (equip.sistema) sistemas.add(equip.sistema);
    });
    return Array.from(sistemas).sort();
  }, []);


  return (
    <SidebarProvider defaultOpen={false}>
      <div className="h-screen w-full relative bg-muted/20">
        <div className="absolute top-4 left-4 z-30">
          <SidebarTrigger asChild className="h-10 w-10 bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground rounded-md shadow-lg p-2">
            <PanelLeft />
          </SidebarTrigger>
        </div>

        <ThreeScene
          equipment={filteredEquipment}
          layers={layers}
          annotations={annotations}
          selectedEquipmentTags={selectedEquipmentTags}
          onSelectEquipment={handleSelectEquipment}
          hoveredEquipmentTag={hoveredEquipmentTag}
          setHoveredEquipmentTag={handleSetHoveredEquipmentTag}
          cameraState={currentCameraState}
          onCameraChange={handleCameraChangeFromScene}
          initialCameraPosition={defaultInitialCameraPosition}
          initialCameraLookAt={defaultInitialCameraLookAt}
          colorMode={colorMode}
          targetSystemToFrame={targetSystemToFrame}
          onSystemFramed={() => setTargetSystemToFrame(null)}
        />
        {selectedEquipmentDetails && (
          <InfoPanel
            equipment={selectedEquipmentDetails}
            annotation={equipmentAnnotation}
            onClose={() => handleSelectEquipment(null, false)}
            onOpenAnnotationDialog={handleOpenAnnotationDialog}
            onDeleteAnnotation={handleDeleteAnnotation}
            onOperationalStateChange={handleOperationalStateChange}
            availableOperationalStatesList={availableOperationalStates.filter(s => s !== 'All' && s !== 'Não aplicável')}
            onProductChange={handleProductChange}
            availableProductsList={availableProducts.filter(p => p !== 'All')}
          />
        )}
      </div>

      <Sidebar collapsible="offcanvas" className="border-r z-40">
        <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
          <SidebarHeader className="p-3 flex justify-between items-center border-b">
             <div className="flex items-center space-x-1">
                <Button variant="ghost" size="icon" onClick={undo} disabled={!canUndo} aria-label="Undo" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
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
                 <Button variant="ghost" size="icon" onClick={redo} disabled={!canRedo} aria-label="Redo" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                    <Redo2Icon className="h-5 w-5" />
                </Button>
            </div>
          </SidebarHeader>
          <SidebarContent className="p-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-6 pb-6">
                <Card className="shadow-md">
                  <CardContent className="p-3 space-y-3">
                    <div className="relative">
                      <Input
                        type="search"
                        placeholder="Search name, type, tag..."
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
                          aria-label="Clear search"
                        >
                          <XIcon className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="sistema-filter" className="text-xs text-muted-foreground flex items-center">
                        <Settings2Icon className="mr-1.5 h-3.5 w-3.5" />
                        Filter by Sistema
                      </Label>
                      <Select value={selectedSistema} onValueChange={setSelectedSistema}>
                        <SelectTrigger id="sistema-filter" className="h-9">
                          <SelectValue placeholder="Select sistema" />
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
                        Filter by Area
                      </Label>
                      <Select value={selectedArea} onValueChange={setSelectedArea}>
                        <SelectTrigger id="area-filter" className="h-9">
                          <SelectValue placeholder="Select area" />
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
                <LayerManager
                  layers={layers}
                  onToggleLayer={handleToggleLayer}
                  colorMode={colorMode}
                  onColorModeChange={setColorMode}
                />
                <CameraControlsPanel 
                  systems={cameraViewSystems} 
                  onSetView={handleSetCameraView} 
                />
              </div>
            </ScrollArea>
          </SidebarContent>
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
