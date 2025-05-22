
"use client";

import React, { useRef, useEffect, useCallback } from 'react';
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
  selectedEquipmentTags: string[];
  onSelectEquipment: (equipmentTag: string | null, isMultiSelectModifierPressed: boolean) => void;
  cameraState?: CameraState;
  onCameraChange?: (cameraState: CameraState) => void;
  initialCameraPosition: { x: number; y: number; z: number };
  initialCameraLookAt: { x: number; y: number; z: number };
  hoveredEquipmentTag: string | null;
  setHoveredEquipmentTag: (tag: string | null) => void;
  colorMode: 'Produto' | 'Estado Operacional' | 'Equipamento';
  targetSystemToFrame: string | null;
  onSystemFramed: () => void;
}

function getCharNumericValue(char: string): number {
  const upperChar = char.toUpperCase();
  const charCode = upperChar.charCodeAt(0);
  if (charCode >= '0'.charCodeAt(0) && charCode <= '9'.charCodeAt(0)) {
    return charCode - '0'.charCodeAt(0); // 0-9
  } else if (charCode >= 'A'.charCodeAt(0) && charCode <= 'Z'.charCodeAt(0)) {
    return charCode - 'A'.charCodeAt(0) + 10; // 10-35 for A-Z
  }
  return 0; // Default for unexpected characters
}


const ThreeScene: React.FC<ThreeSceneProps> = ({
  equipment: filteredEquipmentData,
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
  const setHoveredEquipmentTagRef = useRef(setHoveredEquipmentTag);
  const lastProcessedCameraStateRef = useRef<CameraState | null>(null);


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
    setHoveredEquipmentTagRef.current = setHoveredEquipmentTag;
  }, [setHoveredEquipmentTag]);

  const handleResize = useCallback(() => {
    if (mountRef.current && cameraRef.current && rendererRef.current && labelRendererRef.current && composerRef.current) {
      const width = Math.max(1, mountRef.current.clientWidth);
      const height = Math.max(1, mountRef.current.clientHeight);

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


  const createEquipmentMesh = useCallback((item: Equipment, currentGlobalColorMode: ColorMode): THREE.Object3D => {
    let finalColor = new THREE.Color();
    let stateColor = new THREE.Color();

    switch (currentGlobalColorMode) {
      case 'Produto':
        if (item.product && item.product !== "Não aplicável" && item.product.length >= 3) {
          const rVal = getCharNumericValue(item.product.charAt(0));
          const gVal = getCharNumericValue(item.product.charAt(1));
          const bVal = getCharNumericValue(item.product.charAt(2));
          finalColor.setRGB(rVal / 35.0, gVal / 35.0, bVal / 35.0);
        } else {
          finalColor.set(item.color);
        }
        break;
      case 'Estado Operacional':
        switch (item.operationalState) {
          case 'operando': stateColor.setHex(0xFF0000); break; // Red
          case 'não operando': stateColor.setHex(0x00FF00); break; // Green
          case 'manutenção': stateColor.setHex(0xFFFF00); break; // Yellow
          case 'em falha': stateColor.setHex(0xDA70D6); break; // Orchid (Roxo claro/rosa)
          case 'Não aplicável': 
          default: 
            stateColor.set(item.color); 
            break;
        }
        finalColor.copy(stateColor);
        break;
      case 'Equipamento':
      default:
        finalColor.set(item.color);
        break;
    }
    
    const material = new THREE.MeshStandardMaterial({
      color: finalColor,
      metalness: 0.3,
      roughness: 0.6
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

    mesh.position.set(item.position.x, item.position.y, item.position.z);
    if (item.rotation) {
      mesh.rotation.set(item.rotation.x, item.rotation.y, item.rotation.z);
    }
    mesh.userData = { tag: item.tag, type: item.type, sistema: item.sistema };
    mesh.castShadow = false; 
    mesh.receiveShadow = false;
    return mesh;
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;

    // console.log("[ThreeScene] Main setup useEffect RUNNING");
    // console.log("[ThreeScene] Mount dimensions AT START of useEffect:", currentMount.clientWidth, "x", currentMount.clientHeight);

    sceneRef.current = new THREE.Scene();
    sceneRef.current.background = new THREE.Color(0xA9C1D1); 
    sceneRef.current.fog = new THREE.Fog(0xA9C1D1, 40, 150);


    const initialWidth = Math.max(1, currentMount.clientWidth);
    const initialHeight = Math.max(1, currentMount.clientHeight);

    cameraRef.current = new THREE.PerspectiveCamera(75, initialWidth / initialHeight, 0.1, 1000);
    cameraRef.current.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);
    // console.log("[ThreeScene] Camera created at:", cameraRef.current.position.clone());

    rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current.setPixelRatio(window.devicePixelRatio);
    currentMount.appendChild(rendererRef.current.domElement);
    // console.log("[ThreeScene] Renderer DOM element appended.");

    labelRendererRef.current = new CSS2DRenderer();
    labelRendererRef.current.domElement.style.position = 'absolute';
    labelRendererRef.current.domElement.style.top = '0px';
    labelRendererRef.current.domElement.style.pointerEvents = 'none';
    currentMount.appendChild(labelRendererRef.current.domElement);
    
    // console.log("[ThreeScene] Attempting initial resize. Mount dimensions BEFORE first handleResize:", currentMount.clientWidth, "x", currentMount.clientHeight);
    handleResize(); // Call handleResize once after renderer is set up and appended


    // Post-processing setup
    composerRef.current = new EffectComposer(rendererRef.current);
    const renderPass = new RenderPass(sceneRef.current, cameraRef.current);
    composerRef.current.addPass(renderPass);

    outlinePassRef.current = new OutlinePass(new THREE.Vector2(initialWidth, initialHeight), sceneRef.current, cameraRef.current);
    outlinePassRef.current.edgeStrength = 3;
    outlinePassRef.current.edgeGlow = 0.5;
    outlinePassRef.current.edgeThickness = 1;
    outlinePassRef.current.pulsePeriod = 0;
    // visibleEdgeColor will be set dynamically based on hover/selection
    composerRef.current.addPass(outlinePassRef.current);


    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0); // Increased intensity
    sceneRef.current.add(ambientLight);

    const hemisphereLight = new THREE.HemisphereLight(0xADD8E6, 0x495436, 0.8); 
    sceneRef.current.add(hemisphereLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 3.0); // Increased intensity
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = false;
    sceneRef.current.add(directionalLight);
    // console.log("[ThreeScene] Lights added");

    controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
    controlsRef.current.enableDamping = true;
    controlsRef.current.target.set(initialCameraLookAt.x, initialCameraLookAt.y, initialCameraLookAt.z);
    controlsRef.current.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.PAN
    };
    controlsRef.current.update();
    // console.log("[ThreeScene] OrbitControls created, target:", controlsRef.current.target.clone());

    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0xE6D8B0, 
      side: THREE.DoubleSide,
      metalness: 0.1,
      roughness: 0.8,
      transparent: true,
      opacity: 0.4 
    });
    groundMeshRef.current = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMeshRef.current.rotation.x = -Math.PI / 2;
    groundMeshRef.current.position.y = 0;
    groundMeshRef.current.receiveShadow = false;
    // console.log("[ThreeScene] Ground plane added");

    // Delay a resize call to ensure layout is stable
    const delayedResizeTimeoutId = setTimeout(() => {
        // console.log("[ThreeScene] Attempting DELAYED resize. Mount dimensions BEFORE delayed handleResize:", currentMount.clientWidth, "x", currentMount.clientHeight);
        handleResize();
    }, 150);


    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(currentMount);

    currentMount.addEventListener('click', handleClick);
    currentMount.addEventListener('mousemove', handleMouseMove);

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controlsRef.current?.update();
      composerRef.current?.render(); 
      labelRendererRef.current?.render(sceneRef.current!, cameraRef.current!);
    };
    animate();
    // console.log("[ThreeScene] Animation loop started");

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
    // console.log("[ThreeScene] Main setup useEffect FINISHED");

    return () => {
      // console.log("[ThreeScene] Cleanup: Main setup useEffect");
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
        groundMeshRef.current = null;
      }

      composerRef.current?.passes.forEach(pass => {
        if ((pass as any).dispose) (pass as any).dispose();
      });
      composerRef.current?.renderer.dispose();
      composerRef.current = null;
      outlinePassRef.current = null;


      if (rendererRef.current?.domElement?.parentNode === currentMount) {
        currentMount.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
      rendererRef.current = null;

      if (labelRendererRef.current?.domElement?.parentNode === currentMount) {
        currentMount.removeChild(labelRendererRef.current.domElement);
      }
      labelRendererRef.current = null;

      sceneRef.current = null;
      cameraRef.current = null;
    };
  }, [initialCameraPosition, initialCameraLookAt, handleResize]); // Ensure handleResize is stable

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current || equipmentMeshesRef.current.length === 0) {
      if (hoveredEquipmentTagRef.current !== null) {
        setHoveredEquipmentTagRef.current(null);
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
        foundHoverTag = hoveredObjectCandidate.userData.tag;
      }
    }
    
    if (hoveredEquipmentTagRef.current !== foundHoverTag) {
      // console.log('[ThreeScene] MouseMove found:', foundHoverTag, 'Currently hovered (ref):', hoveredEquipmentTagRef.current);
      // console.log('[ThreeScene] Setting hoveredEquipmentTag to:', foundHoverTag);
      setHoveredEquipmentTagRef.current(foundHoverTag);
    }
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
        onSelectEquipmentRef.current(selectedObject.userData.tag, isMultiSelectModifierPressed);
      } else {
        onSelectEquipmentRef.current(null, isMultiSelectModifierPressed);
      }
    } else {
      onSelectEquipmentRef.current(null, isMultiSelectModifierPressed);
    }
  }, []);

  useEffect(() => {
    if (!sceneRef.current) return;
    // console.log("[ThreeScene] Updating equipment. Current mesh count:", equipmentMeshesRef.current.length);

    const currentEquipmentTags = new Set(filteredEquipmentData.map(e => e.tag));
    
    equipmentMeshesRef.current = equipmentMeshesRef.current.filter(mesh => {
      if (!currentEquipmentTags.has(mesh.userData.tag)) {
        sceneRef.current?.remove(mesh);
        if (mesh instanceof THREE.Mesh) {
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
          } else if (mesh.material) {
            (mesh.material as THREE.Material).dispose();
          }
        }
        return false;
      }
      return true;
    });
    // console.log("[ThreeScene] Old equipment meshes removed and disposed.");


    let addedCount = 0;
    filteredEquipmentData.forEach(item => {
      const existingMesh = equipmentMeshesRef.current.find(mesh => mesh.userData.tag === item.tag);
      const layer = layers.find(l => l.equipmentType === item.type);
      const isVisibleByLayer = layer?.isVisible ?? true;

      if (existingMesh) {
        existingMesh.visible = isVisibleByLayer;
        if (isVisibleByLayer && existingMesh instanceof THREE.Mesh) {
          const newMesh = createEquipmentMesh(item, colorMode) as THREE.Mesh;
          const oldMat = existingMesh.material as THREE.MeshStandardMaterial;
          const newMat = newMesh.material as THREE.MeshStandardMaterial;
          
          if (oldMat && newMat) {
            if (!oldMat.color.equals(newMat.color) || oldMat.opacity !== newMat.opacity || oldMat.transparent !== newMat.transparent) {
              oldMat.color.copy(newMat.color);
              oldMat.opacity = newMat.opacity;
              oldMat.transparent = newMat.transparent;
              oldMat.needsUpdate = true;
            }
          }
          newMesh.geometry?.dispose();
          if (newMesh.material) (newMesh.material as THREE.Material).dispose();
        }
      } else {
        if (isVisibleByLayer) {
          const obj = createEquipmentMesh(item, colorMode);
          sceneRef.current?.add(obj);
          equipmentMeshesRef.current.push(obj);
          addedCount++;
        }
      }
    });
    // if(addedCount > 0) console.log(`[ThreeScene] Added ${addedCount} new equipment meshes. Total scene children: ${sceneRef.current?.children.length}`);

    const terrainLayer = layers.find(l => l.equipmentType === 'Terrain');
    if (terrainLayer && groundMeshRef.current && sceneRef.current) {
      const isGroundInScene = sceneRef.current.children.includes(groundMeshRef.current);
      if (terrainLayer.isVisible && !isGroundInScene) {
        sceneRef.current.add(groundMeshRef.current);
      } else if (!terrainLayer.isVisible && isGroundInScene) {
        sceneRef.current.remove(groundMeshRef.current);
      }
    }
  }, [filteredEquipmentData, layers, createEquipmentMesh, colorMode]);

  useEffect(() => {
    // console.log("[ThreeScene] Highlighting effect. Selected:", selectedEquipmentTags, "Hovered:", hoveredEquipmentTag);
    if (!outlinePassRef.current || !sceneRef.current) return;

    const objectsToOutline: THREE.Object3D[] = [];
    const meshesToConsider = equipmentMeshesRef.current.filter(mesh => mesh.visible);
    
    // Check if selectedEquipmentTags is an array before accessing its length
    if (Array.isArray(selectedEquipmentTags) && selectedEquipmentTags.length > 0) {
      selectedEquipmentTags.forEach(tag => {
        const selectedMesh = meshesToConsider.find(mesh => mesh.userData.tag === tag);
        if (selectedMesh) {
          objectsToOutline.push(selectedMesh);
        }
      });
      outlinePassRef.current.visibleEdgeColor.set(0x0000FF); // Strong Blue for selected
      outlinePassRef.current.edgeStrength = 5;
      outlinePassRef.current.edgeThickness = 1.5;
      outlinePassRef.current.edgeGlow = 0.7;
    } else if (hoveredEquipmentTag) {
      const hoveredMesh = meshesToConsider.find(mesh => mesh.userData.tag === hoveredEquipmentTag);
      if (hoveredMesh) {
        objectsToOutline.push(hoveredMesh);
      }
      outlinePassRef.current.visibleEdgeColor.set(0x87CEFA); // Light Sky Blue for hovered
      outlinePassRef.current.edgeStrength = 4;
      outlinePassRef.current.edgeThickness = 1;
      outlinePassRef.current.edgeGlow = 0.5;
    }

    outlinePassRef.current.selectedObjects = objectsToOutline;
  }, [selectedEquipmentTags, hoveredEquipmentTag, filteredEquipmentData, layers]);


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
        const equipmentForItem = filteredEquipmentData.find(e => e.tag === anno.equipmentTag);
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
    if (programmaticCameraState && cameraRef.current && controlsRef.current) {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      
      // console.log("[ThreeScene] Programmatic camera update:", programmaticCameraState);

      const targetPosition = new THREE.Vector3(programmaticCameraState.position.x, programmaticCameraState.position.y, programmaticCameraState.position.z);
      const targetLookAt = programmaticCameraState.lookAt ? new THREE.Vector3(programmaticCameraState.lookAt.x, programmaticCameraState.lookAt.y, programmaticCameraState.lookAt.z) : controls.target.clone();

      const positionChanged = !camera.position.equals(targetPosition);
      const lookAtChanged = !controls.target.equals(targetLookAt);
      
      // console.log(`[ThreeScene] Applying programmatic camera change. Pos changed: ${positionChanged} LookAt changed: ${lookAtChanged}`);

      if (positionChanged || lookAtChanged) {
        const oldControlsEnabled = controls.enabled;
        controls.enabled = false; 
        
        if (positionChanged) camera.position.copy(targetPosition);
        if (lookAtChanged) controls.target.copy(targetLookAt);
        
        controls.update(); 
        controls.enabled = oldControlsEnabled; 

        lastProcessedCameraStateRef.current = { position: camera.position.clone(), lookAt: controls.target.clone() };
      }
    }
  }, [programmaticCameraState]);

  useEffect(() => {
    if (!targetSystemToFrame || !sceneRef.current || !cameraRef.current || !controlsRef.current || equipmentMeshesRef.current.length === 0) {
      if (targetSystemToFrame) onSystemFramed();
      return;
    }

    const systemMeshes = equipmentMeshesRef.current.filter(
      (mesh) => mesh.userData.sistema === targetSystemToFrame && mesh.visible
    );

    if (systemMeshes.length === 0) {
      onSystemFramed();
      return;
    }

    const totalBoundingBox = new THREE.Box3();
    systemMeshes.forEach(mesh => {
      if (mesh instanceof THREE.Mesh && mesh.geometry) {
        mesh.updateMatrixWorld(true); 
        const meshBox = new THREE.Box3().setFromObject(mesh);
        totalBoundingBox.union(meshBox);
      }
    });

    if (totalBoundingBox.isEmpty()) {
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


    if (onCameraChangeRef.current) {
      onCameraChangeRef.current({
        position: newCamPos,
        lookAt: center,
      });
    }

    onSystemFramed();
  }, [targetSystemToFrame, onSystemFramed, filteredEquipmentData]);


  return <div ref={mountRef} className="w-full h-full" />;
};

export default ThreeScene;

    