
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Equipment, Layer, Command, CameraState, PresetCameraView, Annotation } from '@/lib/types';
import { useCommandHistory } from '@/hooks/use-command-history';
import ThreeScene from '@/components/three-scene';
import { LayerManager } from '@/components/layer-manager';
import { CameraControlsPanel } from '@/components/camera-controls-panel';
import { InfoPanel } from '@/components/info-panel';
import { AnnotationDialog } from '@/components/annotation-dialog';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Undo2Icon, Redo2Icon, PanelLeft, PanelLeftClose, XIcon, SearchIcon, Terminal, Settings2Icon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const initialEquipment: Equipment[] = [
  { id: 'bldg-01', name: 'Main Office', type: 'Building', sistema: 'NDD', area: 'Área 20', operationalState: 'operando', category: 'Administrative', position: { x: -15, y: 3, z: -10 }, size: { width: 8, height: 6, depth: 10 }, color: '#78909C', details: 'Primary administrative building.' },
  { id: 'bldg-02', name: 'Warehouse A', type: 'Building', sistema: 'GA', area: 'Área 31', operationalState: 'operando', category: 'Storage', position: { x: 15, y: 4, z: -12 }, size: { width: 15, height: 8, depth: 12 }, color: '#78909C', details: 'Storage for dry goods.' },
  { id: 'bldg-03', name: 'Control Room', type: 'Building', sistema: 'NDD', area: 'Área 32', operationalState: 'manutenção', category: 'Operational', position: { x: 0, y: 2, z: -15 }, size: { width: 6, height: 4, depth: 6 }, color: '#78909C', details: 'Central operations control.' },
  { id: 'crane-01', name: 'Gantry Crane 1', type: 'Crane', sistema: 'MTBE', area: 'Área 40', operationalState: 'operando', category: 'Heavy Lift', position: { x: 0, y: 5, z: 8 }, size: { width: 12, height: 10, depth: 2 }, color: '#FF8A65', details: 'Heavy lift gantry crane.' },
  { id: 'crane-02', name: 'Jib Crane', type: 'Crane', sistema: 'QAV', area: 'Área 50', operationalState: 'em falha', category: 'Workshop', position: { x: -10, y: 3.5, z: 5 }, size: { width: 1.5, height: 7, depth: 1.5 }, color: '#FFB74D', details: 'Small jib crane for workshop.' },
  { id: 'tank-01', name: 'Storage Tank Alpha', type: 'Tank', sistema: 'LASTRO', area: 'Área 33', operationalState: 'operando', category: 'Product Storage', position: { x: -8, y: 2.5, z: 12 }, radius: 3, height: 5, color: '#4FC3F7', details: 'Liquid storage tank for Product A.' },
  { id: 'tank-02', name: 'Storage Tank Beta', type: 'Tank', sistema: 'ODB', area: 'Área 33', operationalState: 'não operando', category: 'Auxiliary Storage', position: { x: -2, y: 2, z: 12 }, radius: 2.5, height: 4, color: '#4DD0E1', details: 'Auxiliary liquid storage for Product B.' },
  { id: 'tank-03', name: 'Process Tank Gamma', type: 'Tank', sistema: 'ESCUROS', area: 'Área 34', operationalState: 'manutenção', category: 'Processing', position: { x: 5, y: 3, z: 10 }, radius: 2, height: 6, color: '#4DB6AC', details: 'Processing tank.' },
  { id: 'pipe-01', name: 'Main Feed Pipe', type: 'Pipe', sistema: 'LASTRO', area: 'Área 35', operationalState: 'operando', category: 'Transfer Line', position: { x: -5, y: 1, z: 5 }, radius: 0.3, height: 10, color: '#B0BEC5', details: 'Connects Tank Alpha to Process Area.', rotation: { x: 0, y: 0, z: Math.PI / 2 } },
  { id: 'pipe-02', name: 'Process Output Pipe', type: 'Pipe', sistema: 'ESCUROS', area: 'Área 34', operationalState: 'operando', category: 'Transfer Line', position: { x: 0, y: 2.5, z: 9 }, radius: 0.2, height: 8, color: '#90A4AE', details: 'Carries product from Process Tank Gamma.', rotation: { x: Math.PI / 2, y: 0, z: 0 } },
  { id: 'pipe-03', name: 'Vertical Riser', type: 'Pipe', sistema: 'GA', area: 'Área 60', operationalState: 'não operando', category: 'Utility Line', position: { x: 8, y: 3.5, z: 8 }, radius: 0.25, height: 7, color: '#B0BEC5', details: 'Vertical pipe section.' },
  { id: 'valve-01', name: 'Tank Alpha Outlet Valve', type: 'Valve', sistema: 'LASTRO', area: 'Área 33', operationalState: 'operando', category: 'Control Valve', position: { x: -8, y: 0.5, z: 8.8 }, radius: 0.4, color: '#EF5350', details: 'Controls flow from Tank Alpha.' },
  { id: 'valve-02', name: 'Process Inlet Valve', type: 'Valve', sistema: 'ESCUROS', area: 'Área 34', operationalState: 'manutenção', category: 'Control Valve', position: { x: -1, y: 2.5, z: 5 }, radius: 0.3, color: '#F44336', details: 'Controls input to Process Tank Gamma.' },
  { id: 'valve-03', name: 'Safety Bypass Valve', type: 'Valve', sistema: 'QAV', area: 'Área 60', operationalState: 'em falha', category: 'Safety Valve', position: { x: 8, y: 0.5, z: 4.5 }, radius: 0.3, color: '#E57373', details: 'Emergency bypass valve.' },
];

const initialLayers: Layer[] = [
  { id: 'layer-terrain', name: 'Terrain', equipmentType: 'Terrain', isVisible: true },
  { id: 'layer-buildings', name: 'Buildings', equipmentType: 'Building', isVisible: true },
  { id: 'layer-cranes', name: 'Cranes', equipmentType: 'Crane', isVisible: true },
  { id: 'layer-tanks', name: 'Tanks', equipmentType: 'Tank', isVisible: true },
  { id: 'layer-pipes', name: 'Pipes', equipmentType: 'Pipe', isVisible: true },
  { id: 'layer-valves', name: 'Valves', equipmentType: 'Valve', isVisible: true },
  { id: 'layer-annotations', name: 'Annotations', equipmentType: 'Annotations', isVisible: true },
];

const cameraPresets: PresetCameraView[] = [
  { name: 'Overview', position: { x: 25, y: 20, z: 25 }, lookAt: { x: 0, y: 2, z: 0 } },
  { name: 'Crane Area', position: { x: 0, y: 8, z: 15 }, lookAt: { x: 0, y: 5, z: 5 } },
  { name: 'Tank Farm', position: { x: -5, y: 10, z: 20 }, lookAt: { x: -5, y: 2, z: 10 } },
  { name: 'Piping Detail', position: { x: -2, y: 5, z: 8 }, lookAt: { x: -2, y: 2, z: 0 } },
];

export default function Terminal3DPage() {
  const [equipmentData, setEquipmentData] = useState<Equipment[]>(initialEquipment);
  const [layers, setLayers] = useState<Layer[]>(initialLayers);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [currentCameraState, setCurrentCameraState] = useState<CameraState | undefined>(cameraPresets[0]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSistema, setSelectedSistema] = useState<string>('All');
  const [selectedArea, setSelectedArea] = useState<string>('All');
  const [selectedOperationalState, setSelectedOperationalState] = useState<string>('All');
  
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isAnnotationDialogOpen, setIsAnnotationDialogOpen] = useState(false);
  const [annotationTargetEquipment, setAnnotationTargetEquipment] = useState<Equipment | null>(null);
  const [editingAnnotation, setEditingAnnotation] = useState<Annotation | null>(null);

  const { toast } = useToast();
  const { executeCommand, undo, redo, canUndo, canRedo } = useCommandHistory();

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
    return ['All', ...Array.from(states).sort()];
  }, []);

  const filteredEquipment = useMemo(() => {
    let itemsToFilter = initialEquipment;

    if (selectedSistema !== 'All') {
      itemsToFilter = itemsToFilter.filter(equip => equip.sistema === selectedSistema);
    }
    if (selectedArea !== 'All') {
      itemsToFilter = itemsToFilter.filter(equip => equip.area === selectedArea);
    }
    if (selectedOperationalState !== 'All') {
      itemsToFilter = itemsToFilter.filter(equip => equip.operationalState === selectedOperationalState);
    }
    
    if (searchTerm.trim()) {
      const searchTerms = searchTerm.toLowerCase().split(' ').filter(term => term.length > 0);
      itemsToFilter = itemsToFilter.filter(equip => {
        const name = equip.name.toLowerCase();
        const type = equip.type.toLowerCase();
        const id = equip.id.toLowerCase();
        
        return searchTerms.every(term => 
          name.includes(term) || 
          type.includes(term) || 
          id.includes(term)
        );
      });
    }
    return itemsToFilter;
  }, [searchTerm, selectedSistema, selectedArea, selectedOperationalState]);

  const handleSelectEquipment = useCallback((equipmentId: string | null, isMultiSelectModifierPressed: boolean) => {
    const oldSelection = [...selectedEquipmentIds];
    let newSelection: string[];

    if (isMultiSelectModifierPressed) {
      if (equipmentId) {
        if (oldSelection.includes(equipmentId)) {
          newSelection = oldSelection.filter(id => id !== equipmentId);
        } else {
          newSelection = [...oldSelection, equipmentId];
        }
      } else {
        newSelection = oldSelection; 
      }
    } else {
      if (equipmentId) {
        if (oldSelection.length === 1 && oldSelection[0] === equipmentId && oldSelection.includes(equipmentId) ) {
             newSelection = [];
        } else {
            newSelection = [equipmentId]; 
        }
      } else {
        newSelection = []; 
      }
    }
    
    const oldSelectionSorted = [...oldSelection].sort();
    const newSelectionSorted = [...newSelection].sort();

    if (JSON.stringify(oldSelectionSorted) === JSON.stringify(newSelectionSorted)) {
        return;
    }

    const command: Command = {
      id: `select-equipment-${Date.now()}`,
      type: 'EQUIPMENT_SELECT',
      description: `Update equipment selection. ${newSelection.length} item(s) selected.`,
      execute: () => setSelectedEquipmentIds(newSelection),
      undo: () => setSelectedEquipmentIds(oldSelection),
    };
    executeCommand(command);

    if (newSelection.length === 1) {
      const item = initialEquipment.find(e => e.id === newSelection[0]);
      toast({ title: "Selected", description: `${item?.name || 'Equipment'} selected. ${newSelection.length} item(s) total.` });
    } else if (newSelection.length > 1) {
      toast({ title: "Selection Updated", description: `${newSelection.length} items selected.` });
    } else if (oldSelection.length > 0 && newSelection.length === 0) {
      toast({ title: "Selection Cleared" });
    }

  }, [selectedEquipmentIds, executeCommand, toast]);


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

  const handleSetCameraView = useCallback((view: PresetCameraView) => {
    const oldCameraState = currentCameraState ? { ...currentCameraState } : undefined;
    const newCameraState = { position: view.position, lookAt: view.lookAt };

    const command: Command = {
      id: `set-camera-view-${view.name}-${Date.now()}`,
      type: 'CAMERA_MOVE',
      description: `Set camera to ${view.name}`,
      execute: () => setCurrentCameraState(newCameraState),
      undo: () => setCurrentCameraState(oldCameraState),
    };
    executeCommand(command);
  }, [currentCameraState, executeCommand]);
  
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
    if (selectedEquipmentIds.length > 0) {
      const lastSelectedId = selectedEquipmentIds[selectedEquipmentIds.length - 1];
      return initialEquipment.find(e => e.id === lastSelectedId) || null;
    }
    return null;
  }, [selectedEquipmentIds]);

  const handleOpenAnnotationDialog = useCallback(() => {
    if (selectedEquipmentDetails) {
      const existing = annotations.find(a => a.equipmentId === selectedEquipmentDetails.id);
      setEditingAnnotation(existing || null);
      setAnnotationTargetEquipment(selectedEquipmentDetails);
      setIsAnnotationDialogOpen(true);
    } else {
      toast({ title: "No Equipment Selected", description: "Please select an equipment to manage its annotation.", variant: "destructive" });
    }
  }, [selectedEquipmentDetails, annotations, toast]);

  const handleSaveAnnotation = useCallback((text: string) => {
    if (!annotationTargetEquipment) return;

    let newAnnotations: Annotation[];
    let toastDescription: string;

    const existingAnnotationIndex = annotations.findIndex(a => a.equipmentId === annotationTargetEquipment.id);

    if (existingAnnotationIndex > -1) {
      newAnnotations = annotations.map((anno, index) => 
        index === existingAnnotationIndex ? { ...anno, text: text } : anno
      );
      toastDescription = `Annotation for ${annotationTargetEquipment.name} updated.`;
    } else {
      const newAnnotation: Annotation = {
        equipmentId: annotationTargetEquipment.id,
        text,
        createdAt: new Date().toISOString(),
      };
      newAnnotations = [...annotations, newAnnotation];
      toastDescription = `Annotation for ${annotationTargetEquipment.name} added.`;
    }
    
    setAnnotations(newAnnotations);
    setIsAnnotationDialogOpen(false);
    setEditingAnnotation(null);
    setAnnotationTargetEquipment(null);
    toast({ title: "Annotation Saved", description: toastDescription });

  }, [annotationTargetEquipment, annotations, toast]);

  const handleDeleteAnnotation = useCallback((equipmentId: string) => {
    const equipment = initialEquipment.find(e => e.id === equipmentId);
    if (!equipment) return;

    const newAnnotations = annotations.filter(a => a.equipmentId !== equipmentId);

    if (annotations.length === newAnnotations.length) {
      toast({ title: "No Annotation", description: `No annotation found for ${equipment.name} to delete.`, variant: "destructive" });
      return;
    }
    
    setAnnotations(newAnnotations);
    toast({ title: "Annotation Deleted", description: `Annotation for ${equipment.name} has been deleted.` });
  }, [annotations, toast]);


  const equipmentAnnotation = useMemo(() => {
    if (selectedEquipmentDetails) {
      return annotations.find(a => a.equipmentId === selectedEquipmentDetails.id) || null;
    }
    return null;
  }, [selectedEquipmentDetails, annotations]);


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
          selectedEquipmentIds={selectedEquipmentIds}
          onSelectEquipment={handleSelectEquipment}
          cameraState={currentCameraState}
          onCameraChange={handleCameraChangeFromScene}
          initialCameraPosition={cameraPresets[0].position}
          initialCameraLookAt={cameraPresets[0].lookAt} 
        />
        <InfoPanel 
          equipment={selectedEquipmentDetails}
          annotation={equipmentAnnotation}
          onClose={() => handleSelectEquipment(null, false)}
          onOpenAnnotationDialog={handleOpenAnnotationDialog}
          onDeleteAnnotation={handleDeleteAnnotation}
        />
      </div>

      <Sidebar collapsible="offcanvas" className="border-r z-40"> 
        <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
          <SidebarHeader className="p-3 flex justify-between items-center border-b">
            <div className="flex items-center space-x-2">
               <SidebarTrigger variant="ghost" size="icon" aria-label="Close sidebar" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                <PanelLeftClose className="h-5 w-5" />
              </SidebarTrigger>
              <span className="font-semibold text-lg">Terminal 3D</span>
            </div>
            <div className="flex items-center space-x-1">
                <Button variant="ghost" size="icon" onClick={undo} disabled={!canUndo} aria-label="Undo" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                    <Undo2Icon className="h-5 w-5" />
                </Button>
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
                        placeholder="Search name, type, ID..."
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
                      <Label htmlFor="sistema-filter" className="text-xs text-muted-foreground">Filter by Sistema</Label>
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
                      <Label htmlFor="area-filter" className="text-xs text-muted-foreground">Filter by Area</Label>
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
                    <div className="space-y-1">
                      <Label htmlFor="operational-state-filter" className="text-xs text-muted-foreground">Filter by Operational State</Label>
                      <Select value={selectedOperationalState} onValueChange={setSelectedOperationalState}>
                        <SelectTrigger id="operational-state-filter" className="h-9">
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableOperationalStates.map(state => (
                            <SelectItem key={state} value={state}>
                              {state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
                <LayerManager layers={layers} onToggleLayer={handleToggleLayer} />
                <CameraControlsPanel presets={cameraPresets} onSetView={handleSetCameraView} />
              </div>
            </ScrollArea>
          </SidebarContent>
          <Separator />
          <SidebarFooter className="p-4">
             <p className="text-xs text-muted-foreground">2025 Terminal 3D</p>
          </SidebarFooter>
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


    