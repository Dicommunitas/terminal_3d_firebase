
"use client";

import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import type { Equipment, Layer, CameraState, Annotation } from '@/lib/types';
import type { ColorMode } from '@/app/page'; // Assuming ColorMode is exported from page.tsx


// Helper function to convert char to numeric value for color generation
function getCharNumericValue(char: string): number {
  const upperChar = char.toUpperCase();
  const charCode = upperChar.charCodeAt(0);
  if (charCode >= '0'.charCodeAt(0) && charCode <= '9'.charCodeAt(0)) {
    return charCode - '0'.charCodeAt(0); // 0-9
  } else if (charCode >= 'A'.charCodeAt(0) && charCode <= 'Z'.charCodeAt(0)) {
    return charCode - 'A'.charCodeAt(0) + 10; // 10-35 for A-Z
  }
  return 0; // Default for other characters
}


interface ThreeSceneProps {
  equipment: Equipment[];
  layers: Layer[];
  annotations: Annotation[];
  selectedEquipmentTags: string[]; // Changed from selectedEquipmentId
  onSelectEquipment: (equipmentTag: string | null, isMultiSelectModifierPressed: boolean) => void; // Changed from equipmentId
  cameraState?: CameraState;
  onCameraChange?: (cameraState: CameraState) => void;
  initialCameraPosition: { x: number; y: number; z: number };
  initialCameraLookAt: { x: number; y: number; z: number };
  hoveredEquipmentTag: string | null; // Changed from hoveredEquipmentId
  setHoveredEquipmentTag: (tag: string | null) => void; // Changed from setId
  colorMode: ColorMode;
  targetSystemToFrame: string | null;
  onSystemFramed: () => void;
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

  // For OutlinePass
  const composerRef = useRef<EffectComposer | null>(null);
  const outlinePassRef = useRef<OutlinePass | null>(null);

  // Refs for callbacks to avoid re-running main useEffect
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
        if (composerRef.current) {
          composerRef.current.setSize(width, height);
        }
        if (outlinePassRef.current) {
          outlinePassRef.current.resolution.set(width, height);
        }
      }
    }
  }, []);


  const createEquipmentMesh = useCallback((item: Equipment, currentGlobalColorMode: ColorMode): THREE.Object3D => {
    let baseColor = new THREE.Color(item.color);
    let finalColor = new THREE.Color(); // Initialize with a default
    let stateColor = new THREE.Color(); // For operational state coloring

    switch (currentGlobalColorMode) {
        case 'Produto':
            if (item.product && item.product !== "Não aplicável" && item.product.length >= 3) {
                const rVal = getCharNumericValue(item.product.charAt(0));
                const gVal = getCharNumericValue(item.product.charAt(1));
                const bVal = getCharNumericValue(item.product.charAt(2));
                finalColor.setRGB(rVal / 35.0, gVal / 35.0, bVal / 35.0);
            } else {
                finalColor.copy(baseColor); // Fallback to base color
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
                    stateColor.copy(baseColor); // Use base color if state is not applicable or undefined
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
            geometry = new THREE.SphereGeometry(1, 16, 16); // Default sphere
            mesh = new THREE.Mesh(geometry, material);
    }

    mesh.position.copy(item.position as THREE.Vector3);
    if (item.rotation) {
        mesh.rotation.set(item.rotation.x, item.rotation.y, item.rotation.z);
    }
    mesh.userData = { tag: item.tag, type: item.type, sistema: item.sistema }; // Store tag
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return mesh;
  }, []);


  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;

    sceneRef.current = new THREE.Scene();
    sceneRef.current.background = new THREE.Color(0xA9C1D1); // Light grayish-blue background
    sceneRef.current.fog = new THREE.Fog(0xA9C1D1, 40, 150); // Fog matches background

    const initialWidth = Math.max(1, currentMount.clientWidth);
    const initialHeight = Math.max(1, currentMount.clientHeight);

    cameraRef.current = new THREE.PerspectiveCamera(75, initialWidth / initialHeight, 0.1, 1000);
    cameraRef.current.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);
    
    rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current.setPixelRatio(window.devicePixelRatio);
    rendererRef.current.setSize(initialWidth, initialHeight);
    currentMount.appendChild(rendererRef.current.domElement);
    
    labelRendererRef.current = new CSS2DRenderer();
    labelRendererRef.current.setSize(initialWidth, initialHeight);
    labelRendererRef.current.domElement.style.position = 'absolute';
    labelRendererRef.current.domElement.style.top = '0px';
    labelRendererRef.current.domElement.style.pointerEvents = 'none';
    currentMount.appendChild(labelRendererRef.current.domElement);
    
    // Post-processing setup for OutlinePass
    composerRef.current = new EffectComposer(rendererRef.current!);
    const renderPass = new RenderPass(sceneRef.current!, cameraRef.current!);
    composerRef.current.addPass(renderPass);

    outlinePassRef.current = new OutlinePass(new THREE.Vector2(initialWidth, initialHeight), sceneRef.current!, cameraRef.current!);
    outlinePassRef.current.edgeStrength = 0; // Initially invisible
    outlinePassRef.current.edgeGlow = 0;
    outlinePassRef.current.edgeThickness = 0;
    outlinePassRef.current.visibleEdgeColor.set(0x0000ff); // Default blue, will be adjusted
    composerRef.current.addPass(outlinePassRef.current);

    handleResize(); // Ensure initial size is set correctly

    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
    sceneRef.current.add(ambientLight);

    const hemisphereLight = new THREE.HemisphereLight(0xADD8E6, 0x495436, 0.8); 
    sceneRef.current.add(hemisphereLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 3.0);
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = false; // Shadows disabled
    sceneRef.current.add(directionalLight);

    controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
    controlsRef.current.enableDamping = true;
    controlsRef.current.target.set(initialCameraLookAt.x, initialCameraLookAt.y, initialCameraLookAt.z);
    controlsRef.current.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.PAN
    };
    controlsRef.current.update();

    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0xE6D8B0, // Neutral sand color
      side: THREE.DoubleSide,
      metalness: 0.1,
      roughness: 0.8,
      transparent: true,
      opacity: 0.4, // Increased transparency
    });
    groundMeshRef.current = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMeshRef.current.rotation.x = -Math.PI / 2;
    groundMeshRef.current.position.y = 0;
    groundMeshRef.current.receiveShadow = false; // Shadows disabled
    // Ground is added/removed based on layer visibility
    
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(currentMount);

    currentMount.addEventListener('click', handleClick);
    currentMount.addEventListener('mousemove', handleMouseMove);

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controlsRef.current?.update();
      if (composerRef.current && labelRendererRef.current && sceneRef.current && cameraRef.current) {
        composerRef.current.render(); // Use composer for rendering
        labelRendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

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

    const delayedResizeTimeoutId = setTimeout(() => {
      handleResize();
    }, 150);


    return () => {
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
        if (groundMeshRef.current.material) {
           (groundMeshRef.current.material as THREE.Material).dispose();
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
      // labelRendererRef.current has no dispose method

      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      labelRendererRef.current = null;
      composerRef.current = null;
      outlinePassRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCameraPosition, initialCameraLookAt]); // Main setup runs once


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
        foundHoverTag = hoveredObjectCandidate.userData.tag as string;
      }
    }

    if (hoveredEquipmentTagRef.current !== foundHoverTag) {
      setHoveredEquipmentTagRef.current(foundHoverTag);
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
        // Traverse up to find the parent mesh with userData.tag if the clicked object is a child part
        while (selectedObject.parent && !selectedObject.userData.tag) {
            if (selectedObject.parent instanceof THREE.Scene) break; // Stop if we reach the scene root
            selectedObject = selectedObject.parent;
        }
        if (selectedObject.userData.tag) {
            onSelectEquipmentRef.current(selectedObject.userData.tag as string, isMultiSelectModifierPressed);
        } else {
            onSelectEquipmentRef.current(null, isMultiSelectModifierPressed); // Clicked on something without a tag
        }
    } else {
        onSelectEquipmentRef.current(null, isMultiSelectModifierPressed); // Clicked on empty space
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    if (!sceneRef.current) return;

    const currentEquipmentTags = new Set(filteredEquipmentData.map(e => e.tag));
    
    // Remove old meshes
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

    // Add or update meshes
    filteredEquipmentData.forEach(item => {
      const existingMesh = equipmentMeshesRef.current.find(mesh => mesh.userData.tag === item.tag);
      const layer = layers.find(l => l.equipmentType === item.type);
      const isVisibleByLayer = layer?.isVisible ?? true;

      if (existingMesh) {
        existingMesh.visible = isVisibleByLayer;
        if (isVisibleByLayer && existingMesh instanceof THREE.Mesh) {
          // Recreate mesh to update color based on colorMode
          const newMesh = createEquipmentMesh(item, colorMode) as THREE.Mesh;
          if (existingMesh.material instanceof THREE.MeshStandardMaterial && newMesh.material instanceof THREE.MeshStandardMaterial) {
            if (!existingMesh.material.color.equals(newMesh.material.color) || 
                existingMesh.material.opacity !== newMesh.material.opacity ||
                existingMesh.material.transparent !== newMesh.material.transparent) {
                existingMesh.material.color.copy(newMesh.material.color);
                existingMesh.material.opacity = newMesh.material.opacity;
                existingMesh.material.transparent = newMesh.material.transparent;
                existingMesh.material.needsUpdate = true;
            }
          }
          // Dispose temporary mesh parts
          newMesh.geometry?.dispose();
          if (newMesh.material) (newMesh.material as THREE.Material).dispose();
        }
      } else {
        if (isVisibleByLayer) {
          const obj = createEquipmentMesh(item, colorMode);
          sceneRef.current?.add(obj);
          equipmentMeshesRef.current.push(obj);
        }
      }
    });

    // Terrain visibility
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


  // useEffect for OutlinePass based on selection and hover
  useEffect(() => {
    if (!outlinePassRef.current || !sceneRef.current || !equipmentMeshesRef.current) {
        return;
    }
  
    const objectsToOutline: THREE.Object3D[] = [];
    const meshesToConsider = equipmentMeshesRef.current.filter(mesh => mesh.visible);
  
    // Default: no outline
    let strength = 0;
    let glow = 0;
    let thickness = 0;
    let color = 0x000000; // Black (effectively invisible with strength 0)
  
    if (Array.isArray(selectedEquipmentTags) && selectedEquipmentTags.length > 0) {
        selectedEquipmentTags.forEach(tag => {
            const selectedMesh = meshesToConsider.find(mesh => mesh.userData.tag === tag);
            if (selectedMesh) {
                objectsToOutline.push(selectedMesh);
            }
        });
        if (objectsToOutline.length > 0) {
            color = 0x0000FF; // Strong Blue for selected
            strength = 5;
            thickness = 1.5;
            glow = 0.7;
        }
    } else if (hoveredEquipmentTag) {
        const hoveredMesh = meshesToConsider.find(mesh => mesh.userData.tag === hoveredEquipmentTag);
        if (hoveredMesh) {
            objectsToOutline.push(hoveredMesh);
            color = 0x87CEFA; // Light Sky Blue for hovered
            strength = 4;
            thickness = 1;
            glow = 0.5;
        }
    }
  
    outlinePassRef.current.selectedObjects = objectsToOutline;
    outlinePassRef.current.visibleEdgeColor.setHex(color);
    outlinePassRef.current.edgeStrength = strength;
    outlinePassRef.current.edgeThickness = thickness;
    outlinePassRef.current.edgeGlow = glow;
  
  }, [selectedEquipmentTags, hoveredEquipmentTag, filteredEquipmentData, layers]);


  useEffect(() => {
    if (!sceneRef.current || !labelRendererRef.current) return;

    // Clear existing annotation pins
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
        // Find the equipment item in the currently filtered list (if not, pin might not show)
        const equipmentForItem = filteredEquipmentData.find(e => e.tag === anno.equipmentTag);
        if (equipmentForItem) {
            const pinDiv = document.createElement('div');
            pinDiv.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#FFD700" style="opacity: 0.9; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5));">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 4.17 4.42 9.92 6.24 12.11.4.48 1.13.48 1.53 0C14.58 18.92 19 13.17 19 9c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
              </svg>`;
            pinDiv.style.pointerEvents = 'none'; // Pins should not block mouse events for the scene
            pinDiv.style.width = '24px';
            pinDiv.style.height = '24px';
            // pinDiv.style.cursor = 'pointer'; // Optional: if you want to make pins clickable later

            const pinLabel = new CSS2DObject(pinDiv);
            
            let yOffset = 0;
            if (equipmentForItem.type === 'Tank' || equipmentForItem.type === 'Pipe') {
                yOffset = (equipmentForItem.height || 0) / 2 + 0.8; // Top of cylinder + offset
            } else if (equipmentForItem.size?.height) {
                yOffset = equipmentForItem.size.height / 2 + 0.8; // Top of box + offset
            } else {
                yOffset = 1.3; // Default offset for spheres or other types
            }
            pinLabel.position.set(equipmentForItem.position.x, equipmentForItem.position.y + yOffset, equipmentForItem.position.z);
            
            sceneRef.current?.add(pinLabel);
            annotationPinObjectsRef.current.push(pinLabel);
        }
      });
    }
  }, [annotations, layers, filteredEquipmentData]); // Re-run if annotations, layers, or filtered data changes


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
        controls.enabled = false; // Temporarily disable controls to prevent interference
        
        if (positionChanged) camera.position.copy(targetPosition);
        if (lookAtChanged) controls.target.copy(targetLookAt);
        
        controls.update(); // Important to apply the new target and position
        controls.enabled = oldControlsEnabled; // Re-enable controls

        // Store the last processed state to prevent immediate re-triggering if the input prop hasn't "really" changed
        lastProcessedCameraStateRef.current = { position: camera.position.clone(), lookAt: controls.target.clone() };
      }
    }
  }, [programmaticCameraState]);

  useEffect(() => {
    if (!targetSystemToFrame || !sceneRef.current || !cameraRef.current || !controlsRef.current || equipmentMeshesRef.current.length === 0) {
      if (targetSystemToFrame) onSystemFramed(); // Ensure callback is called if we bail early
      return;
    }

    const systemMeshes = equipmentMeshesRef.current.filter(
      (mesh) => mesh.userData.sistema === targetSystemToFrame && mesh.visible
    );

    if (systemMeshes.length === 0) {
      onSystemFramed(); // No meshes for this system, reset
      return;
    }

    const totalBoundingBox = new THREE.Box3();
    systemMeshes.forEach(mesh => {
      if (mesh.geometry) { // Ensure mesh has geometry
        mesh.updateMatrixWorld(true); // Ensure world matrix is up to date
        const meshBox = new THREE.Box3().setFromObject(mesh);
        totalBoundingBox.union(meshBox);
      }
    });

    if (totalBoundingBox.isEmpty()) {
      onSystemFramed(); // Bounding box is empty, reset
      return;
    }

    const center = new THREE.Vector3();
    totalBoundingBox.getCenter(center);

    const size = new THREE.Vector3();
    totalBoundingBox.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = cameraRef.current.fov * (Math.PI / 180);
    let cameraDistance = maxDim / (2 * Math.tan(fov / 2));

    cameraDistance = cameraDistance * 1.5; // Add some padding
    cameraDistance = Math.max(cameraDistance, 5); // Ensure a minimum distance

    // Calculate a new camera position: offset from the center along Z, and slightly elevated
    const newCamPos = new THREE.Vector3(
      center.x,
      center.y + Math.max(size.y * 0.5, maxDim * 0.3), // Elevate based on object height or overall dimension
      center.z + cameraDistance // Distance back from the center
    );

     // If the objects are very flat (e.g., pipes on the ground), raise the camera more
     if (size.y < maxDim * 0.2) { 
       newCamPos.y = center.y + cameraDistance * 0.5; 
     }
     newCamPos.y = Math.max(newCamPos.y, center.y + 2); // Minimum elevation

    if (onCameraChangeRef.current) {
      onCameraChangeRef.current({
        position: newCamPos,
        lookAt: center,
      });
    }

    onSystemFramed(); // Signal that framing is complete
  }, [targetSystemToFrame, onSystemFramed, filteredEquipmentData, layers]); // Added layers as equipmentMeshesRef depends on it for visibility

  return <div ref={mountRef} className="w-full h-full" />;
};

export default ThreeScene;
