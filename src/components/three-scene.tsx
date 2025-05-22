
"use client";

import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import type { Equipment, Layer, CameraState, Annotation } from '@/lib/types';
import type { ColorMode } from '@/components/layer-manager';
import { getEquipmentColor } from '@/core/graphics/color-utils';


interface ThreeSceneProps {
  equipment: Equipment[];
  layers: Layer[];
  annotations: Annotation[];
  selectedEquipmentTags: string[] | undefined;
  onSelectEquipment: (equipmentTag: string | null, isMultiSelectModifierPressed: boolean) => void;
  hoveredEquipmentTag: string | null | undefined;
  setHoveredEquipmentTag: (tag: string | null) => void;
  cameraState?: CameraState;
  onCameraChange: (cameraState: CameraState) => void;
  initialCameraPosition: { x: number; y: number; z: number };
  initialCameraLookAt: { x: number; y: number; z: number };
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
  hoveredEquipmentTag,
  setHoveredEquipmentTag,
  cameraState: programmaticCameraState,
  onCameraChange,
  initialCameraPosition,
  initialCameraLookAt,
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
  const setHoveredEquipmentTagCallbackRef = useRef(setHoveredEquipmentTag);
  const hoveredEquipmentTagRef = useRef(hoveredEquipmentTag);

  const [isSceneReady, setIsSceneReady] = useState(false);
  
  // Log props on render for debugging
  // console.log('[ThreeScene RENDER] Props: ', { selectedEquipmentTags, hoveredEquipmentTag, colorMode, targetSystemToFrame, equipmentCount: equipment.length });


  useEffect(() => {
    onSelectEquipmentRef.current = onSelectEquipment;
  }, [onSelectEquipment]);

  useEffect(() => {
    onCameraChangeRef.current = onCameraChange;
  }, [onCameraChange]);
  
  useEffect(() => {
    setHoveredEquipmentTagCallbackRef.current = setHoveredEquipmentTag;
  }, [setHoveredEquipmentTag]);

  useEffect(() => {
    hoveredEquipmentTagRef.current = hoveredEquipmentTag;
  }, [hoveredEquipmentTag]);

  const handleResize = useCallback(() => {
    if (mountRef.current && cameraRef.current && rendererRef.current && labelRendererRef.current && composerRef.current && outlinePassRef.current) {
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
        outlinePassRef.current.resolution.set(width, height);
      }
    } else {
      // console.warn('[ThreeScene] handleResize called but some refs are null.');
    }
  }, []);

  const createEquipmentMesh = useCallback((item: Equipment): THREE.Object3D => {
    const finalColor = getEquipmentColor(item, colorMode);
    
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
  }, [colorMode]);

  // Main setup useEffect
  useEffect(() => {
    // console.log('[ThreeScene] Main setup useEffect RUNNING');
    if (!mountRef.current) {
      // console.warn('[ThreeScene] Main setup useEffect: mountRef.current is null, returning.');
      return;
    }
    const currentMount = mountRef.current;
    // console.log(`[ThreeScene] Mount dimensions AT START of useEffect: ${currentMount.clientWidth}x${currentMount.clientHeight}`);

    sceneRef.current = new THREE.Scene();
    sceneRef.current.background = new THREE.Color(0xA9C1D1); 
    sceneRef.current.fog = new THREE.Fog(0xA9C1D1, 40, 150); 
    // console.log('[ThreeScene] Scene created');
    
    const initialWidth = Math.max(1, currentMount.clientWidth);
    const initialHeight = Math.max(1, currentMount.clientHeight);

    cameraRef.current = new THREE.PerspectiveCamera(75, initialWidth / initialHeight, 0.1, 1000);
    cameraRef.current.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);
    // console.log('[ThreeScene] Camera created at:', cameraRef.current.position.clone());
    
    rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current.setPixelRatio(window.devicePixelRatio);
    currentMount.appendChild(rendererRef.current.domElement);
    // console.log('[ThreeScene] Renderer created and appended.');
    
    labelRendererRef.current = new CSS2DRenderer();
    labelRendererRef.current.domElement.style.position = 'absolute';
    labelRendererRef.current.domElement.style.top = '0px';
    labelRendererRef.current.domElement.style.pointerEvents = 'none';
    currentMount.appendChild(labelRendererRef.current.domElement);
    // console.log('[ThreeScene] LabelRenderer created and appended.');
    
    composerRef.current = new EffectComposer(rendererRef.current!);
    const renderPass = new RenderPass(sceneRef.current!, cameraRef.current!);
    composerRef.current.addPass(renderPass);

    outlinePassRef.current = new OutlinePass(new THREE.Vector2(initialWidth, initialHeight), sceneRef.current!, cameraRef.current!);
    outlinePassRef.current.edgeStrength = 3; 
    outlinePassRef.current.edgeGlow = 0.0; 
    outlinePassRef.current.edgeThickness = 1;
    outlinePassRef.current.visibleEdgeColor.set('#ffffff'); 
    outlinePassRef.current.hiddenEdgeColor.set('#190a05'); 
    outlinePassRef.current.pulsePeriod = 0; 
    composerRef.current.addPass(outlinePassRef.current);
    // console.log('[ThreeScene] Composer and OutlinePass configured.');
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
    sceneRef.current.add(ambientLight);

    const hemisphereLight = new THREE.HemisphereLight(0xADD8E6, 0x495436, 0.8); 
    sceneRef.current.add(hemisphereLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 3.0); 
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = false; 
    sceneRef.current.add(directionalLight);
    // console.log('[ThreeScene] Lights added.');
    
    controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
    controlsRef.current.enableDamping = true;
    controlsRef.current.target.set(initialCameraLookAt.x, initialCameraLookAt.y, initialCameraLookAt.z);
    controlsRef.current.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY, 
      RIGHT: THREE.MOUSE.PAN
    };
    controlsRef.current.update();
    // console.log('[ThreeScene] OrbitControls created, target:', controlsRef.current.target.clone());

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
    // console.log('[ThreeScene] Ground plane added.');
    
    // console.log(`[ThreeScene] Attempting initial resize. Mount dimensions BEFORE first handleResize: ${currentMount.clientWidth}x${currentMount.clientHeight}`);
    handleResize();  // Call resize after everything is set up

    const delayedResizeTimeoutId = setTimeout(() => {
      // console.log(`[ThreeScene] Attempting DELAYED resize. Mount dimensions BEFORE delayed handleResize: ${currentMount.clientWidth}x${currentMount.clientHeight}`);
      handleResize();
    }, 150);

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(currentMount);
    // console.log('[ThreeScene] ResizeObserver attached.');

    currentMount.addEventListener('click', handleClick);
    currentMount.addEventListener('mousemove', handleMouseMove);
    // console.log('[ThreeScene] Event listeners (click, mousemove) added.');

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controlsRef.current?.update();
      if (composerRef.current && labelRendererRef.current && sceneRef.current && cameraRef.current) {
        composerRef.current.render();
        labelRendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();
    // console.log('[ThreeScene] Animation loop started.');
    
    const handleControlsChangeEnd = () => {
      if (cameraRef.current && controlsRef.current && onCameraChangeRef.current) {
        const newCameraState = {
          position: cameraRef.current.position.clone(),
          lookAt: controlsRef.current.target.clone(),
        };
        // console.log('[ThreeScene] OrbitControls change end, calling onCameraChange with:', newCameraState);
        onCameraChangeRef.current(newCameraState);
      }
    };
    controlsRef.current?.addEventListener('end', handleControlsChangeEnd);
    // console.log('[ThreeScene] OrbitControls "end" listener added.');

    setIsSceneReady(true); 
    // console.log('[ThreeScene] Scene is now READY.');
    
    // console.log('[ThreeScene] Main setup useEffect FINISHED');
    return () => {
      // console.log('[ThreeScene] Cleanup: Main setup useEffect');
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
      // console.log('[ThreeScene] Cleanup: Scene NOT ready.');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const handleMouseMove = useCallback((event: MouseEvent) => {
    // console.log(`[ThreeScene] handleMouseMove triggered`);
    if (!isSceneReady || !mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current) {
        // console.log('[ThreeScene] handleMouseMove: SKIPPING due to unready refs or meshes.');
        if (hoveredEquipmentTagRef.current !== null && typeof setHoveredEquipmentTagCallbackRef.current === 'function') {
             setHoveredEquipmentTagCallbackRef.current(null);
        }
        return;
    }
    
    const currentMountForMove = mountRef.current; // Capture for closure
    if (!currentMountForMove) {
        // console.log('[ThreeScene] handleMouseMove: SKIPPING due to mountRef.current being null inside callback scope.');
        return;
    }


    const rect = currentMountForMove.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

    const intersects = raycasterRef.current.intersectObjects(equipmentMeshesRef.current.filter(m => m.visible), true);
    
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
      // console.log('[ThreeScene] MouseMove: Hovered tag changed. Calling setHoveredEquipmentTagCallbackRef.current with:', foundHoverTag);
      if (typeof setHoveredEquipmentTagCallbackRef.current === 'function') {
        setHoveredEquipmentTagCallbackRef.current(foundHoverTag);
      } else {
        // console.error('[ThreeScene] setHoveredEquipmentTagCallbackRef.current is not a function during mouse move update.');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSceneReady]); 

  const handleClick = useCallback((event: MouseEvent) => {
    // console.log(`[ThreeScene] handleClick triggered, button: ${event.button}`);
    if (event.button !== 0) { 
        // console.log('[ThreeScene] handleClick: Non-left button click, ignoring for selection.');
        return;
    }
    if (!isSceneReady ||!mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current) {
      // console.log('[ThreeScene] handleClick: SKIPPING due to unready refs or meshes.');
      return;
    }

    const currentMountForClick = mountRef.current;
    if (!currentMountForClick) {
      // console.log('[ThreeScene] handleClick: SKIPPING due to mountRef.current being null inside callback scope.');
      return;
    }

    const rect = currentMountForClick.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(equipmentMeshesRef.current.filter(m => m.visible), true);

    const isMultiSelectModifierPressed = event.ctrlKey || event.metaKey;
    let tagToSelect: string | null = null;

    if (intersects.length > 0) {
        let selectedObject = intersects[0].object;
        while (selectedObject.parent && !selectedObject.userData.tag) {
            if (selectedObject.parent instanceof THREE.Scene) break; 
            selectedObject = selectedObject.parent;
        }
        if (selectedObject.userData.tag) {
            tagToSelect = selectedObject.userData.tag as string;
        }
    }
    
    // console.log(`[ThreeScene] handleClick: About to call onSelectEquipment. Tag: ${tagToSelect}, MultiSelect: ${isMultiSelectModifierPressed}. Callback type: ${typeof onSelectEquipmentRef.current}`);
    if (typeof onSelectEquipmentRef.current === 'function') {
      onSelectEquipmentRef.current(tagToSelect, isMultiSelectModifierPressed);
    } else {
      // console.error("[ThreeScene] handleClick - onSelectEquipmentRef.current is NOT a function.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSceneReady]);

  // Update equipment meshes
  useEffect(() => {
    // console.log(`[ThreeScene] Updating equipment. Meshes: ${equipmentMeshesRef.current.length}, New data count: ${equipment.length}, ColorMode: ${colorMode}, isSceneReady: ${isSceneReady}`);
    if (!sceneRef.current || !isSceneReady) {
      // console.log('[ThreeScene] Updating equipment: SKIPPING - Scene not ready.');
      return;
    }

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
    
    // const visibleLayerTypes = new Set(layers.filter(l => l.isVisible).map(l => l.equipmentType));
    // console.log(`[ThreeScene] Visible layers: ${Array.from(visibleLayerTypes).join(', ')}`);

    const newMeshes: THREE.Object3D[] = [];
    equipment.forEach(item => { 
      const layer = layers.find(l => l.equipmentType === item.type);
      const isVisibleByLayer = layer?.isVisible ?? true;
      
      if (!isVisibleByLayer) return; 

      const existingMesh = equipmentMeshesRef.current.find(mesh => mesh.userData.tag === item.tag);

      if (existingMesh) {
        if (existingMesh instanceof THREE.Mesh && existingMesh.material instanceof THREE.MeshStandardMaterial) {
            const newColor = getEquipmentColor(item, colorMode);
            const newOpacity = item.operationalState === 'Não aplicável' ? 0.5 : 1.0;
            const newTransparent = item.operationalState === 'Não aplicável';

            if (!existingMesh.material.color.equals(newColor) || 
                existingMesh.material.opacity !== newOpacity ||
                existingMesh.material.transparent !== newTransparent) {
                existingMesh.material.color.copy(newColor);
                existingMesh.material.opacity = newOpacity;
                existingMesh.material.transparent = newTransparent;
                existingMesh.material.needsUpdate = true;
            }
        }
      } else {
        const obj = createEquipmentMesh(item);
        sceneRef.current?.add(obj);
        newMeshes.push(obj);
      }
    });
    
    if (newMeshes.length > 0) {
      equipmentMeshesRef.current.push(...newMeshes);
      // console.log(`[ThreeScene] Added ${newMeshes.length} new equipment meshes. Total scene children: ${sceneRef.current.children.length}`);
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
  }, [equipment, layers, colorMode, isSceneReady, createEquipmentMesh]); 

  // useEffect for annotation pins
  useEffect(() => {
    // console.log(`[ThreeScene] Updating annotations. Count: ${annotations.length}, isSceneReady: ${isSceneReady}`);
    if (!sceneRef.current || !labelRendererRef.current || !isSceneReady) {
      // console.log('[ThreeScene] Updating annotations: SKIPPING - Scene not ready or label renderer not ready.');
      return;
    }

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
            pinDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#FFD700" style="opacity: 0.9; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5));"><path d="M12 2C8.13 2 5 5.13 5 9c0 4.17 4.42 9.92 6.24 12.11.4.48 1.13.48 1.53 0C14.58 18.92 19 13.17 19 9c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>`;
            pinDiv.style.pointerEvents = 'none'; 
            pinDiv.style.width = '24px';
            pinDiv.style.height = '24px';
            
            const pinLabel = new CSS2DObject(pinDiv);
            
            let yOffset = 0;
            const baseItem = equipment.find(e => e.tag === equipmentForItem.tag); 
            if (baseItem) {
                if (baseItem.type === 'Tank' || baseItem.type === 'Pipe') {
                    yOffset = (baseItem.height || 0) / 2 + 0.8; 
                } else if (baseItem.size?.height) {
                    yOffset = baseItem.size.height / 2 + 0.8; 
                } else {
                    yOffset = 1.3; 
                }
            } else {
                 yOffset = 1.3; 
            }
            pinLabel.position.set(equipmentForItem.position.x, equipmentForItem.position.y + yOffset, equipmentForItem.position.z);
            
            sceneRef.current?.add(pinLabel);
            annotationPinObjectsRef.current.push(pinLabel);
        }
      });
      // console.log(`[ThreeScene] Added ${annotationPinObjectsRef.current.length} annotation pins.`);
    }
  }, [annotations, layers, equipment, isSceneReady]);


  // useEffect for programmatic camera changes
  useEffect(() => {
    if (programmaticCameraState && cameraRef.current && controlsRef.current && isSceneReady) {
      // console.log('[ThreeScene] Programmatic camera update:', programmaticCameraState);
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
  }, [programmaticCameraState, isSceneReady]);

  // useEffect to frame a target system
  useEffect(() => {
    if (!targetSystemToFrame || !sceneRef.current || !cameraRef.current || !controlsRef.current || equipmentMeshesRef.current.length === 0 || !isSceneReady) {
      if (targetSystemToFrame) {
        // console.log(`[ThreeScene] Framing system: ${targetSystemToFrame} - SKIPPING or system framed.`);
        onSystemFramed(); 
      }
      return;
    }
    // console.log(`[ThreeScene] Attempting to frame system: ${targetSystemToFrame}`);

    const systemMeshes = equipmentMeshesRef.current.filter(
      (mesh) => mesh.userData.sistema === targetSystemToFrame && mesh.visible
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
      // console.log(`[ThreeScene] Bounding box for system ${targetSystemToFrame} is empty.`);
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
    cameraDistance = Math.max(cameraDistance, 5);

    const newCamPos = new THREE.Vector3(
      center.x,
      center.y + Math.max(size.y * 0.5, maxDim * 0.3), 
      center.z + cameraDistance 
    );
     if (size.y < maxDim * 0.2) { 
       newCamPos.y = center.y + cameraDistance * 0.5; 
     }
     newCamPos.y = Math.max(newCamPos.y, center.y + 2);

    // console.log(`[ThreeScene] Framing system ${targetSystemToFrame}. New cam pos:`, newCamPos, "LookAt:", center);
    if (onCameraChangeRef.current) {
      onCameraChangeRef.current({
        position: newCamPos,
        lookAt: center,
      });
    }
    onSystemFramed(); 
  }, [targetSystemToFrame, onSystemFramed, equipment, layers, isSceneReady]); 


  // useEffect for OutlinePass
  useEffect(() => {
    if (!isSceneReady || !outlinePassRef.current || !sceneRef.current || !equipmentMeshesRef.current) {
      // console.log('[ThreeScene OutlinePass] SKIPPING: Core refs not ready or scene not ready yet.');
      if (outlinePassRef.current) outlinePassRef.current.selectedObjects = [];
      return;
    }
  
    // Default props if they are undefined on first run
    const effectiveSelectedTags = selectedEquipmentTags ?? [];
    const effectiveHoveredTag = hoveredEquipmentTag === undefined ? null : hoveredEquipmentTag;
    
    // console.log(`[ThreeScene OutlinePass] Received Props: selectedTags=${JSON.stringify(selectedEquipmentTags)}, hoveredTag=${hoveredEquipmentTag}`);
    // console.log(`[ThreeScene OutlinePass] Effective Values: selected=${JSON.stringify(effectiveSelectedTags)}, hovered=${effectiveHoveredTag}`);

    let objectsToOutline: THREE.Object3D[] = [];
    const meshesToConsider = equipmentMeshesRef.current.filter(mesh => mesh.visible);
    // console.log(`[ThreeScene OutlinePass] Meshes to consider for outline: ${meshesToConsider.map(m => m.userData.tag).join(', ')}`);
  
    if (effectiveSelectedTags.length > 0) {
      effectiveSelectedTags.forEach(tag => {
        const selectedMesh = meshesToConsider.find(mesh => mesh.userData.tag === tag);
        if (selectedMesh) {
          objectsToOutline.push(selectedMesh);
          // console.log(`[ThreeScene OutlinePass] Adding SELECTED mesh to outline: ${tag}`);
        } else {
          // console.log(`[ThreeScene OutlinePass] SELECTED mesh NOT FOUND: ${tag}`);
        }
      });
      if (objectsToOutline.length > 0) {
        outlinePassRef.current.visibleEdgeColor.set('#0000FF'); // Blue
        outlinePassRef.current.edgeStrength = 10; 
        outlinePassRef.current.edgeThickness = 2; 
        outlinePassRef.current.edgeGlow = 0.7;
        // console.log(`[ThreeScene OutlinePass] Style: SELECTED. Strength ${outlinePassRef.current.edgeStrength}. Outlining: ${objectsToOutline.map(o => o.userData.tag).join(', ')}`);
      }
    } else if (effectiveHoveredTag) {
      const hoveredMesh = meshesToConsider.find(mesh => mesh.userData.tag === effectiveHoveredTag);
      if (hoveredMesh) {
        objectsToOutline.push(hoveredMesh);
        // console.log(`[ThreeScene OutlinePass] Adding HOVERED mesh to outline: ${effectiveHoveredTag}`);
        outlinePassRef.current.visibleEdgeColor.set('#87CEFA'); // LightSkyBlue
        outlinePassRef.current.edgeStrength = 7;  
        outlinePassRef.current.edgeThickness = 1.5; 
        outlinePassRef.current.edgeGlow = 0.5;
        // console.log(`[ThreeScene OutlinePass] Style: HOVERED. Strength ${outlinePassRef.current.edgeStrength}. Outlining: ${hoveredMesh.userData.tag}`);
      } else {
        // console.log(`[ThreeScene OutlinePass] HOVERED mesh NOT FOUND: ${effectiveHoveredTag}`);
        outlinePassRef.current.edgeStrength = 0;
        outlinePassRef.current.edgeGlow = 0;
        outlinePassRef.current.edgeThickness = 0;
      }
    } else {
      outlinePassRef.current.edgeStrength = 0;
      outlinePassRef.current.edgeGlow = 0;
      outlinePassRef.current.edgeThickness = 0;
      // console.log('[ThreeScene OutlinePass] Style: NONE. Strength 0.');
    }
  
    outlinePassRef.current.selectedObjects = objectsToOutline;
    outlinePassRef.current.pulsePeriod = 0; 
    // console.log(`[ThreeScene OutlinePass] Final selectedObjects for outlinePass: ${objectsToOutline.length > 0 ? objectsToOutline.map(o => o.userData.tag).join(', ') : 'None'}`);
  
  }, [selectedEquipmentTags, hoveredEquipmentTag, equipment, layers, isSceneReady]);

  return <div ref={mountRef} className="w-full h-full" />;
};

export default ThreeScene;
    
