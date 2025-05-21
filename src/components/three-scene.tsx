
"use client";

import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
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
  hoveredEquipmentId: string | null;
  setHoveredEquipmentId: (id: string | null) => void;
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
  hoveredEquipmentId,
  setHoveredEquipmentId,
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

  const composerRef = useRef<EffectComposer | null>(null);
  const outlinePassRef = useRef<OutlinePass | null>(null);

  const onSelectEquipmentRef = useRef(onSelectEquipment);
  const onCameraChangeRef = useRef(onCameraChange);
  const hoveredEquipmentIdRef = useRef(hoveredEquipmentId);
  const setHoveredEquipmentIdRef = useRef(setHoveredEquipmentId);

  useEffect(() => {
    onSelectEquipmentRef.current = onSelectEquipment;
  }, [onSelectEquipment]);

  useEffect(() => {
    onCameraChangeRef.current = onCameraChange;
  }, [onCameraChange]);

  useEffect(() => {
    hoveredEquipmentIdRef.current = hoveredEquipmentId;
  }, [hoveredEquipmentId]);

  useEffect(() => {
    setHoveredEquipmentIdRef.current = setHoveredEquipmentId;
  }, [setHoveredEquipmentId]);


  const handleResize = useCallback(() => {
    if (mountRef.current && cameraRef.current && rendererRef.current && labelRendererRef.current && composerRef.current) {
      const width = Math.max(1, mountRef.current.clientWidth);
      const height = Math.max(1, mountRef.current.clientHeight);
      
      // console.log(`[ThreeScene] handleResize CALLED. New dimensions: ${width}x${height}`);
      
      if (cameraRef.current.aspect !== width / height && height > 0 && width > 0) {
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
      }
      if (width > 0 && height > 0) {
        rendererRef.current.setSize(width, height);
        composerRef.current.setSize(width, height); 
        if (outlinePassRef.current) {
          outlinePassRef.current.resolution.set(width, height); 
        }
        labelRendererRef.current.setSize(width, height);
      }
    }
  }, []);


  const createEquipmentMesh = useCallback((item: Equipment): THREE.Object3D => {
    let stateColorHex: number;
    
    // console.log(`[ThreeScene createEquipmentMesh] Processing ${item.id}, state: ${item.operationalState}, original color: ${item.color}`);

    switch (item.operationalState) {
      case 'operando':
        stateColorHex = 0xFF0000; // Vermelho
        break;
      case 'não operando':
        stateColorHex = 0x00FF00; // Verde
        break;
      case 'manutenção':
        stateColorHex = 0xFFFF00; // Amarelo
        break;
      case 'em falha':
        stateColorHex = 0x800080; // Roxo
        break;
      case 'Não aplicável':
        stateColorHex = new THREE.Color(item.color).getHex();
        break;
      default:
        stateColorHex = new THREE.Color(item.color).getHex();
        break;
    }
    // console.log(`[ThreeScene createEquipmentMesh] Final color for ${item.id}: #${stateColorHex.toString(16)}`);
    
    const material = new THREE.MeshStandardMaterial({ color: stateColorHex, metalness: 0.3, roughness: 0.6 });
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
        geometry = new THREE.SphereGeometry(1, 16, 16); 
        mesh = new THREE.Mesh(geometry, material);
    }

    mesh.position.set(item.position.x, item.position.y, item.position.z);
    if (item.rotation) {
      mesh.rotation.set(item.rotation.x, item.rotation.y, item.rotation.z);
    }
    mesh.userData = { id: item.id, type: item.type, originalColor: item.color };
    mesh.castShadow = false; // Disable shadow casting
    mesh.receiveShadow = false; // Disable shadow receiving
    return mesh;
  }, []);


  useEffect(() => {
    // console.log("[ThreeScene] Main setup useEffect RUNNING");
    if (!mountRef.current) return;
    const currentMount = mountRef.current;
    // console.log(`[ThreeScene] Mount dimensions AT START of useEffect: ${currentMount.clientWidth}x${currentMount.clientHeight}`);
    
    sceneRef.current = new THREE.Scene();
    const skyHorizonColor = 0xA9C1D1; 
    sceneRef.current.background = new THREE.Color(skyHorizonColor); 
    sceneRef.current.fog = new THREE.Fog(skyHorizonColor, 40, 150); 
    // console.log("[ThreeScene] Scene created");
    
    const initialWidth = Math.max(1, currentMount.clientWidth);
    const initialHeight = Math.max(1, currentMount.clientHeight);

    cameraRef.current = new THREE.PerspectiveCamera(75, initialWidth / initialHeight, 0.1, 1000);
    cameraRef.current.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);
    // console.log("[ThreeScene] Camera created at:", cameraRef.current.position.clone());
    
    rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
    // rendererRef.current.shadowMap.enabled = true; // Shadows disabled
    // rendererRef.current.shadowMap.type = THREE.PCFSoftShadowMap; // Shadows disabled
    currentMount.appendChild(rendererRef.current.domElement);
    // console.log("[ThreeScene] Renderer DOM element appended.");
    
    // console.log(`[ThreeScene] Attempting initial resize. Mount dimensions BEFORE first handleResize: ${currentMount.clientWidth}x${currentMount.clientHeight}`);
    handleResize(); 

    labelRendererRef.current = new CSS2DRenderer();
    labelRendererRef.current.domElement.style.position = 'absolute';
    labelRendererRef.current.domElement.style.top = '0px';
    labelRendererRef.current.domElement.style.pointerEvents = 'none'; 
    currentMount.appendChild(labelRendererRef.current.domElement);

    composerRef.current = new EffectComposer(rendererRef.current);
    const renderPass = new RenderPass(sceneRef.current, cameraRef.current);
    composerRef.current.addPass(renderPass);

    outlinePassRef.current = new OutlinePass(new THREE.Vector2(initialWidth, initialHeight), sceneRef.current, cameraRef.current);
    outlinePassRef.current.edgeStrength = 3;
    outlinePassRef.current.edgeGlow = 0.5;
    outlinePassRef.current.edgeThickness = 1;
    composerRef.current.addPass(outlinePassRef.current);
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0); 
    sceneRef.current.add(ambientLight);

    const hemisphereLight = new THREE.HemisphereLight(0xADD8E6, 0x495436, 0.8); 
    sceneRef.current.add(hemisphereLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 3.0); 
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = false; // Disable shadow casting
    // directionalLight.shadow.mapSize.width = 2048; // Not needed if shadows are off
    // directionalLight.shadow.mapSize.height = 2048; // Not needed if shadows are off
    sceneRef.current.add(directionalLight);
    // console.log("[ThreeScene] Lights added");
    
    controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
    controlsRef.current.enableDamping = true;
    controlsRef.current.target.set(initialCameraLookAt.x, initialCameraLookAt.y, initialCameraLookAt.z);
    controlsRef.current.update();
    // console.log("[ThreeScene] OrbitControls created, target:", controlsRef.current.target.clone());
    
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x495436, side: THREE.DoubleSide, metalness: 0.1, roughness: 0.8 }); 
    groundMeshRef.current = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMeshRef.current.rotation.x = -Math.PI / 2;
    groundMeshRef.current.position.y = 0;
    groundMeshRef.current.receiveShadow = false; // Disable shadow receiving
    // console.log("[ThreeScene] Ground plane added");
    
    const delayedResizeTimeoutId = setTimeout(() => {
        // console.log(`[ThreeScene] Attempting DELAYED resize. Mount dimensions BEFORE delayed handleResize: ${mountRef.current?.clientWidth}x${mountRef.current?.clientHeight}`);
        handleResize();
    }, 150);

    const resizeObserver = new ResizeObserver(handleResize);
    if (currentMount) resizeObserver.observe(currentMount);

    window.addEventListener('resize', handleResize);
    currentMount.addEventListener('click', handleClick);
    currentMount.addEventListener('mousemove', handleMouseMove);
    // console.log("[ThreeScene] Event listeners added.");

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();
      
      composerRef.current?.render();
      if (labelRendererRef.current && sceneRef.current && cameraRef.current) {
        labelRendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    // console.log("[ThreeScene] Animation loop started");
    animate();

    const handleControlsChangeEnd = () => {
      if (cameraRef.current && controlsRef.current && onCameraChangeRef.current) {
        const newCameraState = {
          position: cameraRef.current.position.clone(),
          lookAt: controlsRef.current.target.clone(),
        };
        onCameraChangeRef.current(newCameraState);
      }
    };

    if (controlsRef.current && onCameraChangeRef.current) {
      controlsRef.current.addEventListener('end', handleControlsChangeEnd);
    }
    // console.log("[ThreeScene] Main setup useEffect FINISHED");
    return () => {
      // console.log("[ThreeScene] Cleanup function RUNNING");
      cancelAnimationFrame(animationFrameId);
      clearTimeout(delayedResizeTimeoutId);
      if (currentMount) resizeObserver.unobserve(currentMount);
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
          if (obj.geometry) obj.geometry.dispose();
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
          if (groundMeshRef.current.geometry) groundMeshRef.current.geometry.dispose();
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
      if (composerRef.current) {
        composerRef.current.dispose();
      }

      if (labelRendererRef.current?.domElement?.parentNode === currentMount) {
        currentMount.removeChild(labelRendererRef.current.domElement);
      }
      labelRendererRef.current = null;
      // console.log("[ThreeScene] Cleanup FINISHED");
    };
  }, []); 

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current || equipmentMeshesRef.current.length === 0) {
      if (hoveredEquipmentIdRef.current !== null) setHoveredEquipmentIdRef.current(null);
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
      // console.log('[ThreeScene] Setting hoveredEquipmentId to:', foundHoverId);
      setHoveredEquipmentIdRef.current(foundHoverId);
    }
  }, []); 

  const handleClick = useCallback((event: MouseEvent) => {
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
  }, []); 

  useEffect(() => {
    // console.log(`[ThreeScene] Updating equipment. Current mesh count: ${equipmentMeshesRef.current.length}`);
    if (!sceneRef.current) return;

    equipmentMeshesRef.current.forEach(obj => {
      sceneRef.current?.remove(obj);
      if (obj instanceof THREE.Mesh) {
        if (obj.geometry) obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
        } else if (obj.material) {
            (obj.material as THREE.Material).dispose();
        }
      }
    });
    equipmentMeshesRef.current = [];
    // console.log("[ThreeScene] Old equipment meshes removed and disposed.");
    
    const visibleLayers = layers.filter(l => l.isVisible);
    
    const equipmentToRender = filteredEquipmentData.filter(item => {
      const itemLayer = visibleLayers.find(l => l.equipmentType === item.type || l.equipmentType === 'All');
      return !!itemLayer;
    });
    // console.log(`[ThreeScene] Visible layers: ${visibleLayers.map(l => l.name).join(', ')}. Equipment to render: ${equipmentToRender.length}`);

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
    if (!outlinePassRef.current || !sceneRef.current) return;
  
    const objectsToOutline: THREE.Object3D[] = [];
    const meshesToConsider = equipmentMeshesRef.current;
  
    if (selectedEquipmentIds.length > 0) {
      selectedEquipmentIds.forEach(id => {
        const selectedMesh = meshesToConsider.find(mesh => mesh.userData.id === id);
        if (selectedMesh) {
          objectsToOutline.push(selectedMesh);
        }
      });
      outlinePassRef.current.visibleEdgeColor.set(0x0000FF); // Strong blue for selected
      outlinePassRef.current.edgeStrength = 5; 
      outlinePassRef.current.edgeThickness = 2.5;
      outlinePassRef.current.edgeGlow = 0.7; 
    } else if (hoveredEquipmentId) {
      const hoveredMesh = meshesToConsider.find(mesh => mesh.userData.id === hoveredEquipmentId);
      if (hoveredMesh) {
        objectsToOutline.push(hoveredMesh);
      }
      outlinePassRef.current.visibleEdgeColor.set(0x87CEFA); // Light blue for hover
      outlinePassRef.current.edgeStrength = 4; 
      outlinePassRef.current.edgeThickness = 2;
      outlinePassRef.current.edgeGlow = 0.5; 
    } else {
      // No selection or hover, clear outline
      outlinePassRef.current.selectedObjects = [];
    }
    outlinePassRef.current.selectedObjects = objectsToOutline;
  }, [selectedEquipmentIds, hoveredEquipmentId, filteredEquipmentData, layers]); 

  useEffect(() => {
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
                pinDiv.innerHTML = `
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#FFD700" style="opacity: 0.9; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5));">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 4.17 4.42 9.92 6.24 12.11.4.48 1.13.48 1.53 0C14.58 18.92 19 13.17 19 9c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
                  </svg>`;
                pinDiv.style.pointerEvents = 'none'; 
                pinDiv.style.width = '24px'; 
                pinDiv.style.height = '24px';
                
                const pinLabel = new CSS2DObject(pinDiv);
                
                let yOffset = 0;
                if (equipmentForItem.type === 'Tank' || equipmentForItem.type === 'Pipe') {
                    yOffset = (equipmentForItem.height || 0) / 2 + 0.8; 
                } else if (equipmentForItem.size?.height) {
                    yOffset = equipmentForItem.size.height / 2 + 0.8;
                } else {
                    yOffset = 1.3; 
                }
                pinLabel.position.set(equipmentForItem.position.x, equipmentForItem.position.y + yOffset, equipmentForItem.position.z);
                
                sceneRef.current?.add(pinLabel);
                annotationPinObjectsRef.current.push(pinLabel);
            }
        });
    }
  }, [annotations, layers, filteredEquipmentData]); 

  useEffect(() => {
    // console.log("[ThreeScene] Programmatic camera update:", programmaticCameraState);
    if (programmaticCameraState && cameraRef.current && controlsRef.current) {
      const camera = cameraRef.current;
      const controls = controlsRef.current;

      const targetPosition = new THREE.Vector3(programmaticCameraState.position.x, programmaticCameraState.position.y, programmaticCameraState.position.z);
      const targetLookAt = programmaticCameraState.lookAt ? new THREE.Vector3(programmaticCameraState.lookAt.x, programmaticCameraState.lookAt.y, programmaticCameraState.lookAt.z) : controls.target.clone();

      const positionChanged = !camera.position.equals(targetPosition);
      const lookAtChanged = !controls.target.equals(targetLookAt);
      
      if (positionChanged || lookAtChanged) {
        // console.log(`[ThreeScene] Applying programmatic camera change. Pos changed: ${positionChanged} LookAt changed: ${lookAtChanged}`);
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
