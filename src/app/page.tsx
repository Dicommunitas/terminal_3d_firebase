
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Equipment, Layer, Command, CameraState, PresetCameraView } from '@/lib/types';
import { useCommandHistory } from '@/hooks/use-command-history';
import ThreeScene from '@/components/three-scene';
import { LayerManager } from '@/components/layer-manager';
import { CameraControlsPanel } from '@/components/camera-controls-panel';
import { InfoPanel } from '@/components/info-panel';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Undo2Icon, Redo2Icon, PanelLeftClose, PanelLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const initialEquipment: Equipment[] = [
  // Buildings (position.y is geometric center, assuming base is on y=0)
  { id: 'bldg-01', name: 'Main Office', type: 'Building', position: { x: -15, y: 3, z: -10 }, size: { width: 8, height: 6, depth: 10 }, color: '#78909C', details: 'Primary administrative building.' },
  { id: 'bldg-02', name: 'Warehouse A', type: 'Building', position: { x: 15, y: 4, z: -12 }, size: { width: 15, height: 8, depth: 12 }, color: '#78909C', details: 'Storage for dry goods.' },
  { id: 'bldg-03', name: 'Control Room', type: 'Building', position: { x: 0, y: 2, z: -15 }, size: { width: 6, height: 4, depth: 6 }, color: '#78909C', details: 'Central operations control.' },

  // Cranes (position.y is geometric center, assuming base is on y=0)
  { id: 'crane-01', name: 'Gantry Crane 1', type: 'Crane', position: { x: 0, y: 5, z: 8 }, size: { width: 12, height: 10, depth: 2 }, color: '#FF8A65', details: 'Heavy lift gantry crane over loading area.' },
  { id: 'crane-02', name: 'Jib Crane', type: 'Crane', position: { x: -10, y: 3.5, z: 5 }, size: { width: 1.5, height: 7, depth: 1.5 }, color: '#FFB74D', details: 'Small jib crane for workshop.' },
  
  // Tanks (position.y is geometric center, assuming base is on y=0)
  { id: 'tank-01', name: 'Storage Tank Alpha', type: 'Tank', position: { x: -8, y: 2.5, z: 12 }, radius: 3, height: 5, color: '#4FC3F7', details: 'Liquid storage tank for Product A.' },
  { id: 'tank-02', name: 'Storage Tank Beta', type: 'Tank', position: { x: -2, y: 2, z: 12 }, radius: 2.5, height: 4, color: '#4DD0E1', details: 'Auxiliary liquid storage for Product B.' },
  { id: 'tank-03', name: 'Process Tank Gamma', type: 'Tank', position: { x: 5, y: 3, z: 10 }, radius: 2, height: 6, color: '#4DB6AC', details: 'Processing tank.' },

  // Pipes (position.y is centerline)
  { id: 'pipe-01', name: 'Main Feed Pipe', type: 'Pipe', position: { x: -5, y: 1, z: 0 }, radius: 0.3, height: 10, color: '#B0BEC5', details: 'Connects Tank Alpha to Process Area.', rotation: { x: 0, y: 0, z: Math.PI / 2 } }, // Horizontal along X
  { id: 'pipe-02', name: 'Process Output Pipe', type: 'Pipe', position: { x: 0, y: 2.5, z: 5 }, radius: 0.2, height: 8, color: '#90A4AE', details: 'Carries product from Process Tank Gamma.', rotation: { x: Math.PI / 2, y: 0, z: 0 } }, // Horizontal along Z
  { id: 'pipe-03', name: 'Vertical Riser', type: 'Pipe', position: { x: 8, y: 3.5, z: 8 }, radius: 0.25, height: 7, color: '#B0BEC5', details: 'Vertical pipe section.' }, // Vertical

  // Valves (position.y is geometric center)
  { id: 'valve-01', name: 'Tank Alpha Outlet Valve', type: 'Valve', position: { x: -8, y: 0.5, z: 8.8 }, radius: 0.4, color: '#EF5350', details: 'Controls flow from Tank Alpha.' },
  { id: 'valve-02', name: 'Process Inlet Valve', type: 'Valve', position: { x: -1, y: 2.5, z: 5 }, radius: 0.3, color: '#F44336', details: 'Controls input to Process Tank Gamma.' },
  { id: 'valve-03', name: 'Safety Bypass Valve', type: 'Valve', position: { x: 8, y: 0.5, z: 4.5 }, radius: 0.3, color: '#E57373', details: 'Emergency bypass valve, adjusted y to ground.' },
];

const initialLayers: Layer[] = [
  { id: 'layer-buildings', name: 'Buildings', equipmentType: 'Building', isVisible: true },
  { id: 'layer-cranes', name: 'Cranes', equipmentType: 'Crane', isVisible: true },
  { id: 'layer-tanks', name: 'Tanks', equipmentType: 'Tank', isVisible: true },
  { id: 'layer-pipes', name: 'Pipes', equipmentType: 'Pipe', isVisible: true },
  { id: 'layer-valves', name: 'Valves', equipmentType: 'Valve', isVisible: true },
];

const cameraPresets: PresetCameraView[] = [
  { name: 'Overview', position: { x: 25, y: 20, z: 25 }, lookAt: { x: 0, y: 2, z: 0 } },
  { name: 'Crane Area', position: { x: 0, y: 8, z: 15 }, lookAt: { x: 0, y: 5, z: 5 } },
  { name: 'Tank Farm', position: { x: -5, y: 10, z: 20 }, lookAt: { x: -5, y: 2, z: 10 } },
  { name: 'Piping Detail', position: { x: -2, y: 5, z: 8 }, lookAt: { x: -2, y: 2, z: 0 } },
];


export default function Terminal3DPage() {
  const [equipmentData, setEquipmentData] = useState<Equipment[]>(initialEquipment); // Renamed for clarity if needed in future
  const [layers, setLayers] = useState<Layer[]>(initialLayers);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [currentCameraState, setCurrentCameraState] = useState<CameraState | undefined>(cameraPresets[0]);
  const { toast } = useToast();

  const { executeCommand, undo, redo, canUndo, canRedo } = useCommandHistory();

  const handleSelectEquipment = useCallback((equipmentId: string | null, isMultiSelectModifierPressed: boolean) => {
    const oldSelection = [...selectedEquipmentIds];
    let newSelection: string[];

    if (isMultiSelectModifierPressed) {
      if (equipmentId) {
        if (oldSelection.includes(equipmentId)) {
          newSelection = oldSelection.filter(id => id !== equipmentId); // Toggle off
        } else {
          newSelection = [...oldSelection, equipmentId]; // Add to selection
        }
      } else {
        // Clicked on empty space with modifier, maintain current selection
        newSelection = oldSelection; 
      }
    } else {
      if (equipmentId) {
        // Single select or re-selecting an item already in a multi-selection
        // If it's already the only selected item, keep it. Otherwise, make it the only selected item.
        if (oldSelection.includes(equipmentId) && oldSelection.length === 1) {
          newSelection = oldSelection;
        } else {
          newSelection = [equipmentId];
        }
      } else {
        newSelection = []; // Click on empty space, clear selection
      }
    }
    
    // Sort arrays before comparison to ensure order doesn't cause false positives
    const oldSelectionSorted = [...oldSelection].sort();
    const newSelectionSorted = [...newSelection].sort();

    if (JSON.stringify(oldSelectionSorted) === JSON.stringify(newSelectionSorted)) {
        return; // No actual change in selection
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
      const item = equipmentData.find(e => e.id === newSelection[0]);
      toast({ title: "Selected", description: `${item?.name || 'Equipment'} selected. ${newSelection.length} item(s) total.` });
    } else if (newSelection.length > 1) {
      toast({ title: "Selection Updated", description: `${newSelection.length} items selected.` });
    } else if (oldSelection.length > 0 && newSelection.length === 0) {
      toast({ title: "Selection Cleared" });
    }

  }, [selectedEquipmentIds, executeCommand, equipmentData, toast]);


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
      // Display details of the last selected item
      const lastSelectedId = selectedEquipmentIds[selectedEquipmentIds.length - 1];
      return equipmentData.find(e => e.id === lastSelectedId) || null;
    }
    return null;
  }, [selectedEquipmentIds, equipmentData]);

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="h-screen w-full relative bg-muted/20">
        <div className="absolute top-4 left-4 z-30">
          <SidebarTrigger asChild className="h-10 w-10 bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground rounded-md shadow-lg p-2">
            <PanelLeft />
          </SidebarTrigger>
        </div>

        <ThreeScene
          equipment={equipmentData}
          layers={layers}
          selectedEquipmentIds={selectedEquipmentIds}
          onSelectEquipment={handleSelectEquipment}
          cameraState={currentCameraState}
          onCameraChange={handleCameraChangeFromScene}
          initialCameraPosition={cameraPresets[0].position}
          initialCameraLookAt={cameraPresets[0].lookAt} 
        />
        <InfoPanel equipment={selectedEquipmentDetails} onClose={() => handleSelectEquipment(null, false)} />
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
    </SidebarProvider>
  );
}
    
    

    

    

    

    

    

    

