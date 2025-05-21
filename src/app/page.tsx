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
  { id: 'bldg-01', name: 'Main Office', type: 'Building', position: { x: -10, y: 0, z: -5 }, size: { width: 8, height: 6, depth: 10 }, color: '#888888', details: 'Primary administrative building.' },
  { id: 'bldg-02', name: 'Warehouse A', type: 'Building', position: { x: 10, y: 0, z: -8 }, size: { width: 15, height: 8, depth: 12 }, color: '#888888', details: 'Storage for dry goods.' },
  { id: 'crane-01', name: 'Gantry Crane 1', type: 'Crane', position: { x: 0, y: 0, z: 5 }, size: { width: 12, height: 10, depth: 2 }, color: '#FFA500', details: 'Heavy lift gantry crane.' },
  { id: 'tank-01', name: 'Storage Tank Alpha', type: 'Tank', position: { x: -5, y: 0, z: 10 }, radius: 3, height: 5, color: '#0077FF', details: 'Liquid storage tank.' },
  { id: 'tank-02', name: 'Storage Tank Beta', type: 'Tank', position: { x: 5, y: 0, z: 12 }, radius: 2.5, height: 4, color: '#00AAFF', details: 'Auxiliary liquid storage.' },
];

const initialLayers: Layer[] = [
  { id: 'layer-buildings', name: 'Buildings', equipmentType: 'Building', isVisible: true },
  { id: 'layer-cranes', name: 'Cranes', equipmentType: 'Crane', isVisible: true },
  { id: 'layer-tanks', name: 'Tanks', equipmentType: 'Tank', isVisible: true },
];

const cameraPresets: PresetCameraView[] = [
  { name: 'Overview', position: { x: 25, y: 20, z: 25 }, lookAt: { x: 0, y: 2, z: 0 } },
  { name: 'Crane Area', position: { x: 0, y: 8, z: 15 }, lookAt: { x: 0, y: 5, z: 5 } },
  { name: 'Tank Farm', position: { x: 0, y: 10, z: 20 }, lookAt: { x: 0, y: 2, z: 10 } },
];


export default function Terminal3DPage() {
  const [equipment, setEquipment] = useState<Equipment[]>(initialEquipment);
  const [layers, setLayers] = useState<Layer[]>(initialLayers);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [currentCameraState, setCurrentCameraState] = useState<CameraState | undefined>(cameraPresets[0]); // Initialize with overview
  const { toast } = useToast();

  const { executeCommand, undo, redo, canUndo, canRedo } = useCommandHistory();

  const handleSelectEquipment = useCallback((equipmentId: string | null) => {
    // This interaction might not need undo/redo, or could be a simple command
    setSelectedEquipmentId(equipmentId);
     if (equipmentId) {
      const item = equipment.find(e => e.id === equipmentId);
      toast({ title: "Selected", description: `${item?.name || 'Equipment'} selected.` });
    }
  }, [equipment, toast]);

  const handleToggleLayer = useCallback((layerId: string) => {
    const layerIndex = layers.findIndex(l => l.id === layerId);
    if (layerIndex === -1) return;

    const oldLayers = [...layers];
    const newLayers = oldLayers.map(l => l.id === layerId ? { ...l, isVisible: !l.isVisible } : l);
    
    const command: Command = {
      id: `toggle-layer-${layerId}-${Date.now()}`,
      type: 'LAYER_VISIBILITY',
      description: `Toggle layer ${layers[layerIndex].name}`,
      execute: () => setLayers(newLayers),
      undo: () => setLayers(oldLayers),
    };
    executeCommand(command);
  }, [layers, executeCommand]);

  const handleSetCameraView = useCallback((view: PresetCameraView) => {
    const oldCameraState = { ...currentCameraState } as CameraState; // clone or ensure it's a new object
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
    // This is called by OrbitControls 'end' event
    // Debounce or check if significantly different to avoid flooding history
    const oldCameraState = { ...currentCameraState } as CameraState;

    // Check if camera state actually changed significantly to avoid spamming history
    // For simplicity, we'll assume any 'end' event is a meaningful change
    // In a real app, add a threshold check here.

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
          
          <SidebarInset className="flex-1 relative bg-muted/20">
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
            />
            <InfoPanel equipment={selectedEquipmentDetails} onClose={() => handleSelectEquipment(null)} />
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}
