
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Equipment, Layer, Command, CameraState, PresetCameraView } from '@/lib/types';
import { useCommandHistory } from '@/hooks/use-command-history';
import ThreeScene from '@/components/three-scene';
import { LayerManager } from '@/components/layer-manager';
import { CameraControlsPanel } from '@/components/camera-controls-panel';
import { InfoPanel } from '@/components/info-panel';
import { CommandHistoryPanel } from '@/components/command-history-panel';
import { SiteHeader } from '@/components/site-header';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { PanelLeft, Settings2 } from 'lucide-react';
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
  { id: 'pipe-01', name: 'Main Feed Pipe', type: 'Pipe', position: { x: -5, y: 1, z: 0 }, radius: 0.3, height: 10, color: '#B0BEC5', details: 'Connects Tank Alpha to Process Area.', rotation: { x: 0, y: 0, z: Math.PI / 2 } }, // Horizontal along X, adjust z to be center
  { id: 'pipe-02', name: 'Process Output Pipe', type: 'Pipe', position: { x: 0, y: 2.5, z: 5 }, radius: 0.2, height: 8, color: '#90A4AE', details: 'Carries product from Process Tank Gamma.', rotation: { x: Math.PI / 2, y: 0, z: 0 } }, // Horizontal along Z, adjust x to be center
  { id: 'pipe-03', name: 'Vertical Riser', type: 'Pipe', position: { x: 8, y: 3.5, z: 8 }, radius: 0.25, height: 7, color: '#B0BEC5', details: 'Vertical pipe section.' }, // Vertical (base at y=0, so center is height/2)

  // Valves (position.y is geometric center)
  { id: 'valve-01', name: 'Tank Alpha Outlet Valve', type: 'Valve', position: { x: -8, y: 0.5, z: 8.8 }, radius: 0.4, color: '#EF5350', details: 'Controls flow from Tank Alpha.' },
  { id: 'valve-02', name: 'Process Inlet Valve', type: 'Valve', position: { x: -1, y: 2.5, z: 5 }, radius: 0.3, color: '#F44336', details: 'Controls input to Process Tank Gamma.' },
  { id: 'valve-03', name: 'Safety Bypass Valve', type: 'Valve', position: { x: 8, y: 3.5, z: 8 }, radius: 0.3, color: '#E57373', details: 'Emergency bypass valve.' },
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
  const [equipment, setEquipment] = useState<Equipment[]>(initialEquipment);
  const [layers, setLayers] = useState<Layer[]>(initialLayers);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [currentCameraState, setCurrentCameraState] = useState<CameraState | undefined>(cameraPresets[0]);
  const { toast } = useToast();

  const { executeCommand, undo, redo, canUndo, canRedo } = useCommandHistory();

  const handleSelectEquipment = useCallback((equipmentId: string | null) => {
    setSelectedEquipmentId(equipmentId);
     if (equipmentId) {
      const item = equipment.find(e => e.id === equipmentId);
      toast({ title: "Selected", description: `${item?.name || 'Equipment'} selected.` });
    }
  }, [toast, equipment]);

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
    return equipment.find(e => e.id === selectedEquipmentId) || null;
  }, [selectedEquipmentId, equipment]);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen flex-col bg-background">
        <SiteHeader />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar collapsible="icon" className="border-r">
             <div className="flex h-full flex-col">
                <SidebarHeader className="p-4 flex justify-between items-center">
                    <h2 className="text-xl font-semibold flex items-center">
                        <Settings2 className="mr-2 h-5 w-5"/> Controls
                    </h2>
                </SidebarHeader>
                <Separator />
                <SidebarContent className="p-0">
                  <ScrollArea className="h-full">
                    <div className="p-4 space-y-6">
                      <LayerManager layers={layers} onToggleLayer={handleToggleLayer} />
                      <CameraControlsPanel presets={cameraPresets} onSetView={handleSetCameraView} />
                      <CommandHistoryPanel canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} />
                    </div>
                  </ScrollArea>
                </SidebarContent>
                 <Separator />
                <SidebarFooter className="p-4">
                   <p className="text-xs text-muted-foreground">&copy; 2024 Terminal 3D</p>
                </SidebarFooter>
             </div>
          </Sidebar>
          
          <SidebarInset className="flex-1 relative bg-muted/20 min-w-0"> {/* Added min-w-0 here */}
            <div className="absolute top-2 left-2 z-10 md:hidden">
                 <SidebarTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <PanelLeft />
                         <span className="sr-only">Toggle Sidebar</span>
                    </Button>
                 </SidebarTrigger>
            </div>
            <ThreeScene
              equipment={equipment}
              layers={layers}
              selectedEquipmentId={selectedEquipmentId}
              onSelectEquipment={handleSelectEquipment}
              cameraState={currentCameraState}
              onCameraChange={handleCameraChangeFromScene}
              initialCameraPosition={cameraPresets[0].position}
              initialCameraLookAt={cameraPresets[0].lookAt} 
            />
            <InfoPanel equipment={selectedEquipmentDetails} onClose={() => handleSelectEquipment(null)} />
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}

    