
/**
 * @fileoverview Componente React para renderizar a cena 3D usando Three.js.
 *
 * Responsabilidades:
 * - Configurar a cena, câmera, luzes, renderizador, controles e efeitos de pós-processamento.
 * - Renderizar os meshes dos equipamentos com base nas props recebidas (dados, camadas, modo de cor).
 * - Renderizar indicadores visuais (pins) para anotações.
 * - Delegar o processamento de interações do mouse (clique para seleção, movimento para hover) para o mouse-interaction-manager.
 * - Atualizar a câmera programaticamente (e.g., para focar em sistemas).
 * - Gerenciar o redimensionamento da cena e o loop de animação.
 */
"use client";

import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import type { Equipment, Layer, CameraState, Annotation } from '@/lib/types';
import type { ColorMode } from '@/components/color-mode-selector'; // Ajustado o import
import { getEquipmentColor } from '@/core/graphics/color-utils';
import { processSceneClick, processSceneMouseMove } from '@/core/three/mouse-interaction-manager';
import { createGeometryForItem } from '@/core/three/equipment-geometry-factory';

interface ThreeSceneProps {
  equipment: Equipment[];
  layers: Layer[];
  annotations: Annotation[];
  selectedEquipmentTags: string[] | undefined; // Pode ser undefined inicialmente
  onSelectEquipment: (equipmentTag: string | null, isMultiSelectModifierPressed: boolean) => void;
  hoveredEquipmentTag: string | null | undefined; // Pode ser undefined inicialmente
  setHoveredEquipmentTag: (tag: string | null) => void;
  cameraState?: CameraState;
  onCameraChange: (cameraState: CameraState) => void;
  initialCameraPosition: { x: number; y: number; z: number };
  initialCameraLookAt: { x: number; y: number; z: number };
  colorMode: ColorMode;
  targetSystemToFrame: string | null;
  onSystemFramed: () => void;
}

/**
 * Componente ThreeScene para renderização e interação 3D.
 * Gerencia a configuração da cena, renderização de objetos, interações e efeitos visuais.
 */
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
  // console.log(`[ThreeScene RENDER] Props: `, { selectedEquipmentTags, hoveredEquipmentTag, colorMode, targetSystemToFrame, equipmentCount: equipment?.length });

  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const equipmentMeshesRef = useRef<THREE.Object3D[]>([]);
  const annotationPinObjectsRef = useRef<CSS2DObject[]>([]);
  const groundMeshRef = useRef<THREE.Mesh | null>(null);

  const composerRef = useRef<EffectComposer | null>(null);
  const outlinePassRef = useRef<OutlinePass | null>(null);

  // Refs para callbacks para evitar problemas de closure em event handlers
  const onSelectEquipmentRef = useRef(onSelectEquipment);
  const onCameraChangeRef = useRef(onCameraChange);
  const setHoveredEquipmentTagCallbackRef = useRef(setHoveredEquipmentTag);
  const hoveredEquipmentTagRef = useRef(hoveredEquipmentTag); // Para comparar no handleMouseMove
  
  const [isSceneReady, setIsSceneReady] = useState(false);

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


  /**
   * Manipula o redimensionamento da cena quando o tamanho do contêiner muda.
   * Atualiza o aspect ratio da câmera e os tamanhos do renderer, labelRenderer e composer.
   */
  const handleResize = useCallback(() => {
    if (mountRef.current && cameraRef.current && rendererRef.current && labelRendererRef.current && composerRef.current && outlinePassRef.current) {
      const width = Math.max(1, mountRef.current.clientWidth);
      const height = Math.max(1, mountRef.current.clientHeight);
      
      // console.log(`[ThreeScene] handleResize CALLED. New dimensions: ${width}x${height}`);

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      
      rendererRef.current.setSize(width, height);
      labelRendererRef.current.setSize(width, height);
      composerRef.current.setSize(width, height);
      outlinePassRef.current.resolution.set(width, height);
    }
  }, []);

  /**
   * Cria um mesh 3D para um equipamento.
   * @param {Equipment} item - O objeto de equipamento.
   * @returns {THREE.Object3D} O mesh 3D criado.
   */
  const createEquipmentMesh = useCallback((item: Equipment): THREE.Object3D => {
    const finalColor = getEquipmentColor(item, colorMode);
    
    const material = new THREE.MeshStandardMaterial({
        color: finalColor,
        metalness: 0.3,
        roughness: 0.6,
    });

    if (item.operationalState === 'Não aplicável') {
        material.transparent = true;
        material.opacity = 0.5; // Ajustado conforme solicitado
    } else {
        material.transparent = false;
        material.opacity = 1.0;
    }

    const geometry = createGeometryForItem(item);
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.copy(item.position as THREE.Vector3);
    if (item.rotation) {
        mesh.rotation.set(item.rotation.x, item.rotation.y, item.rotation.z);
    }
    mesh.userData = { tag: item.tag, type: item.type, sistema: item.sistema }; 
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    // console.log(`[ThreeScene createEquipmentMesh] Created mesh for ${item.tag} with color ${finalColor.getHexString()} and state ${item.operationalState}`);
    return mesh;
  }, [colorMode]);

  /**
   * useEffect para configuração inicial da cena Three.js.
   * Roda apenas uma vez na montagem do componente.
   */
  useEffect(() => {
    // console.log('[ThreeScene] Main setup useEffect RUNNING');
    if (!mountRef.current) {
        // console.log('[ThreeScene] Main setup: mountRef.current is not available. Bailing out.');
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
    // console.log('[ThreeScene] Renderer DOM element appended.');
    
    labelRendererRef.current = new CSS2DRenderer();
    labelRendererRef.current.domElement.style.position = 'absolute';
    labelRendererRef.current.domElement.style.top = '0px';
    labelRendererRef.current.domElement.style.pointerEvents = 'none';
    currentMount.appendChild(labelRendererRef.current.domElement);
    
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
        
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0); // Ajustado
    sceneRef.current.add(ambientLight);

    const hemisphereLight = new THREE.HemisphereLight(0xADD8E6, 0x495436, 0.8); 
    sceneRef.current.add(hemisphereLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 3.0); // Ajustado
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = false; // Sombras desabilitadas
    sceneRef.current.add(directionalLight);
    // console.log('[ThreeScene] Lights added.');
    
    controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
    controlsRef.current.enableDamping = true;
    controlsRef.current.target.set(initialCameraLookAt.x, initialCameraLookAt.y, initialCameraLookAt.z);
    controlsRef.current.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY, // Revertido para padrão
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
      opacity: 0.4, // Ajustado conforme solicitado
    });
    groundMeshRef.current = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMeshRef.current.rotation.x = -Math.PI / 2;
    groundMeshRef.current.position.y = 0;
    groundMeshRef.current.receiveShadow = false; // Sombras desabilitadas
    sceneRef.current.add(groundMeshRef.current);
    // console.log('[ThreeScene] Ground plane added.');
    
    // console.log(`[ThreeScene] Attempting initial resize. Mount dimensions BEFORE first handleResize: ${currentMount.clientWidth}x${currentMount.clientHeight}`);
    handleResize(); // Initial resize attempt

    const delayedResizeTimeoutId = setTimeout(() => {
      // console.log(`[ThreeScene] Attempting DELAYED resize. Mount dimensions BEFORE delayed handleResize: ${currentMount.clientWidth}x${currentMount.clientHeight}`);
      handleResize();
    }, 150); // Delay to allow layout to settle

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(currentMount);

    currentMount.addEventListener('click', handleClick);
    currentMount.addEventListener('mousemove', handleMouseMove);

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controlsRef.current?.update();
      if (composerRef.current) {
        composerRef.current.render();
      } else if (rendererRef.current && sceneRef.current && cameraRef.current) {
        // Fallback se o composer não estiver pronto, embora não deva acontecer
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      if (labelRendererRef.current && sceneRef.current && cameraRef.current) {
        labelRendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();
    // console.log('[ThreeScene] Animation loop started.');
    
    const handleControlsChangeEnd = () => {
      if (cameraRef.current && controlsRef.current && onCameraChangeRef.current) {
        // console.log('[ThreeScene] OrbitControls "end" event, calling onCameraChange.');
        const newCameraState = {
          position: cameraRef.current.position.clone(),
          lookAt: controlsRef.current.target.clone(),
        };
        onCameraChangeRef.current(newCameraState);
      }
    };
    controlsRef.current?.addEventListener('end', handleControlsChangeEnd);

    setIsSceneReady(true); 
    // console.log('[ThreeScene] Scene is now READY.');
    
    // console.log('[ThreeScene] Main setup useEffect FINISHED');
    return () => {
      // console.log('[ThreeScene] Cleanup: Main setup useEffect');
      setIsSceneReady(false); // Set to false on cleanup
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
          } else if (obj.material instanceof THREE.Material) {
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
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array: run only once on mount

  /**
   * Manipula o evento de movimento do mouse para detectar hover sobre equipamentos.
   * Delega o processamento para mouse-interaction-manager.
   * @param {MouseEvent} event - O evento do mouse.
   */
  const handleMouseMove = useCallback((event: MouseEvent) => {
    // console.log(`[ThreeScene] handleMouseMove triggered. isSceneReady: ${isSceneReady}`);
    if (!isSceneReady || !mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current ) {
        // console.log('[ThreeScene] handleMouseMove: SKIPPING - Scene not ready or core refs missing.');
        if (hoveredEquipmentTagRef.current !== null) {
          if (typeof setHoveredEquipmentTagCallbackRef.current === 'function') {
            setHoveredEquipmentTagCallbackRef.current(null);
          } else {
             // console.error('[ThreeScene] setHoveredEquipmentTagCallbackRef.current is not a function during mouse move (core refs missing).');
          }
        }
        return;
    }
     if (equipmentMeshesRef.current.length === 0 && hoveredEquipmentTagRef.current !== null) {
        // console.log('[ThreeScene] handleMouseMove: SKIPPING - No equipment meshes. Clearing hover.');
        if (typeof setHoveredEquipmentTagCallbackRef.current === 'function') {
            setHoveredEquipmentTagCallbackRef.current(null);
        } else {
            // console.error('[ThreeScene] setHoveredEquipmentTagCallbackRef.current is not a function during mouse move (no meshes).');
        }
        return;
    }

    // console.log(`[ThreeScene handleMouseMove] Calling processSceneMouseMove. hoveredEquipmentTagRef.current: ${hoveredEquipmentTagRef.current}, Callback is func: ${typeof setHoveredEquipmentTagCallbackRef.current === 'function'}`);
    processSceneMouseMove(
        event,
        mountRef.current,
        cameraRef.current,
        equipmentMeshesRef.current,
        (tag) => { // Adaptado para usar a ref do callback diretamente
            if (typeof setHoveredEquipmentTagCallbackRef.current === 'function') {
                setHoveredEquipmentTagCallbackRef.current(tag);
            } else {
                // console.error('[ThreeScene] setHoveredEquipmentTagCallbackRef.current is not a function in handleMouseMove wrapper.');
            }
        },
        hoveredEquipmentTagRef.current 
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSceneReady]); // Depend only on isSceneReady

  /**
   * Manipula o evento de clique do mouse para selecionar equipamentos.
   * Delega o processamento para mouse-interaction-manager.
   * @param {MouseEvent} event - O evento do mouse.
   */
  const handleClick = useCallback((event: MouseEvent) => {
    // console.log(`[ThreeScene] handleClick triggered, button: ${event.button}, isSceneReady: ${isSceneReady}`);
    if (event.button !== 0) { // Only process left clicks for selection
        // console.log('[ThreeScene] handleClick: Non-left button click, ignoring for selection.');
        return;
    }
    if (!isSceneReady || !mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current || equipmentMeshesRef.current.length === 0) {
      // console.log(`[ThreeScene] handleClick: SKIPPING due to unready refs, no meshes or scene not ready. isSceneReady: ${isSceneReady}, mount: ${!!mountRef.current}, camera: ${!!cameraRef.current}, scene: ${!!sceneRef.current}, meshes: ${!!equipmentMeshesRef.current}, meshCount: ${equipmentMeshesRef.current?.length}`);
      return;
    }
    if (typeof onSelectEquipmentRef.current !== 'function') {
      // console.error('[ThreeScene] handleClick: onSelectEquipmentRef.current is not a function.');
      return;
    }
    
    // console.log(`[ThreeScene handleClick] Calling processSceneClick.`);
    processSceneClick(
        event,
        mountRef.current,
        cameraRef.current,
        equipmentMeshesRef.current,
        onSelectEquipmentRef.current // Passando a ref do callback diretamente
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSceneReady]); // Depend only on isSceneReady

  /**
   * useEffect para atualizar os meshes dos equipamentos na cena.
   * Reage a mudanças nos dados de equipamento, camadas e modo de cor.
   */
  useEffect(() => {
    // console.log(`[ThreeScene] Updating equipment. Current mesh count: ${equipmentMeshesRef.current.length}, New data count: ${equipment?.length}, ColorMode: ${colorMode}, isSceneReady: ${isSceneReady}`);
    if (!sceneRef.current || !isSceneReady || !Array.isArray(equipment)) {
      // console.log('[ThreeScene] Updating equipment: SKIPPING - Scene not ready or equipment not an array.');
      return;
    }

    const newEquipmentPropTags = new Set(equipment.map(e => e.tag)); 

    // Remove old meshes not present in new equipment data or if their layer is hidden
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
    
    // Add new or update existing meshes
    const newMeshes: THREE.Object3D[] = [];
    equipment.forEach(item => { 
      const layer = layers.find(l => l.equipmentType === item.type);
      const isVisibleByLayer = layer?.isVisible ?? true;
      
      if (!isVisibleByLayer) return; // Skip if layer is not visible

      const existingMesh = equipmentMeshesRef.current.find(mesh => mesh.userData.tag === item.tag);

      if (existingMesh) {
        // Update existing mesh material if color or opacity changed
        if (existingMesh instanceof THREE.Mesh && existingMesh.material instanceof THREE.MeshStandardMaterial) {
            const newColor = getEquipmentColor(item, colorMode);
            const newOpacity = item.operationalState === 'Não aplicável' ? 0.5 : 1.0;
            const newTransparent = item.operationalState === 'Não aplicável';

            if (!existingMesh.material.color.equals(newColor) || 
                existingMesh.material.opacity !== newOpacity ||
                existingMesh.material.transparent !== newTransparent) {
                // console.log(`[ThreeScene] Updating material for ${item.tag}. Color: ${newColor.getHexString()}, Opacity: ${newOpacity}`);
                existingMesh.material.color.copy(newColor);
                existingMesh.material.opacity = newOpacity;
                existingMesh.material.transparent = newTransparent;
                existingMesh.material.needsUpdate = true;
            }
        }
         newMeshes.push(existingMesh);
      } else {
        // Create new mesh
        // console.log(`[ThreeScene] Creating new mesh for ${item.tag}`);
        const obj = createEquipmentMesh(item);
        sceneRef.current?.add(obj);
        newMeshes.push(obj);
      }
    });
    
    equipmentMeshesRef.current = newMeshes;
    // console.log(`[ThreeScene] Added/Updated equipment meshes. Total scene children: ${sceneRef.current?.children.length}, Equipment meshes: ${equipmentMeshesRef.current.length}`);
    
    // Handle terrain visibility based on its layer
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

  /**
   * useEffect para atualizar os pins de anotação na cena.
   * Reage a mudanças nas anotações, camadas e dados de equipamento.
   */
  useEffect(() => {
    // console.log(`[ThreeScene] Updating annotations. Count: ${annotations?.length}, isSceneReady: ${isSceneReady}`);
    if (!sceneRef.current || !labelRendererRef.current || !isSceneReady || !Array.isArray(annotations) || !Array.isArray(equipment)) {
      // console.log('[ThreeScene] Updating annotations: SKIPPING - Prerequisites not met.');
      return;
    }

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
        const equipmentForItem = equipment.find(e => e.tag === anno.equipmentTag);
        if (equipmentForItem) {
            const pinDiv = document.createElement('div');
            pinDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#FFD700" style="opacity: 0.9; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5));"><path d="M12 2C8.13 2 5 5.13 5 9c0 4.17 4.42 9.92 6.24 12.11.4.48 1.13.48 1.53 0C14.58 18.92 19 13.17 19 9c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>`;
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
  }, [annotations, layers, equipment, isSceneReady]);

  /**
   * useEffect para atualizar a câmera programaticamente.
   * Reage a mudanças no estado de câmera programático.
   */
  useEffect(() => {
    // console.log('[ThreeScene] Programmatic camera state changed:', programmaticCameraState);
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
        controls.enabled = false; // Disable controls during programmatic move
        if (positionChanged) camera.position.copy(targetPosition);
        if (lookAtChanged) controls.target.copy(targetLookAt);
        controls.update(); 
        controls.enabled = oldControlsEnabled; // Re-enable controls
      }
    }
  }, [programmaticCameraState, isSceneReady]);

  /**
   * useEffect para focar a câmera em um sistema específico.
   * Reage a mudanças na prop targetSystemToFrame.
   */
  useEffect(() => {
    // console.log('[ThreeScene] targetSystemToFrame changed:', targetSystemToFrame);
    if (!targetSystemToFrame || !sceneRef.current || !cameraRef.current || !controlsRef.current || !Array.isArray(equipment) || equipment.length === 0 || !isSceneReady) {
      if (targetSystemToFrame) {
        // console.log('[ThreeScene] targetSystemToFrame present, but prerequisites not met. Calling onSystemFramed.');
        onSystemFramed(); 
      }
      return;
    }

    // console.log(`[ThreeScene] Focusing on system: ${targetSystemToFrame}`);
    const systemMeshes = equipmentMeshesRef.current.filter(
      (mesh) => mesh.userData.sistema === targetSystemToFrame && mesh.visible
    );

    if (systemMeshes.length === 0) {
      // console.log(`[ThreeScene] No visible meshes found for system: ${targetSystemToFrame}. Calling onSystemFramed.`);
      onSystemFramed(); 
      return;
    }

    const totalBoundingBox = new THREE.Box3();
    systemMeshes.forEach(mesh => {
      if ((mesh as THREE.Mesh).geometry) { 
        mesh.updateMatrixWorld(true); // Ensure world matrix is up-to-date
        const meshBox = new THREE.Box3().setFromObject(mesh);
        totalBoundingBox.union(meshBox);
      }
    });

    if (totalBoundingBox.isEmpty()) {
      // console.log(`[ThreeScene] Bounding box for system ${targetSystemToFrame} is empty. Calling onSystemFramed.`);
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
    cameraDistance = cameraDistance * 1.5; // Add some padding
    cameraDistance = Math.max(cameraDistance, 5); // Ensure a minimum distance

    // Calculate a suitable camera position
    const newCamPos = new THREE.Vector3(
      center.x,
      center.y + Math.max(size.y * 0.5, maxDim * 0.3), // Elevate camera slightly above the center
      center.z + cameraDistance // Position camera away along Z-axis relative to center
    );
     // If the system is very flat, adjust Y to get a better viewing angle
     if (size.y < maxDim * 0.2) { 
       newCamPos.y = center.y + cameraDistance * 0.5; 
     }
     newCamPos.y = Math.max(newCamPos.y, center.y + 2); // Ensure camera is at least a bit above the center

    // console.log(`[ThreeScene] Calculated new camera for system ${targetSystemToFrame}: Pos=`, newCamPos, 'LookAt=', center);
    if (onCameraChangeRef.current) {
      // console.log('[ThreeScene] Calling onCameraChangeRef.current for system focus.');
      onCameraChangeRef.current({
        position: newCamPos,
        lookAt: center,
      });
    }
    onSystemFramed(); // Signal that framing is complete
  }, [targetSystemToFrame, onSystemFramed, equipment, layers, isSceneReady]); // Dependencies for system framing

  /**
   * useEffect para gerenciar o OutlinePass (efeito de aura).
   * Reage a mudanças nos equipamentos selecionados, em hover, e outros estados relevantes.
   */
 useEffect(() => {
    // console.log('[ThreeScene OutlinePass] Attempting update...');
    if (!isSceneReady || !outlinePassRef.current || !sceneRef.current || !equipmentMeshesRef.current) {
      // console.log('[ThreeScene OutlinePass] SKIPPING: Core refs not ready or scene not ready yet.');
      if (outlinePassRef.current) outlinePassRef.current.selectedObjects = [];
      return;
    }
    
    // console.log(`[ThreeScene OutlinePass] Received Props: selectedTags=${JSON.stringify(selectedEquipmentTags)}, hoveredTag=${hoveredEquipmentTag}`);
    const effectiveSelectedTags = selectedEquipmentTags ?? [];
    const effectiveHoveredTag = hoveredEquipmentTag === undefined ? null : hoveredEquipmentTag;
    // console.log(`[ThreeScene OutlinePass] Effective Values: selected=${JSON.stringify(effectiveSelectedTags)}, hovered=${effectiveHoveredTag}`);

    let objectsToOutline: THREE.Object3D[] = [];
    const meshesToConsider = equipmentMeshesRef.current.filter(mesh => mesh.visible);
    // console.log(`[ThreeScene OutlinePass] Meshes to consider for outline: ${meshesToConsider.map(m => m.userData.tag).join(', ')}`);
  
    if (Array.isArray(effectiveSelectedTags) && effectiveSelectedTags.length > 0) {
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
        outlinePassRef.current.visibleEdgeColor.set('#0000FF'); // Blue for selected
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
        outlinePassRef.current.visibleEdgeColor.set('#87CEFA'); // LightSkyBlue for hovered
        outlinePassRef.current.edgeStrength = 7;  
        outlinePassRef.current.edgeThickness = 1.5; 
        outlinePassRef.current.edgeGlow = 0.5;
        // console.log(`[ThreeScene OutlinePass] Style: HOVERED. Strength ${outlinePassRef.current.edgeStrength}. Outlining: ${hoveredMesh.userData.tag}`);
      } else { // Nothing hovered, and nothing selected from above
        outlinePassRef.current.edgeStrength = 0;
        outlinePassRef.current.edgeGlow = 0;
        outlinePassRef.current.edgeThickness = 0;
      }
    } else { // Nothing selected or hovered
      outlinePassRef.current.edgeStrength = 0;
      outlinePassRef.current.edgeGlow = 0;
      outlinePassRef.current.edgeThickness = 0;
      // console.log('[ThreeScene OutlinePass] Style: NONE. Strength 0.');
    }
  
    outlinePassRef.current.selectedObjects = objectsToOutline;
    outlinePassRef.current.pulsePeriod = 0; // Ensure no pulsing
    // console.log(`[ThreeScene OutlinePass] Final selectedObjects for outlinePass: ${objectsToOutline.length > 0 ? objectsToOutline.map(o => o.userData.tag).join(', ') : 'None'}`);
  
  }, [selectedEquipmentTags, hoveredEquipmentTag, equipment, layers, isSceneReady]);

  return <div ref={mountRef} className="w-full h-full" />;
};

export default ThreeScene;
