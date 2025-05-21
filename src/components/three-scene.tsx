"use client";

import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Equipment, Layer, CameraState } from '@/lib/types';

interface ThreeSceneProps {
  equipment: Equipment[];
  layers: Layer[];
  selectedEquipmentId: string | null;
  onSelectEquipment: (equipmentId: string | null) => void;
  cameraState?: CameraState; // For programmatic camera setting
  onCameraChange?: (cameraState: CameraState) => void; // To report camera changes for undo/redo
  initialCameraPosition?: { x: number; y: number; z: number };
}

const ThreeScene: React.FC<ThreeSceneProps> = ({
  equipment,
  layers,
  selectedEquipmentId,
  onSelectEquipment,
  cameraState: programmaticCameraState,
  onCameraChange,
  initialCameraPosition = { x: 15, y: 15, z: 15 },
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const equipmentMeshesRef = useRef<THREE.Mesh[]>([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  const createEquipmentMesh = useCallback((item: Equipment): THREE.Mesh => {
    let geometry: THREE.BufferGeometry;
    const material = new THREE.MeshStandardMaterial({ color: item.color, metalness: 0.3, roughness: 0.6 });

    switch (item.type) {
      case 'Building':
        geometry = new THREE.BoxGeometry(item.size?.width || 5, item.size?.height || 5, item.size?.depth || 5);
        break;
      case 'Crane': // Simple representation for a crane
        const craneGroup = new THREE.Group();
        const craneBase = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, item.size?.height || 8, 16), material);
        craneBase.position.y = (item.size?.height || 8) / 2;
        const craneArm = new THREE.Mesh(new THREE.BoxGeometry(item.size?.width || 6, 0.5, 0.5), material);
        craneArm.position.set((item.size?.width || 6)/2 - 0.5, (item.size?.height || 8) - 0.25, 0);
        craneGroup.add(craneBase);
        craneGroup.add(craneArm);
        // For simplicity, we'll return a group as a mesh. For selection, we might need to adjust.
        // This example uses a simple box instead for easier selection handling.
        geometry = new THREE.BoxGeometry(item.size?.width || 3, item.size?.height || 10, item.size?.depth || 3);
        break;
      case 'Tank':
        geometry = new THREE.CylinderGeometry(item.radius || 2, item.radius || 2, item.height || 4, 32);
        break;
      default: // Fallback, e.g. for Terrain if it were a mesh
        geometry = new THREE.SphereGeometry(item.radius || 1, 16, 16);
    }
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(item.position.x, item.position.y + (item.size?.height || item.height || (item.radius || 1)*2)/2, item.position.z);
    mesh.userData = { id: item.id, type: item.type }; // Store ID for raycasting
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene
    sceneRef.current = new THREE.Scene();
    sceneRef.current.background = new THREE.Color(0x2B3035); // Match CSS background

    // Camera
    cameraRef.current = new THREE.PerspectiveCamera(75, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
    cameraRef.current.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);
    
    // Renderer
    rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    rendererRef.current.shadowMap.enabled = true;
    mountRef.current.appendChild(rendererRef.current.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    sceneRef.current.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;    
    sceneRef.current.add(directionalLight);

    // Controls
    controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
    controlsRef.current.enableDamping = true;
    controlsRef.current.target.set(0, 0, 0); // Default lookAt

    // Ground Plane
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, side: THREE.DoubleSide, metalness: 0.1, roughness: 0.8 });
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    sceneRef.current.add(groundMesh);

    // Resize listener
    const handleResize = () => {
      if (mountRef.current && cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();
    
    // Click listener for selection
    const handleClick = (event: MouseEvent) => {
        if (!mountRef.current || !cameraRef.current || !sceneRef.current) return;

        const rect = mountRef.current.getBoundingClientRect();
        mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
        const intersects = raycasterRef.current.intersectObjects(equipmentMeshesRef.current);

        if (intersects.length > 0) {
            const selectedObject = intersects[0].object;
            onSelectEquipment(selectedObject.userData.id);
        } else {
            onSelectEquipment(null);
        }
    };
    mountRef.current.addEventListener('click', handleClick);
    
    // OrbitControls change listener for undo/redo
    const handleControlsChangeEnd = () => {
      if (cameraRef.current && controlsRef.current && onCameraChange) {
        onCameraChange({
          position: cameraRef.current.position.clone().toArray(),
          lookAt: controlsRef.current.target.clone().toArray(),
        } as unknown as CameraState); // Casting for simplicity
      }
    };
    if (controlsRef.current && onCameraChange) {
      controlsRef.current.addEventListener('end', handleControlsChangeEnd);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && rendererRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        mountRef.current.removeEventListener('click', handleClick);
        // eslint-disable-next-line react-hooks/exhaustive-deps
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      if (controlsRef.current && onCameraChange) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        controlsRef.current.removeEventListener('end', handleControlsChangeEnd);
      }
      if (sceneRef.current) {
        sceneRef.current.traverse(object => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        });
      }
      if (rendererRef.current) rendererRef.current.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSelectEquipment, onCameraChange, initialCameraPosition]);


  // Update equipment meshes
  useEffect(() => {
    if (!sceneRef.current) return;

    // Clear old meshes
    equipmentMeshesRef.current.forEach(mesh => sceneRef.current?.remove(mesh));
    equipmentMeshesRef.current = [];

    // Add new/updated meshes
    const visibleLayers = layers.filter(l => l.isVisible);
    equipment.forEach(item => {
      const itemLayer = visibleLayers.find(l => l.equipmentType === item.type || l.equipmentType === 'All');
      if (itemLayer) {
        const mesh = createEquipmentMesh(item);
        sceneRef.current?.add(mesh);
        equipmentMeshesRef.current.push(mesh);
      }
    });
  }, [equipment, layers, createEquipmentMesh]);

  // Highlight selected equipment
  useEffect(() => {
    equipmentMeshesRef.current.forEach(mesh => {
      if (mesh.userData.id === selectedEquipmentId) {
        (mesh.material as THREE.MeshStandardMaterial).emissive?.setHex(0xBE29FF); // Accent color for selection
      } else {
        (mesh.material as THREE.MeshStandardMaterial).emissive?.setHex(0x000000);
      }
    });
  }, [selectedEquipmentId]);

  // Programmatic camera updates
  useEffect(() => {
    if (programmaticCameraState && cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(programmaticCameraState.position.x, programmaticCameraState.position.y, programmaticCameraState.position.z);
      controlsRef.current.target.set(programmaticCameraState.lookAt.x, programmaticCameraState.lookAt.y, programmaticCameraState.lookAt.z);
      controlsRef.current.update();
    }
  }, [programmaticCameraState]);


  return <div ref={mountRef} className="w-full h-full" />;
};

export default ThreeScene;
