export interface Equipment {
  id: string;
  name: string;
  type: 'Building' | 'Crane' | 'Tank' | 'Terrain';
  position: { x: number; y: number; z: number };
  size?: { width: number; height: number; depth: number }; // For boxes
  radius?: number; // For spheres/cylinders
  height?: number; // For cylinders
  color: string;
  details: string;
}

export interface Layer {
  id: string;
  name: string;
  equipmentType: Equipment['type'] | 'All'; // Allows filtering by specific types or showing all
  isVisible: boolean;
}

export interface CameraState {
  position: { x: number; y: number; z: number };
  lookAt: { x: number; y: number; z: number };
}

export interface Command {
  id: string;
  type: 'CAMERA_MOVE' | 'LAYER_VISIBILITY' | 'EQUIPMENT_SELECT';
  execute: () => void;
  undo: () => void;
  description: string; // For display in UI if needed
}

export interface PresetCameraView {
  name: string;
  position: { x: number; y: number; z: number };
  lookAt: { x: number; y: number; z: number };
}
