
"use client";

import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Equipment, Layer, CameraState, Annotation } from '@/lib/types';
// import { MapPinIcon } from 'lucide-react'; // Using MapPinIcon as a placeholder

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
    console.log(`[ThreeScene createEquipmentMesh] Item ID: ${item.id}, Received operationalState: '${item.operationalState}', Original item.color: ${item.color}`);
    
    let stateColor = item.color; 
    switch (item.operationalState) {
      case 'operando':
        stateColor = '#FF0000'; // Red
        break;
      case 'não operando':
        stateColor = '#00FF00'; // Green
        break;
      case 'manutenção':
        stateColor = '#FFFF00'; // Yellow
        break;
      case 'em falha':
        stateColor = '#800080'; // Purple
        break;
      default:
        // If state is undefined or not matched, use original item color
        stateColor = item.color;
    }
    console.log(`[ThreeScene createEquipmentMesh] Item ID: ${item.id}, Final stateColor for material: ${stateColor}`);

    const material = new THREE.MeshStandardMaterial({ color: stateColor, metalness: 0.3, roughness: 0.6 });
    let geometry: THREE.BufferGeometry;
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
        geometry = new THREE.SphereGeometry(1, 16, 16); // Default sphere
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
      
      // console.log(`[ThreeScene] handleResize CALLED. New dimensions: ${width}x${height}`);

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
      // console.log('[ThreeScene] MouseMove found:', foundHoverId, 'Currently hovered (ref):', hoveredEquipmentIdRef.current);
      setHoveredEquipmentId(foundHoverId);
      // console.log('[ThreeScene] Setting hoveredEquipmentId to:', foundHoverId);
    }
  }, []);

  useEffect(() => {
    // console.log('[ThreeScene] Main setup useEffect RUNNING');
    if (!mountRef.current) return;
    const currentMount = mountRef.current;

    // console.log('[ThreeScene] Mount dimensions AT START of useEffect:', `${currentMount.clientWidth}x${currentMount.clientHeight}`);

    sceneRef.current = new THREE.Scene();
    sceneRef.current.background = new THREE.Color(0x2B3035); 
    // console.log('[ThreeScene] Scene created');

    cameraRef.current = new THREE.PerspectiveCamera(75, Math.max(1, currentMount.clientWidth) / Math.max(1, currentMount.clientHeight), 0.1, 1000);
    cameraRef.current.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);
    // console.log('[ThreeScene] Camera created at:', cameraRef.current.position);
    
    rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current.shadowMap.enabled = true;
    currentMount.appendChild(rendererRef.current.domElement);
    // console.log('[ThreeScene] Renderer DOM element appended.');

    labelRendererRef.current = new CSS2DRenderer();
    labelRendererRef.current.domElement.style.position = 'absolute';
    labelRendererRef.current.domElement.style.top = '0px';
    labelRendererRef.current.domElement.style.pointerEvents = 'none'; // Make labels non-interactive
    currentMount.appendChild(labelRendererRef.current.domElement);
    // console.log('[ThreeScene] LabelRenderer DOM element appended.');
    
    // console.log('[ThreeScene] Attempting initial resize. Mount dimensions BEFORE first handleResize:', `${currentMount.clientWidth}x${currentMount.clientHeight}`);
    handleResize(); // Call resize after appending renderer

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    sceneRef.current.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    sceneRef.current.add(directionalLight);
    // console.log('[ThreeScene] Lights added');

    controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
    controlsRef.current.enableDamping = true;
    controlsRef.current.target.set(initialCameraLookAt.x, initialCameraLookAt.y, initialCameraLookAt.z);
    controlsRef.current.update();
    // console.log('[ThreeScene] OrbitControls created, target:', controlsRef.current.target);

    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x37474F, side: THREE.DoubleSide, metalness: 0.1, roughness: 0.8 });
    groundMeshRef.current = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMeshRef.current.rotation.x = -Math.PI / 2;
    groundMeshRef.current.position.y = 0;
    groundMeshRef.current.receiveShadow = true;
    // console.log('[ThreeScene] Ground plane added');
    
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(currentMount);
    
    const initialDelayedResizeTimeoutId = setTimeout(() => {
      // console.log('[ThreeScene] Attempting DELAYED resize. Mount dimensions BEFORE delayed handleResize:', `${currentMount.clientWidth}x${currentMount.clientHeight}`);
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
    // console.log('[ThreeScene] Animation loop starting');
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
    // console.log('[ThreeScene] Main setup useEffect FINISHED');
    return () => {
      // console.log('[ThreeScene] Cleanup useEffect RUNNING');
      cancelAnimationFrame(animationFrameId);
      clearTimeout(initialDelayedResizeTimeoutId);
      resizeObserver.unobserve(currentMount);
      window.removeEventListener('resize', handleResize);
      currentMount.removeEventListener('click', handleClick);
      currentMount.removeEventListener('mousemove', handleMouseMove);
      
      if (controlsRef.current) {
        controlsRef.current.removeEventListener('end', handleControlsChangeEnd);
        controlsRef.current.dispose();
      }
      equipmentMeshesRef.current.forEach(obj => {
        sceneRef.current?.remove(obj);
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else if (obj.material) {
            (obj.material as THREE.Material).dispose();
          }
        }
      });
      equipmentMeshesRef.current = [];

      annotationPinObjectsRef.current.forEach(annoObj => {
        sceneRef.current?.remove(annoObj);
         if (annoObj.element.parentNode) {
            annoObj.element.parentNode.removeChild(annoObj.element);
        }
      });
      annotationPinObjectsRef.current = [];
      
      if (sceneRef.current) {
        if (groundMeshRef.current) {
          sceneRef.current.remove(groundMeshRef.current);
          groundMeshRef.current.geometry.dispose();
          if (groundMeshRef.current.material instanceof THREE.Material) {
            groundMeshRef.current.material.dispose();
          }
          groundMeshRef.current = null;
        }
      }
      
      if (rendererRef.current?.domElement?.parentNode === currentMount) {
         currentMount.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();

      if (labelRendererRef.current?.domElement?.parentNode === currentMount) {
        currentMount.removeChild(labelRendererRef.current.domElement);
      }
      labelRendererRef.current = null;
      // console.log('[ThreeScene] Cleanup useEffect FINISHED');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCameraPosition, initialCameraLookAt]); // Runs once on mount

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
    // console.log('[ThreeScene] Updating equipment. Current mesh count:', equipmentMeshesRef.current.length);
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
    // console.log('[ThreeScene] Old equipment meshes removed and disposed.');

    const visibleLayers = layers.filter(l => l.isVisible);
    // console.log('[ThreeScene] Visible layers:', visibleLayers.map(l => l.name));
    
    const equipmentToRender = filteredEquipmentData.filter(item => {
      const itemLayer = visibleLayers.find(l => l.equipmentType === item.type || l.equipmentType === 'All');
      return !!itemLayer;
    });

    equipmentToRender.forEach(item => {
      const obj = createEquipmentMesh(item);
      sceneRef.current?.add(obj);
      equipmentMeshesRef.current.push(obj);
    });
    // console.log(`[ThreeScene] Added ${equipmentMeshesRef.current.length} new equipment meshes. Total scene children: ${sceneRef.current.children.length}`);


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

  useEffect(() => {
    // console.log('[ThreeScene] Updating annotation pins.');
    if (!sceneRef.current || !labelRendererRef.current) return;
  
    annotationPinObjectsRef.current.forEach(obj => {
      sceneRef.current?.remove(obj);
      if (obj.element.parentNode) {
        obj.element.parentNode.removeChild(obj.element);
      }
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
                // Using MapPinIcon from lucide-react as an example. You might need to adjust.
                // For simplicity, using an inline SVG with a specific color.
                pinDiv.innerHTML = `
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#FFD700" style="opacity: 0.9; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5));">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 4.17 4.42 9.92 6.24 12.11.4.48 1.13.48 1.53 0C14.58 18.92 19 13.17 19 9c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
                  </svg>`;
                pinDiv.style.pointerEvents = 'none'; // So it doesn't interfere with raycasting for equipment selection
                pinDiv.style.width = '24px';
                pinDiv.style.height = '24px';
                
                const pinLabel = new CSS2DObject(pinDiv);
                let yOffset = 0;
                if (equipmentForItem.type === 'Tank' || equipmentForItem.type === 'Pipe') {
                    yOffset = (equipmentForItem.height || 0) / 2 + 0.8; // Increased offset slightly
                } else if (equipmentForItem.size?.height) {
                    yOffset = equipmentForItem.size.height / 2 + 0.8; // Increased offset slightly
                } else {
                    yOffset = 1.3; // Default offset if no height/size info
                }
                pinLabel.position.set(equipmentForItem.position.x, equipmentForItem.position.y + yOffset, equipmentForItem.position.z);
                
                sceneRef.current?.add(pinLabel);
                annotationPinObjectsRef.current.push(pinLabel);
            }
        });
    }
  }, [annotations, layers, filteredEquipmentData]);

  useEffect(() => {
    // console.log(`[ThreeScene] Highlighting effect. Selected: ${selectedEquipmentIds.join(',') || 'none'}, Hovered: ${hoveredEquipmentId || 'none'}`);
    equipmentMeshesRef.current.forEach(obj => {
      const objectId = obj.userData.id;
      if (!objectId) return;

      const applyEmissiveToMaterial = (material: THREE.Material | THREE.Material[], colorHex: number, intensity: number = 1) => {
        const apply = (mat: THREE.Material) => {
          if (mat instanceof THREE.MeshStandardMaterial) {
            mat.emissive.setHex(colorHex);
            mat.emissiveIntensity = intensity;
          }
        };
        if (Array.isArray(material)) {
          material.forEach(apply);
        } else {
          apply(material);
        }
      };
      
      const setEmissiveForObject = (targetObj: THREE.Object3D, colorHex: number, intensity: number = 1) => {
        if (targetObj instanceof THREE.Mesh) {
          applyEmissiveToMaterial(targetObj.material, colorHex, intensity);
        } else if (targetObj instanceof THREE.Group) {
          targetObj.traverse(child => {
            if (child instanceof THREE.Mesh) {
              applyEmissiveToMaterial(child.material, colorHex, intensity);
            }
          });
        }
      };

      if (selectedEquipmentIds.includes(objectId)) {
        setEmissiveForObject(obj, 0xBE29FF, 0.7); // Purple for selected
      } else if (objectId === hoveredEquipmentId) {
        setEmissiveForObject(obj, 0xFFD700, 0.9); // Yellow for hovered, slightly less intense
      } else {
        setEmissiveForObject(obj, 0x000000, 0); // No emissive
      }
    });
  }, [selectedEquipmentIds, hoveredEquipmentId]);

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
