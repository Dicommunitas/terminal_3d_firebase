
/**
 * @fileoverview Component React para renderizar e orquestrar a cena 3D usando Three.js.
 *
 * Responsabilidades Principais:
 * - Orquestrar a configuração inicial da cena 3D (câmera, luzes, renderizadores, controles, chão, pós-processamento)
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
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import type { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';

import type { Equipment, Layer, CameraState, Annotation, ColorMode } from '@/lib/types';
import { getEquipmentColor } from '@/core/graphics/color-utils';
import { processSceneClick, processSceneMouseMove } from '@/core/three/mouse-interaction-manager';
import { createGeometryForItem } from '@/core/three/equipment-geometry-factory';
import { setupLighting, setupGroundPlane, updateEquipmentMeshesInScene, setupRenderPipeline } from '@/core/three/scene-elements-setup';
import { updateAnnotationPins } from '@/core/three/label-renderer-utils'; // setupLabelRenderer is called by setupRenderPipeline
import { calculateViewForMeshes } from '@/core/three/camera-utils';
import { useAnimationLoop } from '@/hooks/use-animation-loop';
import { useSceneOutline } from '@/hooks/use-scene-outline';

/**
 * Props para o componente ThreeScene.
 * @interface ThreeSceneProps
 * @property {Equipment[]} equipment - Lista de equipamentos filtrados a serem renderizados.
 * @property {Layer[]} layers - Configuração das camadas de visibilidade.
 * @property {Annotation[]} annotations - Lista de anotações a serem exibidas.
 * @property {string[] | undefined} selectedEquipmentTags - Tags dos equipamentos selecionados.
 * @property {(tag: string | null, isMultiSelect: boolean) => void} onSelectEquipment - Callback para seleção de equipamento.
 * @property {string | null | undefined} hoveredEquipmentTag - Tag do equipamento em hover.
 * @property {(tag: string | null) => void} setHoveredEquipmentTag - Callback para definir equipamento em hover.
 * @property {CameraState | undefined} cameraState - Estado atual da câmera (posição, lookAt) vindo de `useCameraManager`.
 * @property {(cameraState: CameraState) => void} onCameraChange - Callback para quando a câmera muda na cena.
 * @property {{ x: number; y: number; z: number }} initialCameraPosition - Posição inicial da câmera.
 * @property {{ x: number; y: number; z: number }} initialCameraLookAt - Ponto de observação (lookAt) inicial da câmera.
 * @property {ColorMode} colorMode - Modo de colorização atual para os equipamentos.
 * @property {string | null} targetSystemToFrame - Sistema que deve ser enquadrado pela câmera.
 * @property {() => void} onSystemFramed - Callback chamado após o enquadramento de um sistema.
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
 * @param {ThreeSceneProps} props As propriedades do componente.
 * @returns {JSX.Element} Um elemento div que serve como contêiner para a cena 3D.
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

  // console.log('[ThreeScene] Component rendering. Props:', { selectedEquipmentTags, hoveredEquipmentTag, colorMode, targetSystemToFrame, equipmentCount: equipment.length });

  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const outlinePassRef = useRef<OutlinePass | null>(null);
  
  const equipmentMeshesRef = useRef<THREE.Object3D[]>([]);
  const annotationPinObjectsRef = useRef<CSS2DObject[]>([]);
  const groundMeshRef = useRef<THREE.Mesh | null>(null);

  const [isSceneReady, setIsSceneReady] = useState(false);

  // Refs para callbacks para evitar problemas de staleness em useEffects/useCallback
  const onSelectEquipmentRef = useRef(onSelectEquipment);
  const setHoveredEquipmentTagCallbackRef = useRef(setHoveredEquipmentTag);
  const onCameraChangeRef = useRef(onCameraChange);
  const onSystemFramedRef = useRef(onSystemFramed);

  useEffect(() => { onSelectEquipmentRef.current = onSelectEquipment; }, [onSelectEquipment]);
  useEffect(() => { setHoveredEquipmentTagCallbackRef.current = setHoveredEquipmentTag; }, [setHoveredEquipmentTag]);
  useEffect(() => { onCameraChangeRef.current = onCameraChange; }, [onCameraChange]);
  useEffect(() => { onSystemFramedRef.current = onSystemFramed; }, [onSystemFramed]);

  /**
   * Função de callback memoizada para criar um mesh 3D para um equipamento.
   * Utiliza `getEquipmentColor` e `createGeometryForItem` para cor e geometria.
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
      material.opacity = 0.5; // Valor ajustado
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
  }, [colorMode]); // Depende de colorMode para recriar meshes quando o modo de cor mudar

  /**
   * Manipula o redimensionamento do contêiner da cena.
   * Atualiza o aspect ratio da câmera e os tamanhos dos renderizadores/composer.
   */
  const handleResize = useCallback(() => {
    // console.log('[ThreeScene handleResize] Triggered.');
    if (mountRef.current && cameraRef.current && rendererRef.current) {
      const width = Math.max(1, mountRef.current.clientWidth);
      const height = Math.max(1, mountRef.current.clientHeight);
      // console.log(`[ThreeScene handleResize] New dimensions: ${width}x${height}`);

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      
      rendererRef.current.setSize(width, height);
      labelRendererRef.current?.setSize(width, height);
      composerRef.current?.setSize(width, height);
      outlinePassRef.current?.resolution.set(width, height);
    } else {
        // console.log('[ThreeScene handleResize] SKIPPED: Core refs not ready for resize.');
    }
  }, []); 

  /**
   * useEffect para configuração inicial da cena Three.js.
   * Configura a cena, câmera, renderizadores, controles, luzes, chão e ouvintes de evento.
   * Executa apenas uma vez na montagem do componente.
   */
  useEffect(() => {
    // console.log('[ThreeScene Main Setup useEffect] RUNNING');
    const currentMount = mountRef.current;
    if (!currentMount) {
      console.warn('[ThreeScene Setup] mountRef.current is null. Aborting setup.');
      return;
    }
    // console.log(`[ThreeScene Setup] Mount dimensions AT START of useEffect: ${currentMount.clientWidth}x${currentMount.clientHeight}`);

    sceneRef.current = new THREE.Scene();
    cameraRef.current = new THREE.PerspectiveCamera(75, Math.max(1, currentMount.clientWidth) / Math.max(1, currentMount.clientHeight), 0.1, 2000);
    cameraRef.current.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);
    // console.log(`[ThreeScene Setup] Camera created at:`, cameraRef.current.position);

    // Setup render pipeline (WebGL, CSS2D, Composer, OutlinePass)
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

    // Setup lighting
    setupLighting(sceneRef.current);
    // console.log('[ThreeScene Setup] Lighting setup.');

    // Setup ground plane
    groundMeshRef.current = setupGroundPlane(sceneRef.current);
    // console.log('[ThreeScene Setup] Ground plane setup.');
    
    // Setup OrbitControls
    if (cameraRef.current && rendererRef.current) {
      controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
      controlsRef.current.enableDamping = true;
      controlsRef.current.dampingFactor = 0.1; // Suaviza o movimento
      if (initialCameraLookAt) {
        controlsRef.current.target.set(initialCameraLookAt.x, initialCameraLookAt.y, initialCameraLookAt.z);
      } else {
        console.error("[ThreeScene Setup] initialCameraLookAt is undefined. Using default target (0,0,0).");
        controlsRef.current.target.set(0, 0, 0);
      }
      controlsRef.current.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      };
      controlsRef.current.update();
      // console.log(`[ThreeScene Setup] OrbitControls created. Target:`, controlsRef.current.target);

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
    } else {
      console.error("[ThreeScene Setup] Failed to initialize OrbitControls: Camera or Renderer not ready.");
    }

    // Initial resize and observer
    handleResize(); 
    const resizeObserver = new ResizeObserver(() => {
        // console.log('[ThreeScene ResizeObserver] Triggered.');
        handleResize();
    });
    resizeObserver.observe(currentMount);
    
    // Event listeners for mouse interactions are added in a separate useEffect that depends on handleClick and handleMouseMove

    const initialSetupTimeoutId = setTimeout(() => {
      // console.log(`[ThreeScene Setup] Attempting DELAYED resize. Mount dimensions BEFORE delayed handleResize: ${currentMount.clientWidth}x${currentMount.clientHeight}`);
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
      
      controlsRef.current?.removeEventListener('end', (controlsRef.current as any)._onEnd); // (controlsRef.current as any)._onEnd is a common way to store the bound listener
      controlsRef.current?.dispose();
      
      composerRef.current?.dispose();
      // labelRendererRef.current does not have a dispose method. Its DOM element is removed.
      rendererRef.current?.dispose();

      if (rendererRef.current?.domElement && rendererRef.current.domElement.parentNode === currentMount) {
        currentMount.removeChild(rendererRef.current.domElement);
      }
      if (labelRendererRef.current?.domElement && labelRendererRef.current.domElement.parentNode === currentMount) {
        currentMount.removeChild(labelRendererRef.current.domElement);
      }
      
      sceneRef.current?.clear();
      // Dispose geometries and materials of equipmentMeshesRef.current
      equipmentMeshesRef.current.forEach(mesh => {
        if (mesh instanceof THREE.Mesh) {
            mesh.geometry?.dispose();
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(m => m.dispose());
            } else if (mesh.material) {
                (mesh.material as THREE.Material).dispose();
            }
        }
      });
      equipmentMeshesRef.current = [];
      annotationPinObjectsRef.current.forEach(pin => sceneRef.current?.remove(pin)); // Pins are CSS2DObjects, their DOM elements are handled by CSS2DRenderer
      annotationPinObjectsRef.current = [];

      if (groundMeshRef.current) {
        groundMeshRef.current.geometry?.dispose();
        if (groundMeshRef.current.material instanceof THREE.Material) {
            (groundMeshRef.current.material as THREE.Material).dispose();
        }
      }

      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      labelRendererRef.current = null;
      composerRef.current = null;
      outlinePassRef.current = null;
      groundMeshRef.current = null;
      setIsSceneReady(false);
      // console.log('[ThreeScene Main Setup useEffect] CLEANUP finished.');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Runs once on mount


  /**
   * Manipula cliques na cena 3D para seleção de equipamentos.
   * Utiliza `mouse-interaction-manager.ts`.
   */
  const handleClick = useCallback((event: MouseEvent) => {
    // console.log('[ThreeScene] handleClick triggered, button:', event.button);
    if (event.button !== 0) return; // Process only left clicks for selection

    if (!isSceneReady || !mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current) {
      // console.log('[ThreeScene handleClick] SKIPPING:', { isSceneReady, mount: !!mountRef.current, cam: !!cameraRef.current, scene: !!sceneRef.current, meshes: !!equipmentMeshesRef.current });
      return;
    }
    if (typeof onSelectEquipmentRef.current !== 'function') {
      console.error("[ThreeScene handleClick] onSelectEquipmentRef.current is not a function.");
      return;
    }
    processSceneClick(
        event,
        mountRef.current,
        cameraRef.current,
        equipmentMeshesRef.current, // Pass the actual meshes
        onSelectEquipmentRef.current
    );
  }, [isSceneReady]); // Depends on isSceneReady to get the correct closure

  /**
   * Manipula movimentos do mouse na cena 3D para highlight de hover.
   * Utiliza `mouse-interaction-manager.ts`.
   */
  const handleMouseMove = useCallback((event: MouseEvent) => {
    // console.log("[ThreeScene] handleMouseMove triggered");
    if (!isSceneReady || !mountRef.current || !cameraRef.current || !equipmentMeshesRef.current) {
        // console.log('[ThreeScene handleMouseMove] SKIPPING: Scene not ready or core refs missing.');
      if (typeof setHoveredEquipmentTagCallbackRef.current === 'function' && hoveredEquipmentTagRef.current !== null) {
        setHoveredEquipmentTagCallbackRef.current(null); // Clear hover if scene becomes unready
      }
      return;
    }
    if (!equipmentMeshesRef.current || equipmentMeshesRef.current.length === 0) {
        // console.log("[ThreeScene handleMouseMove] SKIPPING: No meshes to interact with.");
        if (typeof setHoveredEquipmentTagCallbackRef.current === 'function' && hoveredEquipmentTagRef.current !== null) {
            setHoveredEquipmentTagCallbackRef.current(null);
        }
        return;
    }
    if (typeof setHoveredEquipmentTagCallbackRef.current !== 'function') {
      console.error('[ThreeScene handleMouseMove] setHoveredEquipmentTagCallbackRef.current is not a function.');
      return;
    }
    processSceneMouseMove(
        event,
        mountRef.current,
        cameraRef.current,
        equipmentMeshesRef.current, // Pass the actual meshes
        setHoveredEquipmentTagCallbackRef.current
    );
  }, [isSceneReady]); // Depends on isSceneReady

  const hoveredEquipmentTagRef = useRef(hoveredEquipmentTag);
  useEffect(() => {
    hoveredEquipmentTagRef.current = hoveredEquipmentTag;
  }, [hoveredEquipmentTag]);

  // Effect to add/remove mouse event listeners
  useEffect(() => {
    const currentMount = mountRef.current;
    if (currentMount) {
      // console.log('[ThreeScene] Adding mouse event listeners.');
      currentMount.addEventListener('click', handleClick);
      currentMount.addEventListener('mousemove', handleMouseMove);

      return () => {
        // console.log('[ThreeScene] Removing mouse event listeners.');
        currentMount.removeEventListener('click', handleClick);
        currentMount.removeEventListener('mousemove', handleMouseMove);
      };
    }
  }, [handleClick, handleMouseMove]); // Re-attach if callbacks change (due to isSceneReady change)

  // useEffect para atualizar os meshes dos equipamentos na cena.
  // Depende de equipment, layers, colorMode e isSceneReady.
  useEffect(() => {
    // console.log(`[ThreeScene EquipmentUpdate useEffect] Triggered. Equipment count: ${equipment?.length}, isSceneReady: ${isSceneReady}`);
    if (!isSceneReady || !sceneRef.current || !equipmentMeshesRef || !groundMeshRef.current || !layers ) {
      // console.log('[ThreeScene EquipmentUpdate useEffect] SKIPPING: Scene not ready or core refs/props not available.');
      return;
    }
    if (!Array.isArray(equipment)) {
      // console.log('[ThreeScene EquipmentUpdate useEffect] SKIPPING: props.equipment is not an array.');
      return;
    }
    updateEquipmentMeshesInScene({
      scene: sceneRef.current,
      equipmentMeshesRef: equipmentMeshesRef,
      newEquipmentData: equipment,
      layers,
      colorMode,
      createSingleEquipmentMesh,
      groundMeshRef, // Pass the ref itself
    });
    // console.log(`[ThreeScene EquipmentUpdate useEffect] Done. Meshes in ref: ${equipmentMeshesRef.current.length}`);
  }, [equipment, layers, colorMode, isSceneReady, createSingleEquipmentMesh]);

  // useEffect para gerenciar os pins de anotação.
  // Depende de annotations, layers, equipment e isSceneReady.
  useEffect(() => {
    // console.log(`[ThreeScene Annotations useEffect] Triggered. Annotations: ${annotations?.length}, isSceneReady: ${isSceneReady}`);
    if (!isSceneReady || !sceneRef.current || !labelRendererRef.current || !Array.isArray(annotations) || !Array.isArray(equipment)) {
      // console.log('[ThreeScene Annotations useEffect] SKIPPING: Core refs not ready, scene not ready, or data not valid.');
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
    // console.log('[ThreeScene Programmatic Camera useEffect] Target state:', programmaticCameraState);
    if (programmaticCameraState && cameraRef.current && controlsRef.current && isSceneReady) {
      const camera = cameraRef.current;
      const controls = controlsRef.current;

      const targetPosition = programmaticCameraState.position ? new THREE.Vector3(
        programmaticCameraState.position.x,
        programmaticCameraState.position.y,
        programmaticCameraState.position.z
      ) : camera.position.clone();

      const targetLookAt = programmaticCameraState.lookAt ? new THREE.Vector3(
        programmaticCameraState.lookAt.x,
        programmaticCameraState.lookAt.y,
        programmaticCameraState.lookAt.z
      ) : controls.target.clone();

      const positionChanged = !camera.position.equals(targetPosition);
      const lookAtChanged = !controls.target.equals(targetLookAt);

      if (positionChanged || lookAtChanged) {
        // console.log('[ThreeScene Programmatic Camera useEffect] Applying new camera state.');
        controls.enabled = false; 
        if (positionChanged) camera.position.copy(targetPosition);
        if (lookAtChanged) controls.target.copy(targetLookAt);
        controls.update();
        controls.enabled = true; 
      }
    }
  }, [programmaticCameraState, isSceneReady]);

  // useEffect para focar a câmera em um sistema específico.
  useEffect(() => {
    // console.log(`[ThreeScene FocusSystem useEffect] Target system: ${targetSystemToFrame}, isSceneReady: ${isSceneReady}`);
    if (!targetSystemToFrame || !sceneRef.current || !cameraRef.current || !controlsRef.current || !isSceneReady || !equipmentMeshesRef.current || equipmentMeshesRef.current.length === 0) {
      if (targetSystemToFrame && typeof onSystemFramedRef.current === 'function') {
        // console.log(`[ThreeScene FocusSystem useEffect] Conditions not met for system ${targetSystemToFrame}, calling onSystemFramed.`);
        onSystemFramedRef.current(); 
      }
      return;
    }

    const systemMeshes = equipmentMeshesRef.current.filter(
      (mesh) => mesh.userData.sistema === targetSystemToFrame && mesh.visible
    );

    if (systemMeshes.length === 0) {
      // console.log(`[ThreeScene FocusSystem useEffect] No visible meshes found for system: ${targetSystemToFrame}`);
      if (typeof onSystemFramedRef.current === 'function') onSystemFramedRef.current();
      return;
    }

    const newView = calculateViewForMeshes(systemMeshes, cameraRef.current);

    if (newView && typeof onCameraChangeRef.current === 'function') {
      // console.log(`[ThreeScene FocusSystem useEffect] New view calculated. Position:`, newView.position, `LookAt:`, newView.lookAt);
      onCameraChangeRef.current({
        position: {x: newView.position.x, y: newView.position.y, z: newView.position.z },
        lookAt: {x: newView.lookAt.x, y: newView.lookAt.y, z: newView.lookAt.z },
      });
    }
    if (typeof onSystemFramedRef.current === 'function') onSystemFramedRef.current();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSystemToFrame, isSceneReady, equipment]); // equipment, layers afetam equipmentMeshesRef (via updateEquipmentMeshesInScene)

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
