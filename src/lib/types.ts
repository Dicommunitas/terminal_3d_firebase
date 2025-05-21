
export interface Equipment {
  id: string;
  name: string;
  type: 'Building' | 'Crane' | 'Tank' | 'Terrain' | 'Pipe' | 'Valve';
  sistema?: string;
  area?: string;
  operationalState?: string;
  product?: string; // Added product attribute
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  size?: { width: number; height: number; depth: number };
  radius?: number;
  height?: number;
  color: string;
  details: string;
}

export interface Layer {
  id: string;
  name: string;
  equipmentType: Equipment['type'] | 'All' | 'Annotations';
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
  description: string;
}

export interface PresetCameraView {
  name: string;
  position: { x: number; y: number; z: number };
  lookAt: { x: number; y: number; z: number };
}

export interface Annotation {
  equipmentId: string;
  text: string;
  createdAt: string;
}
