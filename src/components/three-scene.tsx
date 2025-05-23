/**
 * @fileoverview Component React para renderizar e orquestrar a cena 3D usando Three.js.
 *
 * Responsabilidades Principais:
 * - Orquestrar o setup inicial da cena 3D (câmera, luzes, renderizadores, controles, chão, pós-processamento)
 *   utilizando módulos utilitários de `src/core/three/`.
 * - Gerenciar a criação e atualização dos meshes de equipamentos na cena, delegando para `scene-elements-setup`.
 * - Gerenciar a exibição de indicadores visuais (pins) para anotações, delegando para `label-renderer-utils`.
 * - Delegar interações do mouse (clique, hover) para o `mouse-interaction-manager`.
 * - Utilizar o hook `useSceneOutline` para aplicar efeitos visuais (aura do OutlinePass) para seleção e hover.
 * - Controlar a câmera programaticamente (aplicar estado externo, focar em sistemas), utilizando `camera-utils`.
 * - Gerenciar o loop de animação (usando `useAnimationLoop`) e o redimensionamento da cena.
 */
"use client";

import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsType } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import type { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';

import type { Equipment, Layer, CameraState, Annotation, ColorMode } from '@/lib/types';
import { getEquipmentColor } from '@/core/graphics/color-utils';
import { processSceneClick, processSceneMouseMove } from '@/core/three/mouse-interaction-manager';
import { createGeometryForItem } from '@/core/three/equipment-geometry-factory';
import { setupLighting, setupGroundPlane, updateEquipmentMeshesInScene, setupRenderPipeline } from '@/core/three/scene-elements-setup';
import { updateAnnotationPins } from '@/core/three/label-renderer-utils';
import { calculateViewForMeshes } from '@/core/three/camera-utils';
import { useAnimationLoop } from '@/hooks/use-animation-loop';
import { useSceneOutline } from '@/hooks/use-scene-outline';

/**
 * Props para o componente ThreeScene.
 */
export interface ThreeSceneProps {
  equipment: Equipment[];
  layers: Layer[];
  annotations: Annotation[];
  selectedEquipmentTags: string[] | undefined;
  onSelectEquipment: (tag: string | null, isMultiSelectModifierPressed: boolean) => void;
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

/**
 * Componente React para renderizar e interagir com uma cena 3D usando Three.js.
 * Orquestra a configuração da cena, renderização de equipamentos, anotações,
 * interações de mouse, efeitos visuais e controle de câmera.
 * Utiliza vários utilitários e hooks para modularizar suas responsabilidades.
 */
const ThreeScene: React.FC<ThreeSceneProps> = (props) => {
  const {
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
  } = props;

  // console.log('[ThreeScene RENDER] Props:', { selectedEquipmentTags, hoveredEquipmentTag, colorMode, targetSystemToFrame, equipmentCount: equipment?.length });

  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  const controlsRef = useRef<OrbitControlsType | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const outlinePassRef = useRef<OutlinePass | null>(null);
  
  const equipmentMeshesRef = useRef<THREE.Object3D[]>([]);
  const annotationPinObjectsRef = useRef<CSS2DObject[]>([]);
  const groundMeshRef = useRef<THREE.Mesh | null>(null);

  const [isSceneReady, setIsSceneReady] = useState(false);

  const onSelectEquipmentRef = useRef(onSelectEquipment);
  const setHoveredEquipmentTagCallbackRef = useRef(setHoveredEquipmentTag);
  const onCameraChangeRef = useRef(onCameraChange);
  const onSystemFramedRef = useRef(onSystemFramed);

  useEffect(() => { onSelectEquipmentRef.current = onSelectEquipment; }, [onSelectEquipment]);
  useEffect(() => { setHoveredEquipmentTagCallbackRef.current = setHoveredEquipmentTag; }, [setHoveredEquipmentTag]);
  useEffect(() => { onCameraChangeRef.current = onCameraChange; }, [onCameraChange]);
  useEffect(() => { onSystemFramedRef.current = onSystemFramed; }, [onSystemFramed]);
  
  const hoveredEquipmentTagRef = useRef(hoveredEquipmentTag);
  useEffect(() => { hoveredEquipmentTagRef.current = hoveredEquipmentTag; }, [hoveredEquipmentTag]);

  /**
   * Cria um mesh 3D para um equipamento.
   * @param {Equipment} item - O objeto de equipamento.
   * @returns {THREE.Object3D} O mesh 3D criado.
   */
  const createSingleEquipmentMesh = useCallback((item: Equipment): THREE.Object3D => {
    // console.log(`[ThreeScene createSingleEquipmentMesh] Creating mesh for ${item.tag} (Type: ${item.type}) with colorMode: ${colorMode}`);
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

    const geometry = createGeometryForItem(item);
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(item.position.x, item.position.y, item.position.z);
    if (item.rotation) {
      mesh.rotation.set(item.rotation.x, item.rotation.y, item.rotation.z);
    }
    mesh.userData = { tag: item.tag, type: item.type, sistema: item.sistema };
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return mesh;
  }, [colorMode]);

  /**
   * Manipula o redimensionamento do contêiner da cena.
   */
  const handleResize = useCallback(() => {
    // console.log('[ThreeScene handleResize] Triggered.');
    if (mountRef.current && cameraRef.current && rendererRef.current) {
      const width = Math.max(1, mountRef.current.clientWidth);
      const height = Math.max(1, mountRef.current.clientHeight);
      // console.log(`[ThreeScene handleResize] New dimensions: ${width}x${height}`);

      if (cameraRef.current) {
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
      }
      
      rendererRef.current?.setSize(width, height);
      labelRendererRef.current?.setSize(width, height);
      composerRef.current?.setSize(width, height);
      outlinePassRef.current?.resolution.set(width, height);
    }
  }, []); 

  /**
   * useEffect principal para configuração inicial da cena Three.js.
   * Executa apenas uma vez na montagem do componente.
   */
  useEffect(() => {
    // console.log('[ThreeScene Main Setup useEffect] RUNNING');
    const currentMount = mountRef.current;
    if (!currentMount) {
      // console.warn('[ThreeScene Setup] mountRef.current is null. Aborting setup.');
      return;
    }
    // console.log(`[ThreeScene Setup] Mount dimensions AT START of useEffect: ${currentMount.clientWidth}x${currentMount.clientHeight}`);

    sceneRef.current = new THREE.Scene();
    cameraRef.current = new THREE.PerspectiveCamera(75, Math.max(1, currentMount.clientWidth) / Math.max(1, currentMount.clientHeight), 0.1, 2000);
    if (initialCameraPosition) {
        cameraRef.current.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);
    } else {
        console.error("[ThreeScene Setup] initialCameraPosition is undefined. Using default (0,5,10).");
        cameraRef.current.position.set(0, 5, 10);
    }
    // console.log(`[ThreeScene Setup] Camera created at:`, cameraRef.current.position);

    const pipeline = setupRenderPipeline(currentMount, sceneRef.current, cameraRef.current);
    if (!pipeline) {
      console.error("[ThreeScene Setup] Failed to setup render pipeline. Aborting.");
      setIsSceneReady(false);
      return;
    }
    rendererRef.current = pipeline.renderer;
    labelRendererRef.current = pipeline.labelRenderer;
    composerRef.current = pipeline.composer;
    outlinePassRef.current = pipeline.outlinePass;
    // console.log('[ThreeScene Setup] Render pipeline created.');
    
    setupLighting(sceneRef.current);
    // console.log('[ThreeScene Setup] Lighting setup.');
    
    groundMeshRef.current = setupGroundPlane(sceneRef.current);
    // console.log('[ThreeScene Setup] Ground plane setup.');
    
    let OrbitControls: typeof OrbitControlsType | null = null;
    import('three/examples/jsm/controls/OrbitControls.js').then(module => {
        OrbitControls = module.OrbitControls;
        if (OrbitControls && cameraRef.current && rendererRef.current?.domElement) {
            const currentControls = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
            currentControls.enableDamping = true;
            currentControls.dampingFactor = 0.1;

            if (props.initialCameraLookAt) {
                currentControls.target.set(props.initialCameraLookAt.x, props.initialCameraLookAt.y, props.initialCameraLookAt.z);
            } else {
                console.error("[ThreeScene Setup] initialCameraLookAt is undefined. Using default target (0,0,0).");
                currentControls.target.set(0, 0, 0);
            }
            
            currentControls.mouseButtons = {
                LEFT: THREE.MOUSE.ROTATE,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.PAN
            };
            currentControls.update();
            controlsRef.current = currentControls; // Assign to ref
            // console.log(`[ThreeScene Setup] OrbitControls created. Target:`, currentControls.target);

            const handleControlsChangeEnd = () => {
                if (cameraRef.current && controlsRef.current && onCameraChangeRef.current) {
                    const newCameraState: CameraState = {
                        position: { x: cameraRef.current.position.x, y: cameraRef.current.position.y, z: cameraRef.current.position.z },
                        lookAt: { x: controlsRef.current.target.x, y: controlsRef.current.target.y, z: controlsRef.current.target.z },
                    };
                    onCameraChangeRef.current(newCameraState);
                }
            };
            controlsRef.current.addEventListener('end', handleControlsChangeEnd);
            
            // Store the listener for cleanup
            if (!controlsRef.current.userData) {
                controlsRef.current.userData = {};
            }
            controlsRef.current.userData.changeEndListener = handleControlsChangeEnd;

        } else {
            console.error("[ThreeScene Setup] Failed to initialize OrbitControls: Camera or Renderer domElement not ready, or OrbitControls module not loaded.");
        }
    }).catch(err => console.error("Error loading OrbitControls", err));

    handleResize(); 
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(currentMount);
    
    const initialSetupTimeoutId = setTimeout(() => {
      handleResize(); 
      setIsSceneReady(true);
      // console.log('[ThreeScene Setup] Scene is now READY (after delay).');
    }, 150);

    return () => {
      // console.log('[ThreeScene Main Setup useEffect] CLEANUP running.');
      clearTimeout(initialSetupTimeoutId);
      if (currentMount) {
        resizeObserver.unobserve(currentMount);
      }
      
      if (controlsRef.current) {
        if (controlsRef.current.userData && controlsRef.current.userData.changeEndListener) {
            controlsRef.current.removeEventListener('end', controlsRef.current.userData.changeEndListener);
        }
        controlsRef.current.dispose();
      }
      
      composerRef.current?.dispose();
      rendererRef.current?.dispose();

      if (rendererRef.current?.domElement?.parentNode === currentMount) {
        currentMount.removeChild(rendererRef.current.domElement);
      }
      if (labelRendererRef.current?.domElement?.parentNode === currentMount) {
        currentMount.removeChild(labelRendererRef.current.domElement);
      }
      
      sceneRef.current?.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.geometry?.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach(m => m.dispose());
          } else if (object.material) {
            (object.material as THREE.Material).dispose();
          }
        }
      });
      sceneRef.current?.clear();
      
      equipmentMeshesRef.current = [];
      annotationPinObjectsRef.current.forEach(pin => sceneRef.current?.remove(pin));
      annotationPinObjectsRef.current = [];

      groundMeshRef.current?.geometry?.dispose();
      if (groundMeshRef.current?.material instanceof THREE.Material) {
          (groundMeshRef.current.material as THREE.Material).dispose();
      }
      groundMeshRef.current = null;

      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      labelRendererRef.current = null;
      composerRef.current = null;
      outlinePassRef.current = null;
      setIsSceneReady(false);
      // console.log('[ThreeScene Main Setup useEffect] CLEANUP finished.');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  /**
   * Manipula movimentos do mouse na cena 3D para highlight de hover.
   */
  const handleMouseMove = useCallback((event: MouseEvent) => {
    // console.log("[ThreeScene] handleMouseMove triggered. isSceneReady:", isSceneReady);
    if (!isSceneReady || !mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current ) {
      // console.log('[ThreeScene handleMouseMove] SKIPPING:', {isSceneReady, mount:!!mountRef.current, cam:!!cameraRef.current, scene:!!sceneRef.current, meshes:!!equipmentMeshesRef.current});
      if (typeof setHoveredEquipmentTagCallbackRef.current === 'function' && hoveredEquipmentTagRef.current !== null) {
        setHoveredEquipmentTagCallbackRef.current(null);
      }
      return;
    }
    if (equipmentMeshesRef.current.length === 0 && hoveredEquipmentTagRef.current !== null) {
        if (typeof setHoveredEquipmentTagCallbackRef.current === 'function') {
            setHoveredEquipmentTagCallbackRef.current(null);
        }
        return;
    }

    processSceneMouseMove(
        event,
        mountRef.current,
        cameraRef.current,
        equipmentMeshesRef.current,
        (tag) => {
            if (typeof setHoveredEquipmentTagCallbackRef.current === 'function') {
                setHoveredEquipmentTagCallbackRef.current(tag);
            }
        }
    );
  }, [isSceneReady]); // Adicionado isSceneReady


  /**
   * Manipula cliques na cena 3D para seleção de equipamentos.
   */
  const handleClick = useCallback((event: MouseEvent) => {
    // console.log('[ThreeScene] handleClick triggered, button:', event.button, "isSceneReady:", isSceneReady);
    if (event.button !== 0) {
      return;
    }
    if (!isSceneReady || !mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current ) {
      // console.log('[ThreeScene handleClick] SKIPPING:', {isSceneReady, mount:!!mountRef.current, cam:!!cameraRef.current, scene:!!sceneRef.current, meshes:!!equipmentMeshesRef.current});
      return;
    }
    
    processSceneClick(
        event,
        mountRef.current,
        cameraRef.current,
        equipmentMeshesRef.current,
        (tag, isMultiSelect) => {
            if (typeof onSelectEquipmentRef.current === 'function') {
                onSelectEquipmentRef.current(tag, isMultiSelect);
            }
        }
    );
  }, [isSceneReady]); // Adicionado isSceneReady


  /**
   * useEffect para adicionar/remover ouvintes de eventos do mouse.
   * Depende de `handleClick`, `handleMouseMove` e `isSceneReady`.
   */
  useEffect(() => {
    const currentMount = mountRef.current;
    if (currentMount && isSceneReady) {
      // console.log('[ThreeScene] Adding mouse event listeners (isSceneReady: true).');
      currentMount.addEventListener('click', handleClick);
      currentMount.addEventListener('mousemove', handleMouseMove);

      return () => {
        // console.log('[ThreeScene] Removing mouse event listeners.');
        currentMount.removeEventListener('click', handleClick);
        currentMount.removeEventListener('mousemove', handleMouseMove);
      };
    }
  }, [handleClick, handleMouseMove, isSceneReady]);


  /**
   * useEffect para atualizar os meshes dos equipamentos na cena.
   */
  useEffect(() => {
    // console.log(`[ThreeScene EquipmentUpdate useEffect] Triggered. Equipment count: ${equipment?.length}, isSceneReady: ${isSceneReady}`);
    if (!isSceneReady || !sceneRef.current || !equipmentMeshesRef || !groundMeshRef ) {
      return;
    }
    if (!Array.isArray(equipment)) {
      return;
    }
    updateEquipmentMeshesInScene({
      scene: sceneRef.current,
      equipmentMeshesRef: equipmentMeshesRef,
      newEquipmentData: equipment,
      layers,
      colorMode,
      createSingleEquipmentMesh,
      groundMeshRef,
    });
    // console.log(`[ThreeScene EquipmentUpdate useEffect] Done. Meshes in ref: ${equipmentMeshesRef.current.length}`);
  }, [equipment, layers, colorMode, isSceneReady, createSingleEquipmentMesh]);

  /**
   * useEffect para gerenciar os pins de anotação.
   */
  useEffect(() => {
    // console.log(`[ThreeScene Annotations useEffect] Triggered. Annotations: ${annotations?.length}, isSceneReady: ${isSceneReady}`);
    if (!isSceneReady || !sceneRef.current || !labelRendererRef.current || !Array.isArray(annotations) || !Array.isArray(equipment)) {
      return;
    }
    updateAnnotationPins({
      scene: sceneRef.current,
      labelRenderer: labelRendererRef.current,
      annotations: annotations,
      equipmentData: equipment, 
      layers: layers,
      existingPinsRef: annotationPinObjectsRef,
    });
  }, [annotations, layers, equipment, isSceneReady]);

  // Hook para gerenciar o efeito de OutlinePass.
  useSceneOutline({
    outlinePassRef,
    equipmentMeshesRef,
    selectedEquipmentTags,
    hoveredEquipmentTag,
    isSceneReady,
  });

  // useEffect para aplicar o estado da câmera controlado programaticamente.
  useEffect(() => {
    // console.log('[ThreeScene Programmatic Camera useEffect] Target state:', programmaticCameraState, 'isSceneReady:', isSceneReady);
    if (programmaticCameraState && cameraRef.current && controlsRef.current && isSceneReady) {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      const targetPosition = programmaticCameraState.position ? new THREE.Vector3(programmaticCameraState.position.x, programmaticCameraState.position.y, programmaticCameraState.position.z) : camera.position.clone();
      const targetLookAt = programmaticCameraState.lookAt ? new THREE.Vector3(programmaticCameraState.lookAt.x, programmaticCameraState.lookAt.y, programmaticCameraState.lookAt.z) : controls.target.clone();
      const positionChanged = !camera.position.equals(targetPosition);
      const lookAtChanged = !controls.target.equals(targetLookAt);

      if (positionChanged || lookAtChanged) {
        const oldEnabled = controls.enabled;
        controls.enabled = false; 
        if (positionChanged) camera.position.copy(targetPosition);
        if (lookAtChanged) controls.target.copy(targetLookAt);
        controls.update();
        controls.enabled = oldEnabled; 
      }
    }
  }, [programmaticCameraState, isSceneReady]);

  // useEffect para focar a câmera em um sistema específico.
  useEffect(() => {
    // console.log(`[ThreeScene FocusSystem useEffect] Target system: ${targetSystemToFrame}, isSceneReady: ${isSceneReady}, Equipment count: ${equipment.length}`);
    if (!targetSystemToFrame || !sceneRef.current || !cameraRef.current || !controlsRef.current || !isSceneReady || !equipmentMeshesRef.current || equipmentMeshesRef.current.length === 0) {
      if (targetSystemToFrame && typeof onSystemFramedRef.current === 'function') {
        onSystemFramedRef.current(); 
      }
      return;
    }
    const systemMeshes = equipmentMeshesRef.current.filter(mesh => mesh.userData.sistema === targetSystemToFrame && mesh.visible);
    if (systemMeshes.length === 0) {
      if (typeof onSystemFramedRef.current === 'function') onSystemFramedRef.current();
      return;
    }
    const newView = calculateViewForMeshes(systemMeshes, cameraRef.current);
    if (newView && typeof onCameraChangeRef.current === 'function') {
      onCameraChangeRef.current({
        position: {x: newView.position.x, y: newView.position.y, z: newView.position.z },
        lookAt: {x: newView.lookAt.x, y: newView.lookAt.y, z: newView.lookAt.z },
      });
    }
    if (typeof onSystemFramedRef.current === 'function') {
      onSystemFramedRef.current();
    }
  }, [targetSystemToFrame, isSceneReady, equipment]);

  // Hook para gerenciar o loop de animação.
  useAnimationLoop({
    isSceneReady,
    sceneRef,
    cameraRef,
    controlsRef,
    composerRef,
    labelRendererRef,
  });

  return <div ref={mountRef} className="w-full h-full" />;
};

export default ThreeScene;
