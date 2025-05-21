
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
  const equipmentMeshesRef = useRef<THREE.Object3D[]>([]); // Can be Mesh or Group
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  const createEquipmentMesh = useCallback((item: Equipment): THREE.Object3D => {
    let geometry: THREE.BufferGeometry;
    const material = new THREE.MeshStandardMaterial({ color: item.color, metalness: 0.3, roughness: 0.6 });
    let mesh: THREE.Mesh;
    let yPosOffset = 0;

    switch (item.type) {
      case 'Building':
        geometry = new THREE.BoxGeometry(item.size?.width || 5, item.size?.height || 5, item.size?.depth || 5);
        yPosOffset = (item.size?.height || 5) / 2;
        mesh = new THREE.Mesh(geometry, material);
        break;
      case 'Crane': 
        // Simplified crane representation
        geometry = new THREE.BoxGeometry(item.size?.width || 3, item.size?.height || 10, item.size?.depth || 3);
        yPosOffset = (item.size?.height || 10) / 2;
        mesh = new THREE.Mesh(geometry, material);
        break;
      case 'Tank':
        geometry = new THREE.CylinderGeometry(item.radius || 2, item.radius || 2, item.height || 4, 32);
        yPosOffset = (item.height || 4) / 2;
        mesh = new THREE.Mesh(geometry, material);
        break;
      case 'Pipe':
        geometry = new THREE.CylinderGeometry(item.radius || 0.2, item.radius || 0.2, item.height || 5, 16);
        // For pipes, position.y is the center if not rotated, or the base if it's meant to be vertical by default.
        // If item.position.y is the intended start/base, and height is its length:
        yPosOffset = (item.height || 5) / 2; 
        // If item.position is the center of the pipe, yPosOffset would be 0 before rotation.
        // Sticking to the convention: item.position is the 'bottom-center' before rotations.
        mesh = new THREE.Mesh(geometry, material);
        break;
      case 'Valve':
        geometry = new THREE.SphereGeometry(item.radius || 0.3, 16, 16);
        yPosOffset = (item.radius || 0.3); // So the bottom of the sphere is at item.position.y
        mesh = new THREE.Mesh(geometry, material);
        break;
      default: 
        geometry = new THREE.SphereGeometry(item.radius || 1, 16, 16);
        yPosOffset = (item.radius || 1);
        mesh = new THREE.Mesh(geometry, material);
    }
    
    mesh.position.set(item.position.x, item.position.y + yPosOffset, item.position.z);
    
    if (item.rotation) {
      // Note: THREE.js applies rotations in XYZ order.
      // If a pipe (cylinder) is created vertically along Y, and we want it horizontal along X:
      // Rotate around Z by PI/2. Then its "height" (length) extends along X.
      // If we want it horizontal along Z:
      // Rotate around X by PI/2. Then its "height" (length) extends along Z.
      // The 'position' is applied first, then rotation.
      mesh.rotation.set(item.rotation.x, item.rotation.y, item.rotation.z);
    }

    mesh.userData = { id: item.id, type: item.type };
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;

    sceneRef.current = new THREE.Scene();
    sceneRef.current.background = new THREE.Color(0x2B3035); 

    cameraRef.current = new THREE.PerspectiveCamera(75, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
    cameraRef.current.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);
    
    rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    rendererRef.current.shadowMap.enabled = true;
    mountRef.current.appendChild(rendererRef.current.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    sceneRef.current.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(10, 15, 10); // Adjusted light position
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048; // Higher res shadow map
    directionalLight.shadow.mapSize.height = 2048;    
    directionalLight.shadow.camera.near = 0.5;    
    directionalLight.shadow.camera.far = 50;   
    directionalLight.shadow.camera.left = -25;
    directionalLight.shadow.camera.right = 25;
    directionalLight.shadow.camera.top = 25;
    directionalLight.shadow.camera.bottom = -25;
    sceneRef.current.add(directionalLight);
    // sceneRef.current.add(new THREE.CameraHelper(directionalLight.shadow.camera)); // For debugging shadow camera

    controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
    controlsRef.current.enableDamping = true;
    controlsRef.current.target.set(0, 2, 0); // Default lookAt, slightly above ground

    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x37474F, side: THREE.DoubleSide, metalness: 0.1, roughness: 0.8 }); // Darker ground
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    sceneRef.current.add(groundMesh);

    const handleResize = () => {
      if (mountRef.current && cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    const animate = () => {
      requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();
    
    const handleClick = (event: MouseEvent) => {
        if (!mountRef.current || !cameraRef.current || !sceneRef.current) return;

        const rect = mountRef.current.getBoundingClientRect();
        mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
        // Intersect with all potentially selectable objects
        const intersects = raycasterRef.current.intersectObjects(equipmentMeshesRef.current, true); // true for recursive if using groups

        if (intersects.length > 0) {
            let selectedObject = intersects[0].object;
            // If the intersected object is part of a group, traverse up to find the main equipment object with userData.id
            while (selectedObject.parent && !selectedObject.userData.id) {
              if (selectedObject.parent instanceof THREE.Scene) break; // Stop if we reach the scene itself
              selectedObject = selectedObject.parent;
            }
            if (selectedObject.userData.id) {
              onSelectEquipment(selectedObject.userData.id);
            } else {
              onSelectEquipment(null); // Clicked on something, but not a recognized equipment part
            }
        } else {
            onSelectEquipment(null);
        }
    };
    mountRef.current.addEventListener('click', handleClick);
    
    const handleControlsChangeEnd = () => {
      if (cameraRef.current && controlsRef.current && onCameraChange) {
        onCameraChange({
          position: cameraRef.current.position.clone(),
          lookAt: controlsRef.current.target.clone(),
        });
      }
    };
    if (controlsRef.current && onCameraChange) {
      controlsRef.current.addEventListener('end', handleControlsChangeEnd);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && rendererRef.current) {
        mountRef.current.removeEventListener('click', handleClick);
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      if (controlsRef.current && onCameraChange) {
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
  }, [onSelectEquipment, onCameraChange, initialCameraPosition]); // createEquipmentMesh removed from deps as it's stable

  useEffect(() => {
    if (!sceneRef.current) return;

    equipmentMeshesRef.current.forEach(obj => sceneRef.current?.remove(obj));
    equipmentMeshesRef.current = [];

    const visibleLayers = layers.filter(l => l.isVisible);
    equipment.forEach(item => {
      const itemLayer = visibleLayers.find(l => l.equipmentType === item.type || l.equipmentType === 'All');
      if (itemLayer) {
        const obj = createEquipmentMesh(item);
        sceneRef.current?.add(obj);
        equipmentMeshesRef.current.push(obj);
      }
    });
  }, [equipment, layers, createEquipmentMesh]);

  useEffect(() => {
    equipmentMeshesRef.current.forEach(obj => {
      // Check if obj is a Mesh directly, or if it's a Group, iterate its children if needed for highlighting
      // For simplicity, assuming obj itself is what we want to change material properties on
      if (obj instanceof THREE.Mesh) { // Or THREE.Group, then iterate children or highlight group
         const mesh = obj as THREE.Mesh; // Cast for material access
         if (mesh.userData.id === selectedEquipmentId) {
            (mesh.material as THREE.MeshStandardMaterial).emissive?.setHex(0xBE29FF); 
          } else {
            (mesh.material as THREE.MeshStandardMaterial).emissive?.setHex(0x000000);
          }
      } else if (obj instanceof THREE.Group) {
        // If equipment can be groups, decide how to highlight (e.g., all children or a specific part)
        // For now, let's assume selection might target children, and highlight based on the group's ID.
        // This part needs refinement if complex groups are primary selectable targets.
        // For now, if the group itself has the ID:
        if (obj.userData.id === selectedEquipmentId) {
            obj.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    (child.material as THREE.MeshStandardMaterial).emissive?.setHex(0xBE29FF);
                }
            });
        } else {
             obj.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    (child.material as THREE.MeshStandardMaterial).emissive?.setHex(0x000000);
                }
            });
        }
      }
    });
  }, [selectedEquipmentId]);

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
