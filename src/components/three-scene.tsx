
"use client";

import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import type { Equipment, Layer, CameraState, Annotation } from '@/lib/types';
import type { ColorMode } from '@/app/page';

// Helper function to convert char to numeric value for color generation
function getCharNumericValue(char: string): number {
  const upperChar = char.toUpperCase();
  if (char >= '0' && char <= '9') {
    return parseInt(char, 10); // 0-9 for 0-9
  } else if (upperChar >= 'A' && upperChar <= 'Z') {
    return upperChar.charCodeAt(0) - 'A'.charCodeAt(0) + 10; // 10-35 for A-Z
  }
  return 0; // Default for other characters
}

interface ThreeSceneProps {
  equipment: Equipment[];
  layers: Layer[];
  annotations: Annotation[];
  selectedEquipmentTags: string[];
  onSelectEquipment: (equipmentTag: string | null, isMultiSelectModifierPressed: boolean) => void;
  cameraState?: CameraState;
  onCameraChange: (cameraState: CameraState) => void;
  initialCameraPosition: { x: number; y: number; z: number };
  initialCameraLookAt: { x: number; y: number; z: number };
  hoveredEquipmentTag: string | null;
  setHoveredEquipmentTag: (tag: string | null) => void;
  colorMode: ColorMode;
  targetSystemToFrame: string | null;
  onSystemFramed: () => void;
}

const ThreeScene: React.FC<ThreeSceneProps> = ({
  equipment,
  layers,
  annotations,
  selectedEquipmentTags,
  onSelectEquipment,
  cameraState: programmaticCameraState,
  onCameraChange,
  initialCameraPosition,
  initialCameraLookAt,
  hoveredEquipmentTag,
  setHoveredEquipmentTag,
  colorMode,
  targetSystemToFrame,
  onSystemFramed,
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
  
  const hoveredEquipmentTagRef = useRef(hoveredEquipmentTag);
  const setHoveredEquipmentTagCallbackRef = useRef(setHoveredEquipmentTag);

  const lastProcessedCameraStateRef = useRef<CameraState | null>(null);
  const [isSceneReady, setIsSceneReady] = useState(false);

  useEffect(() => {
    onSelectEquipmentRef.current = onSelectEquipment;
  }, [onSelectEquipment]);

  useEffect(() => {
    onCameraChangeRef.current = onCameraChange;
  }, [onCameraChange]);
  
  useEffect(() => {
    hoveredEquipmentTagRef.current = hoveredEquipmentTag;
  }, [hoveredEquipmentTag]);

  useEffect(() => {
    setHoveredEquipmentTagCallbackRef.current = setHoveredEquipmentTag;
  }, [setHoveredEquipmentTag]);

  const handleResize = useCallback(() => {
    if (mountRef.current && cameraRef.current && rendererRef.current && labelRendererRef.current) {
      const width = Math.max(1, mountRef.current.clientWidth);
      const height = Math.max(1, mountRef.current.clientHeight);
      // console.log(`[ThreeScene] handleResize CALLED. New dimensions: ${width}x${height}`);

      if (cameraRef.current) {
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
      }
      
      if (rendererRef.current) {
        rendererRef.current.setSize(width, height);
      }
      if (labelRendererRef.current) {
        labelRendererRef.current.setSize(width, height);
      }
      if (composerRef.current) {
        composerRef.current.setSize(width, height);
      }
      if (outlinePassRef.current) {
        // Ensure outlinePass resolution is explicitly set
        outlinePassRef.current.resolution.set(width, height);
      }
    }
  }, []);

  const createEquipmentMesh = useCallback((item: Equipment, currentGlobalColorMode: ColorMode): THREE.Object3D => {
    let baseColor = new THREE.Color(item.color);
    let finalColor = new THREE.Color(); 
    let stateColor = new THREE.Color(); 

    // console.log(`[ThreeScene createEquipmentMesh] Processing ${item.tag}, state: ${item.operationalState}, product: ${item.product}, mode: ${currentGlobalColorMode}`);

    switch (currentGlobalColorMode) {
        case 'Produto':
            if (item.product && item.product !== "Não aplicável" && item.product.length >= 3) {
                const rVal = getCharNumericValue(item.product.charAt(0));
                const gVal = getCharNumericValue(item.product.charAt(1));
                const bVal = getCharNumericValue(item.product.charAt(2));
                finalColor.setRGB(rVal / 35.0, gVal / 35.0, bVal / 35.0);
            } else {
                finalColor.copy(baseColor); 
            }
            break;
        case 'Estado Operacional':
            switch (item.operationalState) {
                case 'operando': stateColor.setHex(0xFF0000); break; // Vermelho
                case 'não operando': stateColor.setHex(0x00FF00); break; // Verde
                case 'manutenção': stateColor.setHex(0xFFFF00); break; // Amarelo
                case 'em falha': stateColor.setHex(0xDA70D6); break; // Roxo Orchid (quase rosa)
                case 'Não aplicável':
                default:
                    stateColor.copy(baseColor); 
                    break;
            }
            finalColor.copy(stateColor);
            break;
        case 'Equipamento':
        default:
            finalColor.copy(baseColor);
            break;
    }
    
    const material = new THREE.MeshStandardMaterial({
        color: finalColor,
        metalness: 0.3,
        roughness: 0.6,
    });

    if (item.operationalState === 'Não aplicável') {
        material.transparent = true;
        material.opacity = 0.5; 
    } else {
        material.transparent = false;
        material.opacity = 1.0;
    }

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

    mesh.position.copy(item.position as THREE.Vector3);
    if (item.rotation) {
        mesh.rotation.set(item.rotation.x, item.rotation.y, item.rotation.z);
    }
    mesh.userData = { tag: item.tag, type: item.type, sistema: item.sistema }; 
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return mesh;
  }, []);

  // Main setup useEffect
  useEffect(() => {
    // console.log('[ThreeScene] Main setup useEffect RUNNING');
    if (!mountRef.current) return; 
    const currentMount = mountRef.current;
    // console.log('[ThreeScene] Mount dimensions AT START of useEffect:', currentMount.clientWidth + 'x' + currentMount.clientHeight);

    sceneRef.current = new THREE.Scene();
    sceneRef.current.background = new THREE.Color(0xA9C1D1); 
    sceneRef.current.fog = new THREE.Fog(0xA9C1D1, 40, 150); 
    // console.log('[ThreeScene] Scene created');

    const initialWidth = Math.max(1, currentMount.clientWidth);
    const initialHeight = Math.max(1, currentMount.clientHeight);

    cameraRef.current = new THREE.PerspectiveCamera(75, initialWidth / initialHeight, 0.1, 1000);
    cameraRef.current.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);
    // console.log('[ThreeScene] Camera created at:', cameraRef.current.position);
    
    rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current.setPixelRatio(window.devicePixelRatio);
    // Set size before appending
    // console.log('[ThreeScene] Renderer created. Setting initial size:', initialWidth, initialHeight);
    rendererRef.current.setSize(initialWidth, initialHeight);
    currentMount.appendChild(rendererRef.current.domElement);
    // console.log('[ThreeScene] Renderer DOM element appended.');
        
    labelRendererRef.current = new CSS2DRenderer();
    labelRendererRef.current.setSize(initialWidth, initialHeight); // Set size before appending
    labelRendererRef.current.domElement.style.position = 'absolute';
    labelRendererRef.current.domElement.style.top = '0px';
    labelRendererRef.current.domElement.style.pointerEvents = 'none';
    currentMount.appendChild(labelRendererRef.current.domElement);
    
    // Effect Composer for OutlinePass
    composerRef.current = new EffectComposer(rendererRef.current!);
    const renderPass = new RenderPass(sceneRef.current!, cameraRef.current!);
    composerRef.current.addPass(renderPass);

    outlinePassRef.current = new OutlinePass(new THREE.Vector2(initialWidth, initialHeight), sceneRef.current!, cameraRef.current!);
    // Initial minimal setup for outlinePass
    outlinePassRef.current.edgeStrength = 0;
    outlinePassRef.current.edgeGlow = 0.0; 
    outlinePassRef.current.edgeThickness = 0;
    outlinePassRef.current.visibleEdgeColor.set('#ffffff'); // Default, will be overridden
    outlinePassRef.current.hiddenEdgeColor.set('#190a05'); // Dark color for hidden edges
    outlinePassRef.current.pulsePeriod = 0; // No pulsing
    composerRef.current.addPass(outlinePassRef.current);
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
    sceneRef.current.add(ambientLight);

    const hemisphereLight = new THREE.HemisphereLight(0xADD8E6, 0x495436, 0.8); 
    sceneRef.current.add(hemisphereLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 3.0);
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = false; 
    sceneRef.current.add(directionalLight);
    // console.log('[ThreeScene] Lights added');

    controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
    controlsRef.current.enableDamping = true;
    controlsRef.current.target.set(initialCameraLookAt.x, initialCameraLookAt.y, initialCameraLookAt.z);
    controlsRef.current.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.ROTATE, 
      RIGHT: THREE.MOUSE.PAN
    };
    controlsRef.current.update();
    // console.log('[ThreeScene] OrbitControls created, target:', controlsRef.current.target);

    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0xE6D8B0, 
      side: THREE.DoubleSide,
      metalness: 0.1,
      roughness: 0.8,
      transparent: true,
      opacity: 0.4, 
    });
    groundMeshRef.current = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMeshRef.current.rotation.x = -Math.PI / 2;
    groundMeshRef.current.position.y = 0;
    groundMeshRef.current.receiveShadow = false;
    // console.log('[ThreeScene] Ground plane added');
    
    // console.log('[ThreeScene] Attempting initial resize. Mount dimensions BEFORE first handleResize:', currentMount.clientWidth + 'x' + currentMount.clientHeight);
    handleResize(); // Call handleResize once after setup
    
    const delayedResizeTimeoutId = setTimeout(() => {
      // console.log('[ThreeScene] Attempting DELAYED resize. Mount dimensions BEFORE delayed handleResize:', currentMount.clientWidth + 'x' + currentMount.clientHeight);
      handleResize();
    }, 150); // Delay to catch potential late layout shifts

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(currentMount);

    currentMount.addEventListener('click', handleClick);
    currentMount.addEventListener('mousemove', handleMouseMove);

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controlsRef.current?.update();
      if (composerRef.current && labelRendererRef.current && sceneRef.current && cameraRef.current) {
        composerRef.current.render(); // composer renders the scene + outline
        labelRendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();
    // console.log('[ThreeScene] Animation loop started');

    const handleControlsChangeEnd = () => {
      if (cameraRef.current && controlsRef.current && onCameraChangeRef.current) {
        const newCameraState = {
          position: cameraRef.current.position.clone(),
          lookAt: controlsRef.current.target.clone(),
        };
        if (lastProcessedCameraStateRef.current) {
          const oldPos = lastProcessedCameraStateRef.current.position;
          const newPos = newCameraState.position;
          const oldLookAt = lastProcessedCameraStateRef.current.lookAt;
          const newLookAt = newCameraState.lookAt;
          const posChanged = oldPos.distanceToSquared(newPos) > 0.0001;
          const lookAtChanged = oldLookAt.distanceToSquared(newLookAt) > 0.0001;
          if (!posChanged && !lookAtChanged) return;
        }
        onCameraChangeRef.current(newCameraState);
        lastProcessedCameraStateRef.current = newCameraState;
      }
    };
    controlsRef.current?.addEventListener('end', handleControlsChangeEnd);

    setIsSceneReady(true); 
    // console.log('[ThreeScene] Main setup useEffect FINISHED');
    
    return () => {
      // console.log('[ThreeScene] Cleanup running');
      cancelAnimationFrame(animationFrameId);
      clearTimeout(delayedResizeTimeoutId);
      resizeObserver.unobserve(currentMount);
      currentMount.removeEventListener('click', handleClick);
      currentMount.removeEventListener('mousemove', handleMouseMove);
      controlsRef.current?.removeEventListener('end', handleControlsChangeEnd);
      controlsRef.current?.dispose();

      equipmentMeshesRef.current.forEach(obj => {
        sceneRef.current?.remove(obj);
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
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
      
      if (sceneRef.current && groundMeshRef.current) {
        sceneRef.current.remove(groundMeshRef.current);
        groundMeshRef.current.geometry?.dispose();
        if (groundMeshRef.current.material instanceof THREE.Material) {
           groundMeshRef.current.material.dispose();
        }
      }
      
      composerRef.current?.passes.forEach(pass => { if ((pass as any).dispose) (pass as any).dispose(); });
      if (rendererRef.current?.domElement?.parentNode === currentMount) {
        currentMount.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();

      if (labelRendererRef.current?.domElement?.parentNode === currentMount) {
        currentMount.removeChild(labelRendererRef.current.domElement);
      }
      setIsSceneReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCameraPosition, initialCameraLookAt]); 

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current || equipmentMeshesRef.current.length === 0) {
      if (hoveredEquipmentTagRef.current !== null) {
         if (typeof setHoveredEquipmentTagCallbackRef.current === 'function') {
          setHoveredEquipmentTagCallbackRef.current(null);
        } else {
          // console.error('[ThreeScene] setHoveredEquipmentTagCallbackRef.current is not a function during mouse move (clearing hover).');
        }
      }
      return;
    }

    const rect = mountRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(equipmentMeshesRef.current, true);
    
    let foundHoverTag: string | null = null;
    if (intersects.length > 0) {
      let hoveredObjectCandidate = intersects[0].object;
      while (hoveredObjectCandidate.parent && !hoveredObjectCandidate.userData.tag) {
        if (hoveredObjectCandidate.parent instanceof THREE.Scene) break;
        hoveredObjectCandidate = hoveredObjectCandidate.parent;
      }
      if (hoveredObjectCandidate.userData.tag) {
        foundHoverTag = hoveredObjectCandidate.userData.tag as string;
      }
    }
    // console.log('[ThreeScene] MouseMove found:', foundHoverTag, 'Currently hovered (ref):', hoveredEquipmentTagRef.current);
    
    if (hoveredEquipmentTagRef.current !== foundHoverTag) {
      // Use the ref that holds the callback function
      if (typeof setHoveredEquipmentTagCallbackRef.current === 'function') {
        setHoveredEquipmentTagCallbackRef.current(foundHoverTag);
      } else {
        // console.error('[ThreeScene] setHoveredEquipmentTagCallbackRef.current is not a function during mouse move update.');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const handleClick = useCallback((event: MouseEvent) => {
    if (event.button !== 0) { // Only process left clicks for selection
        return;
    }
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
        while (selectedObject.parent && !selectedObject.userData.tag) {
            if (selectedObject.parent instanceof THREE.Scene) break; 
            selectedObject = selectedObject.parent;
        }
        if (selectedObject.userData.tag) {
            onSelectEquipmentRef.current(selectedObject.userData.tag as string, isMultiSelectModifierPressed);
        } else {
            onSelectEquipmentRef.current(null, isMultiSelectModifierPressed); 
        }
    } else {
        onSelectEquipmentRef.current(null, isMultiSelectModifierPressed); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update equipment meshes
  useEffect(() => {
    if (!sceneRef.current || !isSceneReady) return;
    // console.log('[ThreeScene] Updating equipment. Current mesh count:', equipmentMeshesRef.current.length);

    const newEquipmentPropTags = new Set(equipment.map(e => e.tag)); 

    equipmentMeshesRef.current = equipmentMeshesRef.current.filter(mesh => {
      const layer = layers.find(l => l.equipmentType === mesh.userData.type);
      const isVisibleByLayer = layer?.isVisible ?? true;
      const isStillInEquipmentProp = newEquipmentPropTags.has(mesh.userData.tag);

      if (!isVisibleByLayer || !isStillInEquipmentProp) {
        sceneRef.current?.remove(mesh);
        if (mesh instanceof THREE.Mesh) {
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
          } else if (mesh.material instanceof THREE.Material) {
            mesh.material.dispose();
          }
        }
        return false;
      }
      return true;
    });
    
    // console.log('[ThreeScene] Old equipment meshes removed and disposed.');
    // console.log('[ThreeScene] Visible layers:', layers.filter(l=>l.isVisible).map(l=>l.name));
    
    const newMeshes: THREE.Object3D[] = [];
    equipment.forEach(item => { 
      const layer = layers.find(l => l.equipmentType === item.type);
      const isVisibleByLayer = layer?.isVisible ?? true;
      
      if (!isVisibleByLayer) return; 

      const existingMesh = equipmentMeshesRef.current.find(mesh => mesh.userData.tag === item.tag);

      if (existingMesh) {
        if (existingMesh instanceof THREE.Mesh && existingMesh.material instanceof THREE.MeshStandardMaterial) {
          const tempNewMesh = createEquipmentMesh(item, colorMode) as THREE.Mesh; 
          if (tempNewMesh.material instanceof THREE.MeshStandardMaterial) {
            if (!existingMesh.material.color.equals(tempNewMesh.material.color) || 
                existingMesh.material.opacity !== tempNewMesh.material.opacity ||
                existingMesh.material.transparent !== tempNewMesh.material.transparent) {
                existingMesh.material.color.copy(tempNewMesh.material.color);
                existingMesh.material.opacity = tempNewMesh.material.opacity;
                existingMesh.material.transparent = tempNewMesh.material.transparent;
                existingMesh.material.needsUpdate = true;
            }
          }
          tempNewMesh.geometry?.dispose();
          if (tempNewMesh.material instanceof THREE.Material) tempNewMesh.material.dispose();
        }
      } else {
        const obj = createEquipmentMesh(item, colorMode);
        sceneRef.current?.add(obj);
        newMeshes.push(obj);
      }
    });
    
    if (newMeshes.length > 0) {
      equipmentMeshesRef.current.push(...newMeshes);
      // console.log(`[ThreeScene] Added ${newMeshes.length} new equipment meshes. Total scene children: ${sceneRef.current?.children.length}`);
    }

    const terrainLayer = layers.find(l => l.equipmentType === 'Terrain');
    if (terrainLayer && groundMeshRef.current && sceneRef.current) {
      const isGroundInScene = sceneRef.current.children.includes(groundMeshRef.current);
      if (terrainLayer.isVisible && !isGroundInScene) {
        sceneRef.current.add(groundMeshRef.current);
      } else if (!terrainLayer.isVisible && isGroundInScene) {
        sceneRef.current.remove(groundMeshRef.current);
      }
    }
  }, [equipment, layers, createEquipmentMesh, colorMode, isSceneReady]); 

  // useEffect for OutlinePass
  useEffect(() => {
    if (!outlinePassRef.current || !sceneRef.current || !equipmentMeshesRef.current || !isSceneReady) {
      // console.log('[ThreeScene OutlinePass] SKIPPING: Core refs not ready or scene not ready yet.');
      return;
    }
  
    // Default props if they are undefined on first run or due to timing
    const effectiveSelectedTags = Array.isArray(selectedEquipmentTags) ? selectedEquipmentTags : [];
    const effectiveHoveredTag = hoveredEquipmentTag === undefined ? null : hoveredEquipmentTag;
  
    // console.log(`[ThreeScene OutlinePass] Received Props: selectedTags=${JSON.stringify(selectedEquipmentTags)}, hoveredTag=${hoveredEquipmentTag}`);
    // console.log(`[ThreeScene OutlinePass] Effective Values: selected=${JSON.stringify(effectiveSelectedTags)}, hovered=${effectiveHoveredTag}`);
  
    const objectsToOutline: THREE.Object3D[] = [];
  
    const meshesToConsider = equipmentMeshesRef.current.filter(mesh => mesh.visible);
    // if (meshesToConsider.length > 0) {
    //   console.log(`[ThreeScene OutlinePass] Meshes to consider for outline: ${meshesToConsider.map(m => m.userData.tag).join(', ') || 'None'}`);
    // }
  
    if (effectiveSelectedTags.length > 0) {
      effectiveSelectedTags.forEach(tag => {
        const selectedMesh = meshesToConsider.find(mesh => mesh.userData.tag === tag);
        if (selectedMesh) {
          objectsToOutline.push(selectedMesh);
          // console.log(`[ThreeScene OutlinePass] Adding selected mesh to outline: ${tag}`);
        } else {
          // console.log(`[ThreeScene OutlinePass] Selected mesh NOT FOUND or not in meshesToConsider: ${tag}`);
        }
      });
      if (objectsToOutline.length > 0) {
        outlinePassRef.current.visibleEdgeColor.set('#0000FF'); // Strong Blue for selected
        outlinePassRef.current.edgeStrength = 10; // Increased strength
        outlinePassRef.current.edgeThickness = 2;  // Increased thickness
        outlinePassRef.current.edgeGlow = 0.7;      // Increased glow
        // console.log(`[ThreeScene OutlinePass] Style: SELECTED. Outlining: ${objectsToOutline.map(o => o.userData.tag).join(', ')}`);
      } else {
        // This case should ideally not be hit if effectiveSelectedTags.length > 0
        // unless no selected meshes are found/visible.
        outlinePassRef.current.edgeStrength = 0;
        // console.log('[ThreeScene OutlinePass] Style: SELECTED (but no meshes added to outline). Turning off strength.');
      }
    } else if (effectiveHoveredTag) {
      const hoveredMesh = meshesToConsider.find(mesh => mesh.userData.tag === effectiveHoveredTag);
      if (hoveredMesh) {
        objectsToOutline.push(hoveredMesh);
        // console.log(`[ThreeScene OutlinePass] Adding hovered mesh to outline: ${effectiveHoveredTag}`);
        outlinePassRef.current.visibleEdgeColor.set('#87CEFA'); // Light Sky Blue for hovered
        outlinePassRef.current.edgeStrength = 7;  // Increased strength
        outlinePassRef.current.edgeThickness = 1.5; // Increased thickness
        outlinePassRef.current.edgeGlow = 0.5;   // Increased glow
        // console.log(`[ThreeScene OutlinePass] Style: HOVERED. Outlining: ${objectsToOutline.map(o => o.userData.tag).join(', ')}`);
      } else {
        outlinePassRef.current.edgeStrength = 0;
        // console.log(`[ThreeScene OutlinePass] Style: HOVERED (but mesh ${effectiveHoveredTag} not found/visible). Turning off strength.');
      }
    } else {
      // No selection or hover
      outlinePassRef.current.edgeStrength = 0;
      // console.log('[ThreeScene OutlinePass] Style: NONE.');
    }
  
    // Ensure glow and thickness are reset if strength is 0
    if (outlinePassRef.current.edgeStrength === 0) {
      outlinePassRef.current.edgeGlow = 0;
      outlinePassRef.current.edgeThickness = 0;
    }
  
    outlinePassRef.current.selectedObjects = objectsToOutline;
    outlinePassRef.current.pulsePeriod = 0; // Explicitly set to prevent pulsing
    // console.log(`[ThreeScene OutlinePass] Final selectedObjects for outlinePass: ${objectsToOutline.map(o => o.userData.tag).join(', ') || 'None'}`);
  
  }, [selectedEquipmentTags, hoveredEquipmentTag, equipment, layers, isSceneReady]); // equipment and layers affect equipmentMeshesRef


  // useEffect for annotation pins
  useEffect(() => {
    if (!sceneRef.current || !labelRendererRef.current || !isSceneReady) return;

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
        const equipmentForItem = equipment.find(e => e.tag === anno.equipmentTag); 
        if (equipmentForItem) {
            const pinDiv = document.createElement('div');
            // Corrected the SVG pin template literal
            pinDiv.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#FFD700" style="opacity: 0.9; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5));">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 4.17 4.42 9.92 6.24 12.11.4.48 1.13.48 1.53 0C14.58 18.92 19 13.17 19 9c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
              </svg>`;
            pinDiv.style.pointerEvents = 'none'; 
            pinDiv.style.width = '24px';
            pinDiv.style.height = '24px';
            
            const pinLabel = new CSS2DObject(pinDiv);
            
            let yOffset = 0;
            // Use the original height/size for yOffset calculation
            const baseItem = initialEquipment.find(e => e.tag === equipmentForItem.tag);
            if (baseItem) {
                if (baseItem.type === 'Tank' || baseItem.type === 'Pipe') {
                    yOffset = (baseItem.height || 0) / 2 + 0.8; 
                } else if (baseItem.size?.height) {
                    yOffset = baseItem.size.height / 2 + 0.8; 
                } else {
                    yOffset = 1.3; 
                }
            } else {
                 yOffset = 1.3; // Fallback
            }
            pinLabel.position.set(equipmentForItem.position.x, equipmentForItem.position.y + yOffset, equipmentForItem.position.z);
            
            sceneRef.current?.add(pinLabel);
            annotationPinObjectsRef.current.push(pinLabel);
        }
      });
    }
  }, [annotations, layers, equipment, isSceneReady, initialEquipment]); // Added initialEquipment for pin yOffset


  // useEffect for programmatic camera changes
  useEffect(() => {
    if (programmaticCameraState && cameraRef.current && controlsRef.current && isSceneReady) {
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
        lastProcessedCameraStateRef.current = { position: camera.position.clone(), lookAt: controls.target.clone() };
      }
    }
  }, [programmaticCameraState, isSceneReady]);

  // useEffect to frame a target system
  useEffect(() => {
    if (!targetSystemToFrame || !sceneRef.current || !cameraRef.current || !controlsRef.current || equipmentMeshesRef.current.length === 0 || !isSceneReady) {
      if (targetSystemToFrame) {
        onSystemFramed(); 
      }
      return;
    }
    // console.log(`[ThreeScene] Framing system: ${targetSystemToFrame}`);

    const systemMeshes = equipmentMeshesRef.current.filter(
      (mesh) => mesh.userData.sistema === targetSystemToFrame && mesh.visible // Only consider visible meshes
    );

    if (systemMeshes.length === 0) {
      // console.log(`[ThreeScene] No visible meshes found for system: ${targetSystemToFrame}`);
      onSystemFramed(); 
      return;
    }

    const totalBoundingBox = new THREE.Box3();
    systemMeshes.forEach(mesh => {
      if ((mesh as THREE.Mesh).geometry) { 
        mesh.updateMatrixWorld(true); 
        const meshBox = new THREE.Box3().setFromObject(mesh);
        totalBoundingBox.union(meshBox);
      }
    });

    if (totalBoundingBox.isEmpty()) {
      // console.log(`[ThreeScene] Bounding box is empty for system: ${targetSystemToFrame}`);
      onSystemFramed(); 
      return;
    }

    const center = new THREE.Vector3();
    totalBoundingBox.getCenter(center);
    const size = new THREE.Vector3();
    totalBoundingBox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = cameraRef.current.fov * (Math.PI / 180);
    let cameraDistance = maxDim / (2 * Math.tan(fov / 2));
    cameraDistance = cameraDistance * 1.5; 
    cameraDistance = Math.max(cameraDistance, 5); // Ensure a minimum distance

    const newCamPos = new THREE.Vector3(
      center.x,
      center.y + Math.max(size.y * 0.5, maxDim * 0.3), 
      center.z + cameraDistance 
    );
     if (size.y < maxDim * 0.2) { 
       newCamPos.y = center.y + cameraDistance * 0.5; 
     }
     newCamPos.y = Math.max(newCamPos.y, center.y + 2); // Ensure camera is slightly above the center

    // console.log(`[ThreeScene] New camera for system ${targetSystemToFrame}: Pos -`, newCamPos, 'LookAt -', center);
    if (onCameraChangeRef.current) {
      onCameraChangeRef.current({
        position: newCamPos,
        lookAt: center,
      });
    }
    onSystemFramed(); 
  }, [targetSystemToFrame, onSystemFramed, equipment, layers, isSceneReady]); 

  return <div ref={mountRef} className="w-full h-full" />;
}; 

// Need to get initialEquipment from page.tsx to correctly calculate pin yOffset if equipment is filtered
const initialEquipment: Equipment[] = [
  { tag: 'bldg-01', name: 'Main Office', type: 'Building', sistema: 'NDD', area: 'Área 20', operationalState: 'Não aplicável', product: 'Não aplicável', category: 'Administrative', position: { x: -15, y: 3, z: -10 }, size: { width: 8, height: 6, depth: 10 }, color: '#78909C', details: 'Primary administrative building.' },
  { tag: 'bldg-02', name: 'Warehouse A', type: 'Building', sistema: 'GA', area: 'Área 31', operationalState: 'Não aplicável', product: 'Não aplicável', category: 'Storage', position: { x: 15, y: 4, z: -12 }, size: { width: 15, height: 8, depth: 12 }, color: '#78909C', details: 'Storage for dry goods.' },
  { tag: 'bldg-03', name: 'Control Room', type: 'Building', sistema: 'MTBE', area: 'Área 32', operationalState: 'Não aplicável', product: 'Não aplicável', category: 'Operational', position: { x: 0, y: 2, z: -15 }, size: { width: 6, height: 4, depth: 6 }, color: '#78909C', details: 'Central operations control.' },
  { tag: 'crane-01', name: 'Gantry Crane 1', type: 'Crane', sistema: 'QAV', area: 'Área 40', operationalState: 'operando', product: '70H', category: 'Lifting', position: { x: 0, y: 5, z: 8 }, size: { width: 12, height: 10, depth: 2 }, color: '#FF8A65', details: 'Heavy lift gantry crane.' },
  { tag: 'crane-02', name: 'Jib Crane', type: 'Crane', sistema: 'LASTRO', area: 'Área 50', operationalState: 'manutenção', product: '6DH', category: 'Lifting', position: { x: -10, y: 3.5, z: 5 }, size: { width: 1.5, height: 7, depth: 1.5 }, color: '#FFB74D', details: 'Small jib crane for workshop.' },
  { tag: 'tank-01', name: 'Storage Tank Alpha', type: 'Tank', sistema: 'ODB', area: 'Área 33', operationalState: 'em falha', product: '70H', category: 'Storage', position: { x: -8, y: 2.5, z: 12 }, radius: 3, height: 5, color: '#4FC3F7', details: 'Liquid storage tank.' },
  { tag: 'tank-02', name: 'Storage Tank Beta', type: 'Tank', sistema: 'ESCUROS', area: 'Área 33', operationalState: 'não operando', product: '6DH', category: 'Storage', position: { x: -2, y: 2, z: 12 }, radius: 2.5, height: 4, color: '#4DD0E1', details: 'Auxiliary liquid storage.' },
  { tag: 'tank-03', name: 'Process Tank Gamma', type: 'Tank', sistema: 'NDD', area: 'Área 34', operationalState: 'manutenção', product: '660', category: 'Processing', position: { x: 5, y: 3, z: 10 }, radius: 2, height: 6, color: '#4DB6AC', details: 'Processing tank.' },
  { tag: 'pipe-01', name: 'Main Feed Pipe', type: 'Pipe', sistema: 'GA', area: 'Área 35', operationalState: 'operando', product: '70H', category: 'Transfer', position: { x: -5, y: 1, z: 5 }, radius: 0.3, height: 10, color: '#B0BEC5', details: 'Connects Tank Alpha to Process Area.', rotation: { x: 0, y: 0, z: Math.PI / 2 } },
  { tag: 'pipe-02', name: 'Process Output Pipe', type: 'Pipe', sistema: 'MTBE', area: 'Área 34', operationalState: 'não operando', product: '660', category: 'Transfer', position: { x: 0, y: 2.5, z: 9 }, radius: 0.2, height: 8, color: '#90A4AE', details: 'Carries product from Process Tank Gamma.', rotation: { x: Math.PI / 2, y: 0, z: 0 } },
  { tag: 'pipe-03', name: 'Vertical Riser', type: 'Pipe', sistema: 'QAV', area: 'Área 60', operationalState: 'em falha', product: '198', category: 'Transfer', position: { x: 8, y: 3.5, z: 8 }, radius: 0.25, height: 7, color: '#B0BEC5', details: 'Vertical pipe section.' },
  { tag: 'valve-01', name: 'Tank Alpha Outlet Valve', type: 'Valve', sistema: 'LASTRO', area: 'Área 33', operationalState: 'operando', product: '70H', category: 'Control', position: { x: -8, y: 0.5, z: 8.8 }, radius: 0.4, color: '#EF5350', details: 'Controls flow from Tank Alpha.' },
  { tag: 'valve-02', name: 'Process Inlet Valve', type: 'Valve', sistema: 'ODB', area: 'Área 34', operationalState: 'manutenção', product: '70H', category: 'Control', position: { x: -1, y: 2.5, z: 5 }, radius: 0.3, color: '#F44336', details: 'Controls input to Process Tank Gamma.' },
  { tag: 'valve-03', name: 'Safety Bypass Valve', type: 'Valve', sistema: 'ESCUROS', area: 'Área 60', operationalState: 'em falha', product: '198', category: 'Control', position: { x: 8, y: 0.5, z: 4.5 }, radius: 0.3, color: '#E57373', details: 'Emergency bypass valve.' },
];


export default ThreeScene;
