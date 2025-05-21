
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
  cameraState?: CameraState; 
  onCameraChange?: (cameraState: CameraState) => void; 
  initialCameraPosition: { x: number; y: number; z: number };
  initialCameraLookAt: { x: number; y: number; z: number };
}

const ThreeScene: React.FC<ThreeSceneProps> = ({
  equipment,
  layers,
  selectedEquipmentId,
  onSelectEquipment,
  cameraState: programmaticCameraState,
  onCameraChange,
  initialCameraPosition,
  initialCameraLookAt,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const equipmentMeshesRef = useRef<THREE.Object3D[]>([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  // Refs for callbacks to avoid re-running main useEffect
  const onSelectEquipmentRef = useRef(onSelectEquipment);
  const onCameraChangeRef = useRef(onCameraChange);

  useEffect(() => {
    onSelectEquipmentRef.current = onSelectEquipment;
  }, [onSelectEquipment]);

  useEffect(() => {
    onCameraChangeRef.current = onCameraChange;
  }, [onCameraChange]);

  const createEquipmentMesh = useCallback((item: Equipment): THREE.Object3D => {
    let geometry: THREE.BufferGeometry;
    const material = new THREE.MeshStandardMaterial({ color: item.color, metalness: 0.3, roughness: 0.6 });
    let mesh: THREE.Mesh;

    switch (item.type) {
      case 'Building':
        geometry = new THREE.BoxGeometry(item.size?.width || 5, item.size?.height || 5, item.size?.depth || 5);
        mesh = new THREE.Mesh(geometry, material);
        break;
      case 'Crane': 
        geometry = new THREE.BoxGeometry(item.size?.width || 3, item.size?.height || 10, item.size?.depth || 3);
        mesh = new THREE.Mesh(geometry, material);
        break;
      case 'Tank':
        geometry = new THREE.CylinderGeometry(item.radius || 2, item.radius || 2, item.height || 4, 32);
        mesh = new THREE.Mesh(geometry, material);
        break;
      case 'Pipe':
        geometry = new THREE.CylinderGeometry(item.radius || 0.2, item.radius || 0.2, item.height || 5, 16);
        mesh = new THREE.Mesh(geometry, material);
        break;
      case 'Valve':
        geometry = new THREE.SphereGeometry(item.radius || 0.3, 16, 16);
        mesh = new THREE.Mesh(geometry, material);
        break;
      default: 
        geometry = new THREE.SphereGeometry(1, 16, 16); 
        mesh = new THREE.Mesh(geometry, material);
    }
    
    mesh.position.set(item.position.x, item.position.y, item.position.z);
    
    if (item.rotation) {
      mesh.rotation.set(item.rotation.x, item.rotation.y, item.rotation.z);
    }

    mesh.userData = { id: item.id, type: item.type };
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }, []);

  // Main scene setup - runs ONCE on mount
  useEffect(() => {
    if (!mountRef.current || rendererRef.current) {
        // If mount point doesn't exist or renderer is already initialized, bail out
        return;
    }
    const currentMount = mountRef.current;

    sceneRef.current = new THREE.Scene();
    sceneRef.current.background = new THREE.Color(0x2B3035); 

    cameraRef.current = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    cameraRef.current.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);
    
    rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current.setSize(currentMount.clientWidth, currentMount.clientHeight);
    rendererRef.current.shadowMap.enabled = true;
    currentMount.appendChild(rendererRef.current.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    sceneRef.current.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(10, 15, 10); 
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048; 
    directionalLight.shadow.mapSize.height = 2048;    
    directionalLight.shadow.camera.near = 0.5;    
    directionalLight.shadow.camera.far = 50;   
    directionalLight.shadow.camera.left = -25;
    directionalLight.shadow.camera.right = 25;
    directionalLight.shadow.camera.top = 25;
    directionalLight.shadow.camera.bottom = -25;
    sceneRef.current.add(directionalLight);

    controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
    controlsRef.current.enableDamping = true;
    controlsRef.current.target.set(initialCameraLookAt.x, initialCameraLookAt.y, initialCameraLookAt.z);
    controlsRef.current.update();

    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x37474F, side: THREE.DoubleSide, metalness: 0.1, roughness: 0.8 });
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = 0; // Ground plane at y=0
    groundMesh.receiveShadow = true;
    sceneRef.current.add(groundMesh);
    
    const handleResize = () => {
      if (mountRef.current && cameraRef.current && rendererRef.current) {
        const width = Math.max(1, mountRef.current.clientWidth); // Safeguard
        const height = Math.max(1, mountRef.current.clientHeight); // Safeguard

        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(width, height);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Call once initially to set size

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();
    
    const handleClick = (event: MouseEvent) => {
        if (!mountRef.current || !cameraRef.current || !sceneRef.current) return;
        const currentMountForClick = mountRef.current; 

        const rect = currentMountForClick.getBoundingClientRect();
        mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
        const intersects = raycasterRef.current.intersectObjects(equipmentMeshesRef.current, true); 

        if (intersects.length > 0) {
            let selectedObject = intersects[0].object;
            while (selectedObject.parent && !selectedObject.userData.id) {
              if (selectedObject.parent instanceof THREE.Scene) break; 
              selectedObject = selectedObject.parent;
            }
            if (selectedObject.userData.id) {
              onSelectEquipmentRef.current(selectedObject.userData.id);
            } else {
              onSelectEquipmentRef.current(null); 
            }
        } else {
            onSelectEquipmentRef.current(null);
        }
    };
    currentMount.addEventListener('click', handleClick);
    
    const handleControlsChangeEnd = () => {
      if (cameraRef.current && controlsRef.current && onCameraChangeRef.current) {
        onCameraChangeRef.current({
          position: cameraRef.current.position.clone(),
          lookAt: controlsRef.current.target.clone(),
        });
      }
    };
    if (controlsRef.current && onCameraChangeRef.current) { 
      controlsRef.current.addEventListener('end', handleControlsChangeEnd);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (currentMount && rendererRef.current?.domElement) {
        currentMount.removeEventListener('click', handleClick);
        if (rendererRef.current.domElement.parentNode === currentMount) {
           currentMount.removeChild(rendererRef.current.domElement);
        }
      }
      if (controlsRef.current) {
        controlsRef.current.removeEventListener('end', handleControlsChangeEnd);
        controlsRef.current.dispose();
      }
      equipmentMeshesRef.current.forEach(obj => {
        sceneRef.current?.remove(obj);
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach(material => material.dispose());
          } else if (obj.material) {
            (obj.material as THREE.Material).dispose();
          }
        } else if (obj instanceof THREE.Group) {
          obj.traverse(child => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              if (Array.isArray(child.material)) {
                child.material.forEach(material => material.dispose());
              } else if (child.material) {
                (child.material as THREE.Material).dispose();
              }
            }
          });
        }
      });
      equipmentMeshesRef.current = [];

      if (sceneRef.current) {
        if (ambientLight) sceneRef.current.remove(ambientLight);
        if (directionalLight) sceneRef.current.remove(directionalLight);
        if (groundMesh) {
            sceneRef.current.remove(groundMesh);
            groundMesh.geometry.dispose();
            if (groundMesh.material instanceof THREE.Material) groundMesh.material.dispose();
            else if (Array.isArray(groundMesh.material)) groundMesh.material.forEach(m => m.dispose());
        }
      }
      
      rendererRef.current?.dispose();
      
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
    };
  }, []); // Empty dependency array: runs once on mount, cleans up on unmount

  // Update equipment meshes when equipment or layers change
  useEffect(() => {
    if (!sceneRef.current) return;

    equipmentMeshesRef.current.forEach(obj => {
        sceneRef.current?.remove(obj); 
        if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            if (Array.isArray(obj.material)) {
                obj.material.forEach(material => material.dispose());
            } else if (obj.material) { 
                (obj.material as THREE.Material).dispose();
            }
        } else if (obj instanceof THREE.Group) {
            obj.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => material.dispose());
                    } else if (child.material) { 
                        (child.material as THREE.Material).dispose();
                    }
                }
            });
        }
    });
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

  // Highlight selected equipment
  useEffect(() => {
    equipmentMeshesRef.current.forEach(obj => {
      const applyEmissive = (mesh: THREE.Mesh, apply: boolean) => {
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          mesh.material.emissive.setHex(apply ? 0xBE29FF : 0x000000); 
        }
      };

      let isSelected = false;
      if (obj.userData.id === selectedEquipmentId) {
          isSelected = true;
      }

      if (obj instanceof THREE.Mesh) {
        applyEmissive(obj, isSelected);
      } else if (obj instanceof THREE.Group) {
        obj.traverse(child => { 
          if (child instanceof THREE.Mesh) {
            applyEmissive(child, isSelected);
          }
        });
      }
    });
  }, [selectedEquipmentId]);

  // Handle programmatic camera state changes (e.g., presets)
  useEffect(() => {
    if (programmaticCameraState && cameraRef.current && controlsRef.current) {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      
      const targetPosition = new THREE.Vector3(programmaticCameraState.position.x, programmaticCameraState.position.y, programmaticCameraState.position.z);
      const targetLookAt = programmaticCameraState.lookAt ? new THREE.Vector3(programmaticCameraState.lookAt.x, programmaticCameraState.lookAt.y, programmaticCameraState.lookAt.z) : controls.target.clone();

      const positionChanged = !camera.position.equals(targetPosition);
      const lookAtChanged = !controls.target.equals(targetLookAt);

      if (positionChanged || lookAtChanged) {
        const oldControlsEnabled = controls.enabled;
        controls.enabled = false; 

        if (positionChanged) {
            camera.position.copy(targetPosition);
        }
        if (lookAtChanged) {
            controls.target.copy(targetLookAt);
        }
        
        controls.update(); 
        controls.enabled = oldControlsEnabled;
      }
    }
  }, [programmaticCameraState]);


  return <div ref={mountRef} className="w-full h-full" />;
};

export default ThreeScene;
