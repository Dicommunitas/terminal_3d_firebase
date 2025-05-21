
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
        geometry = new THREE.SphereGeometry(1, 16, 16); // Fallback
        mesh = new THREE.Mesh(geometry, material);
    }

    // Position is the geometric center of the object
    mesh.position.set(item.position.x, item.position.y, item.position.z);

    if (item.rotation) {
      mesh.rotation.set(item.rotation.x, item.rotation.y, item.rotation.z);
    }

    mesh.userData = { id: item.id, type: item.type };
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }, []);

  const handleResize = useCallback(() => {
    if (mountRef.current && cameraRef.current && rendererRef.current) {
      const width = Math.max(1, mountRef.current.clientWidth);
      const height = Math.max(1, mountRef.current.clientHeight);
      console.log(`[ThreeScene] handleResize CALLED. New dimensions: ${width}x${height}`);
      if (cameraRef.current.aspect !== width / height) {
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
      }
      rendererRef.current.setSize(width, height);
    } else {
      console.log('[ThreeScene] handleResize: refs not ready.');
    }
  }, []); // Empty dependency array as refs are stable

  useEffect(() => {
    console.log('[ThreeScene] Main setup useEffect RUNNING');
    if (!mountRef.current || rendererRef.current) {
      console.log('[ThreeScene] Main setup: mountRef.current missing or renderer already initialized. Bailing.');
      return;
    }
    const currentMount = mountRef.current;
    console.log(`[ThreeScene] Mount dimensions AT START of useEffect: ${currentMount.clientWidth}x${currentMount.clientHeight}`);

    sceneRef.current = new THREE.Scene();
    sceneRef.current.background = new THREE.Color(0x2B3035);
    console.log('[ThreeScene] Scene created');

    // Initialize camera with temporary aspect ratio, will be corrected by handleResize
    cameraRef.current = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    cameraRef.current.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);
    console.log('[ThreeScene] Camera created at:', cameraRef.current.position);

    rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current.shadowMap.enabled = true;
    
    // Append renderer's DOM element to the mount point *before* first resize
    currentMount.appendChild(rendererRef.current.domElement);
    console.log('[ThreeScene] Renderer DOM element appended.');

    // Initial resize attempt
    console.log(`[ThreeScene] Attempting initial resize. Mount dimensions BEFORE first handleResize: ${currentMount.clientWidth}x${currentMount.clientHeight}`);
    handleResize(); // Attempt 1: immediate

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    sceneRef.current.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    // ... (shadow camera settings)
    sceneRef.current.add(directionalLight);
    console.log('[ThreeScene] Lights added');

    controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
    controlsRef.current.enableDamping = true;
    controlsRef.current.target.set(initialCameraLookAt.x, initialCameraLookAt.y, initialCameraLookAt.z);
    controlsRef.current.update();
    console.log('[ThreeScene] OrbitControls created, target:', controlsRef.current.target);

    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x37474F, side: THREE.DoubleSide, metalness: 0.1, roughness: 0.8 });
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = 0; // Ground at y=0
    groundMesh.receiveShadow = true;
    sceneRef.current.add(groundMesh);
    console.log('[ThreeScene] Ground plane added');

    window.addEventListener('resize', handleResize);

    // Delayed resize attempt
    const resizeTimeoutId = setTimeout(() => {
      console.log(`[ThreeScene] Attempting DELAYED resize. Mount dimensions BEFORE delayed handleResize: ${currentMount.clientWidth}x${currentMount.clientHeight}`);
      handleResize(); // Attempt 2: delayed
    }, 150); // Slightly increased delay

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();
    console.log('[ThreeScene] Animation loop started');

    const handleClick = (event: MouseEvent) => {
      if (!mountRef.current || !cameraRef.current || !sceneRef.current) return;
      const currentMountForClick = mountRef.current;
      // console.log('[ThreeScene] Click detected'); // Can be noisy

      const rect = currentMountForClick.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(equipmentMeshesRef.current, true);
      // console.log('[ThreeScene] Raycaster intersects:', intersects.length); // Can be noisy

      if (intersects.length > 0) {
        let selectedObject = intersects[0].object;
        while (selectedObject.parent && !selectedObject.userData.id) {
          if (selectedObject.parent instanceof THREE.Scene) break;
          selectedObject = selectedObject.parent;
        }
        if (selectedObject.userData.id) {
          // console.log('[ThreeScene] Selected equipment ID:', selectedObject.userData.id);
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
        // console.log('[ThreeScene] OrbitControls change end. New camera state:', cameraRef.current.position, controlsRef.current.target);
        onCameraChangeRef.current({
          position: cameraRef.current.position.clone(),
          lookAt: controlsRef.current.target.clone(),
        });
      }
    };
    if (controlsRef.current && onCameraChangeRef.current) {
      controlsRef.current.addEventListener('end', handleControlsChangeEnd);
    }
    console.log('[ThreeScene] Main setup useEffect FINISHED');

    return () => {
      console.log('[ThreeScene] Cleanup function RUNNING');
      cancelAnimationFrame(animationFrameId);
      clearTimeout(resizeTimeoutId);
      window.removeEventListener('resize', handleResize);
      if (currentMount && rendererRef.current?.domElement) {
        currentMount.removeEventListener('click', handleClick);
        if (rendererRef.current.domElement.parentNode === currentMount) {
          currentMount.removeChild(rendererRef.current.domElement);
          console.log('[ThreeScene] Renderer DOM element removed');
        }
      }
      if (controlsRef.current) {
        controlsRef.current.removeEventListener('end', handleControlsChangeEnd);
        controlsRef.current.dispose();
        console.log('[ThreeScene] OrbitControls disposed');
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
      console.log('[ThreeScene] Equipment meshes disposed and cleared');

      if (sceneRef.current) { // Check if sceneRef.current exists before accessing children
        if (ambientLight) sceneRef.current.remove(ambientLight);
        if (directionalLight) sceneRef.current.remove(directionalLight);
        if (groundMesh) {
          sceneRef.current.remove(groundMesh);
          groundMesh.geometry.dispose();
          if (groundMesh.material instanceof THREE.Material) groundMesh.material.dispose();
        }
        console.log('[ThreeScene] Lights and ground disposed');
      }

      rendererRef.current?.dispose();
      console.log('[ThreeScene] Renderer disposed');

      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
      console.log('[ThreeScene] Refs nulled. Cleanup FINISHED.');
    };
  }, []); // CRITICAL: Empty dependency array ensures this runs only ONCE on mount

  useEffect(() => {
    if (!sceneRef.current) {
      // console.log('[ThreeScene] Update equipment: sceneRef.current is null. Bailing.');
      return;
    }
    console.log('[ThreeScene] Updating equipment. Current mesh count:', equipmentMeshesRef.current.length);

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
    // console.log('[ThreeScene] Old equipment meshes removed and disposed.');

    const visibleLayers = layers.filter(l => l.isVisible);
    // console.log('[ThreeScene] Visible layers:', visibleLayers.map(l => l.name));
    let addedCount = 0;
    equipment.forEach(item => {
      const itemLayer = visibleLayers.find(l => l.equipmentType === item.type || l.equipmentType === 'All');
      if (itemLayer) {
        const obj = createEquipmentMesh(item);
        sceneRef.current?.add(obj);
        equipmentMeshesRef.current.push(obj);
        addedCount++;
      }
    });
    console.log(`[ThreeScene] Added ${addedCount} new equipment meshes. Total scene children: ${sceneRef.current.children.length}`);
  }, [equipment, layers, createEquipmentMesh]);

  useEffect(() => {
    // console.log('[ThreeScene] Highlighting selected equipment. ID:', selectedEquipmentId);
    equipmentMeshesRef.current.forEach(obj => {
      const applyEmissive = (mesh: THREE.Mesh, apply: boolean) => {
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          mesh.material.emissive.setHex(apply ? 0xBE29FF : 0x000000); // Vivid Purple for selection
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

  useEffect(() => {
    if (programmaticCameraState && cameraRef.current && controlsRef.current) {
      // console.log('[ThreeScene] Programmatic camera update:', programmaticCameraState);
      const camera = cameraRef.current;
      const controls = controlsRef.current;

      const targetPosition = new THREE.Vector3(programmaticCameraState.position.x, programmaticCameraState.position.y, programmaticCameraState.position.z);
      const targetLookAt = programmaticCameraState.lookAt ? new THREE.Vector3(programmaticCameraState.lookAt.x, programmaticCameraState.lookAt.y, programmaticCameraState.lookAt.z) : controls.target.clone();

      const positionChanged = !camera.position.equals(targetPosition);
      const lookAtChanged = !controls.target.equals(targetLookAt);

      if (positionChanged || lookAtChanged) {
        // console.log('[ThreeScene] Applying programmatic camera change. Pos changed:', positionChanged, 'LookAt changed:', lookAtChanged);
        const oldControlsEnabled = controls.enabled;
        controls.enabled = false; // Disable controls during programmatic move

        if (positionChanged) {
          camera.position.copy(targetPosition);
        }
        if (lookAtChanged) {
          controls.target.copy(targetLookAt);
        }
        
        controls.update(); // Important to apply changes
        controls.enabled = oldControlsEnabled; // Re-enable controls
      } else {
        // console.log('[ThreeScene] Programmatic camera state is same as current, no change applied.');
      }
    }
  }, [programmaticCameraState]);

  return <div ref={mountRef} className="w-full h-full" />;
};

export default ThreeScene;
