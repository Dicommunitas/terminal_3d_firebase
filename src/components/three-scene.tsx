
"use client";

import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Equipment, Layer, CameraState, Annotation } from '@/lib/types';

interface ThreeSceneProps {
  equipment: Equipment[];
  layers: Layer[];
  annotations: Annotation[];
  selectedEquipmentIds: string[];
  onSelectEquipment: (equipmentId: string | null, isMultiSelectModifierPressed: boolean) => void;
  cameraState?: CameraState;
  onCameraChange?: (cameraState: CameraState) => void;
  initialCameraPosition: { x: number; y: number; z: number };
  initialCameraLookAt: { x: number; y: number; z: number };
}

const ThreeScene: React.FC<ThreeSceneProps> = ({
  equipment: filteredEquipmentData,
  layers,
  annotations,
  selectedEquipmentIds,
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
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const equipmentMeshesRef = useRef<THREE.Object3D[]>([]);
  const annotationPinObjectsRef = useRef<CSS2DObject[]>([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const groundMeshRef = useRef<THREE.Mesh | null>(null);

  const onSelectEquipmentRef = useRef(onSelectEquipment);
  const onCameraChangeRef = useRef(onCameraChange);

  const [hoveredEquipmentId, setHoveredEquipmentId] = useState<string | null>(null);
  const hoveredEquipmentIdRef = useRef(hoveredEquipmentId);

  useEffect(() => {
    hoveredEquipmentIdRef.current = hoveredEquipmentId;
  }, [hoveredEquipmentId]);

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

  const handleResize = useCallback(() => {
    if (mountRef.current && cameraRef.current && rendererRef.current && labelRendererRef.current) {
      const width = Math.max(1, mountRef.current.clientWidth);
      const height = Math.max(1, mountRef.current.clientHeight);

      if (cameraRef.current.aspect !== width / height && height > 0 && width > 0) {
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
      }
      if (width > 0 && height > 0) {
         rendererRef.current.setSize(width, height);
         labelRendererRef.current.setSize(width, height);
      }
    }
  }, []);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current || equipmentMeshesRef.current.length === 0) {
      if (hoveredEquipmentIdRef.current !== null) setHoveredEquipmentId(null);
      return;
    }

    const rect = mountRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(equipmentMeshesRef.current, true);

    let foundHoverId: string | null = null;
    if (intersects.length > 0) {
      let hoveredObjectCandidate = intersects[0].object;
      while (hoveredObjectCandidate.parent && !hoveredObjectCandidate.userData.id) {
        if (hoveredObjectCandidate.parent instanceof THREE.Scene) break;
        hoveredObjectCandidate = hoveredObjectCandidate.parent;
      }
      if (hoveredObjectCandidate.userData.id) {
        foundHoverId = hoveredObjectCandidate.userData.id;
      }
    }
    
    if (hoveredEquipmentIdRef.current !== foundHoverId) {
      setHoveredEquipmentId(foundHoverId);
    }
  }, []);


  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;

    sceneRef.current = new THREE.Scene();
    sceneRef.current.background = new THREE.Color(0x2B3035);

    cameraRef.current = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    cameraRef.current.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);
    
    rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current.shadowMap.enabled = true;
    currentMount.appendChild(rendererRef.current.domElement);

    labelRendererRef.current = new CSS2DRenderer();
    labelRendererRef.current.domElement.style.position = 'absolute';
    labelRendererRef.current.domElement.style.top = '0px';
    labelRendererRef.current.domElement.style.pointerEvents = 'none';
    currentMount.appendChild(labelRendererRef.current.domElement);
    
    handleResize(); // Call resize after appending renderer

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    sceneRef.current.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    sceneRef.current.add(directionalLight);

    controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
    controlsRef.current.enableDamping = true;
    controlsRef.current.target.set(initialCameraLookAt.x, initialCameraLookAt.y, initialCameraLookAt.z);
    controlsRef.current.update();

    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x37474F, side: THREE.DoubleSide, metalness: 0.1, roughness: 0.8 });
    groundMeshRef.current = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMeshRef.current.rotation.x = -Math.PI / 2;
    groundMeshRef.current.position.y = 0;
    groundMeshRef.current.receiveShadow = true;
    
    const resizeObserver = new ResizeObserver(handleResize);
    if (currentMount) {
        resizeObserver.observe(currentMount);
    }
    
    const initialResizeTimeoutId = setTimeout(() => {
        handleResize();
    }, 150);


    window.addEventListener('resize', handleResize);
    currentMount.addEventListener('click', handleClick);
    currentMount.addEventListener('mousemove', handleMouseMove);

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
        if (labelRendererRef.current) {
          labelRendererRef.current.render(sceneRef.current, cameraRef.current);
        }
      }
    };
    animate();

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
      clearTimeout(initialResizeTimeoutId);
      if (currentMount) {
        resizeObserver.unobserve(currentMount);
      }
      window.removeEventListener('resize', handleResize);
      if (currentMount) {
        currentMount.removeEventListener('click', handleClick);
        currentMount.removeEventListener('mousemove', handleMouseMove);
        if (rendererRef.current?.domElement?.parentNode === currentMount) {
          currentMount.removeChild(rendererRef.current.domElement);
        }
        if (labelRendererRef.current?.domElement?.parentNode === currentMount) {
          currentMount.removeChild(labelRendererRef.current.domElement);
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
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else if (obj.material) (obj.material as THREE.Material).dispose();
        }
      });
      equipmentMeshesRef.current = [];

      annotationPinObjectsRef.current.forEach(annoObj => {
        sceneRef.current?.remove(annoObj);
      });
      annotationPinObjectsRef.current = [];

      if (sceneRef.current) {
        if (groundMeshRef.current) {
          sceneRef.current.remove(groundMeshRef.current);
          groundMeshRef.current.geometry.dispose();
          if (groundMeshRef.current.material instanceof THREE.Material) groundMeshRef.current.material.dispose();
          groundMeshRef.current = null;
        }
      }
      rendererRef.current?.dispose();
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      labelRendererRef.current = null;
      controlsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCameraPosition, initialCameraLookAt]);

  const handleClick = (event: MouseEvent) => {
    if (!mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current) return;
    const currentMountForClick = mountRef.current;

    const rect = currentMountForClick.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(equipmentMeshesRef.current, true);
    
    const isMultiSelectModifierPressed = event.ctrlKey || event.metaKey;

    if (intersects.length > 0) {
      let selectedObject = intersects[0].object;
      while (selectedObject.parent && !selectedObject.userData.id) {
        if (selectedObject.parent instanceof THREE.Scene) break;
        selectedObject = selectedObject.parent;
      }
      if (selectedObject.userData.id) {
        onSelectEquipmentRef.current(selectedObject.userData.id, isMultiSelectModifierPressed);
      } else {
        onSelectEquipmentRef.current(null, isMultiSelectModifierPressed);
      }
    } else {
      onSelectEquipmentRef.current(null, isMultiSelectModifierPressed);
    }
  };

  useEffect(() => {
    if (!sceneRef.current) return;

    equipmentMeshesRef.current.forEach(obj => {
      sceneRef.current?.remove(obj);
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else if (obj.material) (obj.material as THREE.Material).dispose();
      }
    });
    equipmentMeshesRef.current = [];

    const visibleLayers = layers.filter(l => l.isVisible);
    filteredEquipmentData.forEach(item => {
      const itemLayer = visibleLayers.find(l => l.equipmentType === item.type || l.equipmentType === 'All');
      if (itemLayer) {
        const obj = createEquipmentMesh(item);
        sceneRef.current?.add(obj);
        equipmentMeshesRef.current.push(obj);
      }
    });

    const terrainLayer = layers.find(l => l.equipmentType === 'Terrain');
    if (terrainLayer && groundMeshRef.current && sceneRef.current) {
      const isGroundInScene = sceneRef.current.children.includes(groundMeshRef.current);
      if (terrainLayer.isVisible && !isGroundInScene) {
        sceneRef.current.add(groundMeshRef.current);
      } else if (!terrainLayer.isVisible && isGroundInScene) {
        sceneRef.current.remove(groundMeshRef.current);
      }
    }

  }, [filteredEquipmentData, layers, createEquipmentMesh]);

  // Effect for updating annotation pins
  useEffect(() => {
    if (!sceneRef.current || !labelRendererRef.current) return;

    annotationPinObjectsRef.current.forEach(obj => {
      sceneRef.current?.remove(obj);
    });
    annotationPinObjectsRef.current = [];

    const annotationsLayer = layers.find(l => l.equipmentType === 'Annotations');
    const areAnnotationsVisible = annotationsLayer?.isVisible ?? true;
    
    if (labelRendererRef.current.domElement) {
        labelRendererRef.current.domElement.style.display = areAnnotationsVisible ? '' : 'none';
    }

    if (areAnnotationsVisible) {
        annotations.forEach(anno => {
            const equipmentForItem = filteredEquipmentData.find(e => e.id === anno.equipmentId);
            if (equipmentForItem) {
                const pinDiv = document.createElement('div');
                pinDiv.innerHTML = `
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#FFD700" style="opacity: 0.9;">
                    <path d="M12 2C7.03 2 3 6.03 3 11c0 2.05.64 3.98 1.75 5.61L12 22l7.25-5.39C20.36 14.98 21 13.05 21 11c0-4.97-4.03-9-9-9zm0 2.5c1.93 0 3.5 1.57 3.5 3.5S13.93 11.5 12 11.5 8.5 9.93 8.5 8 10.07 4.5 12 4.5z"/>
                  </svg>`;
                pinDiv.style.pointerEvents = 'none';

                const pinLabel = new CSS2DObject(pinDiv);
                let yOffset = 0;
                if (equipmentForItem.type === 'Tank' || equipmentForItem.type === 'Pipe') {
                    yOffset = (equipmentForItem.height || 0) / 2 + 0.5;
                } else if (equipmentForItem.size?.height) {
                    yOffset = equipmentForItem.size.height / 2 + 0.5;
                } else {
                    yOffset = 1; // Default offset if no height/size info
                }
                pinLabel.position.set(equipmentForItem.position.x, equipmentForItem.position.y + yOffset, equipmentForItem.position.z);
                
                sceneRef.current?.add(pinLabel);
                annotationPinObjectsRef.current.push(pinLabel);
            }
        });
    }
  }, [annotations, layers, filteredEquipmentData]);


  useEffect(() => {
    equipmentMeshesRef.current.forEach(obj => {
      const objectId = obj.userData.id;

      const applyEmissiveToMaterial = (material: THREE.Material | THREE.Material[], colorHex: number) => {
        const apply = (mat: THREE.Material) => {
          if (mat instanceof THREE.MeshStandardMaterial) {
            mat.emissive.setHex(colorHex);
          }
        };
        if (Array.isArray(material)) {
          material.forEach(apply);
        } else {
          apply(material);
        }
      };
      
      const setEmissiveForObject = (targetObj: THREE.Object3D, colorHex: number) => {
        if (targetObj instanceof THREE.Mesh) {
          applyEmissiveToMaterial(targetObj.material, colorHex);
        } else if (targetObj instanceof THREE.Group) {
          targetObj.traverse(child => {
            if (child instanceof THREE.Mesh) {
              applyEmissiveToMaterial(child.material, colorHex);
            }
          });
        }
      };

      if (!objectId) return;

      if (selectedEquipmentIds.includes(objectId)) {
        setEmissiveForObject(obj, 0xBE29FF);
      } else if (objectId === hoveredEquipmentId) {
        setEmissiveForObject(obj, 0xFFD700);
      } else {
        setEmissiveForObject(obj, 0x000000);
      }
    });
  }, [selectedEquipmentIds, hoveredEquipmentId]);

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
        if (positionChanged) camera.position.copy(targetPosition);
        if (lookAtChanged) controls.target.copy(targetLookAt);
        controls.update();
        controls.enabled = oldControlsEnabled;
      }
    }
  }, [programmaticCameraState]);

  return <div ref={mountRef} className="w-full h-full" />;
};

export default ThreeScene;

