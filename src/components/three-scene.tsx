
/**
 * @fileoverview Component React para renderizar e orquestrar a cena 3D usando Three.js.
 *
 * Responsabilidades Principais:
 * - Orquestrar a configuração inicial da cena 3D (câmera, luzes, renderizadores, controles, chão, pós-processamento)
 *   utilizando módulos utilitários de `src/core/three/`.
 * - Gerenciar a criação e atualização dos meshes de equipamentos na cena, delegando para `scene-elements-setup`.
 * - Gerenciar a exibição de indicadores visuais (pins) para anotações, delegando para `label-renderer-utils`.
 * - Delegar interações do mouse (clique, hover) para o `mouse-interaction-manager`.
 * - Aplicar efeitos visuais (aura do OutlinePass) para seleção e hover, utilizando `useSceneOutline`.
 * - Controlar a câmera programaticamente (aplicar estado externo, focar em sistemas), utilizando `camera-utils`.
 * - Gerenciar o loop de animação (usando `useAnimationLoop`) e o redimensionamento da cena.
 */
"use client";

import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
// OrbitControls é importado dinamicamente no useEffect
import type { OrbitControls as OrbitControlsType } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import type { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';

import type { Equipment, Layer, CameraState, Annotation, ColorMode } from '@/lib/types';
import { getEquipmentColor } from '@/core/graphics/color-utils';
import { processSceneClick, processSceneMouseMove } from '@/core/three/mouse-interaction-manager';
import { createGeometryForItem } from '@/core/three/equipment-geometry-factory';
import { setupLighting, setupGroundPlane, setupRenderPipeline, updateEquipmentMeshesInScene } from '@/core/three/scene-elements-setup';
import { updateLabelRendererSize, updateAnnotationPins } from '@/core/three/label-renderer-utils';
import { calculateViewForMeshes } from '@/core/three/camera-utils';
import { useAnimationLoop } from '@/hooks/use-animation-loop';
import { useSceneOutline } from '@/hooks/use-scene-outline';

/**
 * Props para o componente ThreeScene.
 * @interface ThreeSceneProps
 * @property {Equipment[]} equipment - Lista de equipamentos a serem renderizados (já filtrados).
 * @property {Layer[]} layers - Lista de camadas para controlar a visibilidade.
 * @property {Annotation[]} annotations - Lista de anotações a serem exibidas.
 * @property {string[] | undefined} selectedEquipmentTags - Tags dos equipamentos selecionados.
 * @property {(tag: string | null, isMultiSelect: boolean) => void} onSelectEquipment - Callback para seleção de equipamento.
 * @property {string | null | undefined} hoveredEquipmentTag - Tag do equipamento em hover.
 * @property {(tag: string | null) => void} setHoveredEquipmentTag - Callback para definir equipamento em hover.
 * @property {CameraState | undefined} cameraState - Estado atual da câmera controlado externamente.
 * @property {(cameraState: CameraState) => void} onCameraChange - Callback para mudança de câmera pelo usuário.
 * @property {{ x: number; y: number; z: number }} initialCameraPosition - Posição inicial da câmera.
 * @property {{ x: number; y: number; z: number }} initialCameraLookAt - Ponto de observação inicial da câmera.
 * @property {ColorMode} colorMode - Modo de colorização dos equipamentos.
 * @property {string | null} targetSystemToFrame - Sistema alvo para enquadramento pela câmera.
 * @property {() => void} onSystemFramed - Callback chamado após enquadramento de sistema.
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
 * Componente ThreeScene para renderização e interação 3D.
 * Orquestra a cena Three.js, equipamentos, interações e efeitos visuais,
 * delegando grande parte da lógica de setup e atualização para módulos utilitários e hooks.
 * @param {ThreeSceneProps} props As props do componente.
 * @returns {JSX.Element} O componente ThreeScene.
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

  // console.log('[ThreeScene RENDER] Props: ', { selectedEquipmentTags, hoveredEquipmentTag, colorMode, targetSystemToFrame, equipmentCount: equipment.length });

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

  const onSelectEquipmentRef = useRef(onSelectEquipment);
  const setHoveredEquipmentTagCallbackRef = useRef(setHoveredEquipmentTag); // Renamed for clarity
  const onCameraChangeRef = useRef(onCameraChange);

  const [isSceneReady, setIsSceneReady] = useState(false);

  useEffect(() => { onSelectEquipmentRef.current = onSelectEquipment; }, [onSelectEquipment]);
  useEffect(() => { setHoveredEquipmentTagCallbackRef.current = setHoveredEquipmentTag; }, [setHoveredEquipmentTag]);
  useEffect(() => { onCameraChangeRef.current = onCameraChange; }, [onCameraChange]);

  /**
   * Manipula o redimensionamento da janela/contêiner.
   * Atualiza as dimensões da câmera e dos renderizadores.
   */
  const handleResize = useCallback(() => {
    if (mountRef.current && cameraRef.current && rendererRef.current && labelRendererRef.current && composerRef.current && outlinePassRef.current) {
      const width = Math.max(1, mountRef.current.clientWidth);
      const height = Math.max(1, mountRef.current.clientHeight);
      // console.log(`[ThreeScene] handleResize CALLED. New dimensions: ${width}x${height}`);

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();

      if (labelRendererRef.current) updateLabelRendererSize(labelRendererRef.current, width, height);
      if (composerRef.current && outlinePassRef.current) {
        composerRef.current.setSize(width, height);
        // OutlinePass resolution is usually handled by composer's setSize or its own update based on renderer.
        // Explicitly setting might be needed if issues arise: outlinePassRef.current.resolution.set(width, height);
      }
      rendererRef.current.setSize(width, height);
    }
  }, []);


  /**
   * useEffect para configuração inicial da cena Three.js.
   * Este hook é executado apenas uma vez, quando o componente é montado.
   * Configura a cena, câmera, renderizador, luzes, controles, chão, pós-processamento e ouvintes de evento.
   */
  useEffect(() => {
    // console.log('[ThreeScene] Main setup useEffect RUNNING');
    if (!mountRef.current) {
      // console.warn('[ThreeScene Setup] mountRef.current is null. Aborting setup.');
      return;
    }

    const currentMount = mountRef.current;
    // console.log(`[ThreeScene] Mount dimensions AT START of useEffect: ${currentMount.clientWidth}x${currentMount.clientHeight}`);

    sceneRef.current = new THREE.Scene();
    cameraRef.current = new THREE.PerspectiveCamera(75, Math.max(1, currentMount.clientWidth) / Math.max(1, currentMount.clientHeight), 0.1, 2000);
    cameraRef.current.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);
    // console.log('[ThreeScene] Camera created at:', cameraRef.current.position);

    const pipeline = setupRenderPipeline(currentMount, sceneRef.current, cameraRef.current);
    if (!pipeline) {
      console.error("[ThreeScene Setup] Failed to setup render pipeline. Aborting setup.");
      return;
    }
    rendererRef.current = pipeline.renderer;
    labelRendererRef.current = pipeline.labelRenderer;
    composerRef.current = pipeline.composer;
    outlinePassRef.current = pipeline.outlinePass;
    // console.log('[ThreeScene] Render pipeline configured.');

    if (sceneRef.current) {
      setupLighting(sceneRef.current);
      groundMeshRef.current = setupGroundPlane(sceneRef.current);
      // console.log('[ThreeScene] Lights and ground plane added.');
    }

    // Importação dinâmica e configuração do OrbitControls
    import('three/examples/jsm/controls/OrbitControls.js')
      .then(module => {
        const OrbitControls = module.OrbitControls;
        if (!cameraRef.current || !rendererRef.current?.domElement || !sceneRef.current) {
          console.error("[ThreeScene] Failed to initialize OrbitControls: Prerequisite refs not ready for controls.");
          return;
        }

        controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
        controlsRef.current.enableDamping = true;

        if (initialCameraLookAt) {
          controlsRef.current.target.set(initialCameraLookAt.x, initialCameraLookAt.y, initialCameraLookAt.z);
        } else {
          console.error("[ThreeScene] initialCameraLookAt is undefined during OrbitControls setup. Using default target (0,0,0).");
          controlsRef.current.target.set(0, 0, 0);
        }
        
        controlsRef.current.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN
        };
        controlsRef.current.update();
        // console.log('[ThreeScene] OrbitControls created, target:', controlsRef.current.target);

        const handleControlsChangeEnd = () => {
          if (cameraRef.current && controlsRef.current && onCameraChangeRef.current) {
            const newCameraState: CameraState = {
              position: cameraRef.current.position.clone(),
              lookAt: controlsRef.current.target.clone(),
            };
            onCameraChangeRef.current(newCameraState);
          }
        };
        controlsRef.current.addEventListener('end', handleControlsChangeEnd);

        // Armazenar a função de cleanup no userData dos controles para remoção posterior
        const currentControls = controlsRef.current;
        if (!currentControls.userData) { 
            currentControls.userData = {};
        }
        currentControls.userData.cleanup = () => {
            currentControls.removeEventListener('end', handleControlsChangeEnd);
        };

      })
      .catch(err => console.error("[ThreeScene] Failed to load OrbitControls", err));

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(currentMount);

    currentMount.addEventListener('click', handleClick);
    currentMount.addEventListener('mousemove', handleMouseMove);

    // Adiciona um pequeno atraso antes do primeiro redimensionamento e de definir a cena como pronta
    const initialSetupTimeoutId = setTimeout(() => {
      // console.log(`[ThreeScene] Attempting DELAYED resize. Mount dimensions BEFORE delayed handleResize: ${currentMount.clientWidth}x${currentMount.clientHeight}`);
      handleResize(); // Call resize one more time after a short delay
      setIsSceneReady(true);
      // console.log('[ThreeScene] Scene is now READY (after delay).');
    }, 150); // 150ms delay

    return () => {
      // console.log('[ThreeScene] Main setup useEffect CLEANUP running.');
      clearTimeout(initialSetupTimeoutId);
      if (currentMount) {
        resizeObserver.unobserve(currentMount);
        currentMount.removeEventListener('click', handleClick);
        currentMount.removeEventListener('mousemove', handleMouseMove);
      }

      if (controlsRef.current) {
        if (controlsRef.current.userData && controlsRef.current.userData.cleanup) {
            controlsRef.current.userData.cleanup();
        }
        controlsRef.current.dispose();
        controlsRef.current = null;
      }
      
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
      
      composerRef.current?.passes.forEach(pass => { if ((pass as any).dispose) (pass as any).dispose(); });
      composerRef.current = null;
      outlinePassRef.current = null; 

      if (rendererRef.current?.domElement && rendererRef.current.domElement.parentNode === currentMount) {
        currentMount.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
      rendererRef.current = null;

      if (labelRendererRef.current?.domElement && labelRendererRef.current.domElement.parentNode === currentMount) {
        currentMount.removeChild(labelRendererRef.current.domElement);
      }
      labelRendererRef.current = null;

      sceneRef.current = null;
      cameraRef.current = null;
      setIsSceneReady(false);
      // console.log('[ThreeScene] Main setup CLEANED UP.');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Array de dependências vazio para rodar apenas na montagem e desmontagem.

  /**
   * Cria um mesh 3D para um equipamento, usando utilitários para geometria e cor.
   * Define posição, rotação, userData e propriedades de sombra.
   * @param {Equipment} item - O objeto de equipamento.
   * @returns {THREE.Object3D} O mesh 3D criado.
   */
  const createSingleEquipmentMesh = useCallback((item: Equipment): THREE.Object3D => {
    // console.log(`[ThreeScene createEquipmentMesh] Creating mesh for ${item.tag}, colorMode: ${colorMode}, state: ${item.operationalState}`);
    const finalColor = getEquipmentColor(item, colorMode); // colorMode from props
    // console.log(`[ThreeScene createEquipmentMesh] Final color for ${item.tag}:`, finalColor.getHexString());

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
  }, [colorMode]); // Depend on colorMode from props


  /**
   * useEffect para atualizar os meshes dos equipamentos na cena.
   * Reage a mudanças nos dados de equipamento, camadas de visibilidade ou modo de coloração.
   * Delega a lógica de atualização para `updateEquipmentMeshesInScene`.
   */
  useEffect(() => {
    // console.log(`[ThreeScene] useEffect for equipment update triggered. isSceneReady: ${isSceneReady}`);
    if (!isSceneReady || !sceneRef.current || !groundMeshRef.current) {
      // console.log('[ThreeScene EquipmentUpdate] Skipping: Scene not ready or core refs not available.');
      return;
    }
    // console.log(`[ThreeScene EquipmentUpdate] Updating equipment meshes. Equipment count: ${equipment.length}, ColorMode: ${colorMode}`);
    updateEquipmentMeshesInScene({
      scene: sceneRef.current,
      equipmentMeshesRef: equipmentMeshesRef,
      newEquipmentData: equipment,
      layers,
      colorMode,
      createSingleEquipmentMesh,
      groundMeshRef,
    });
  }, [equipment, layers, colorMode, isSceneReady, createSingleEquipmentMesh, groundMeshRef]);


  // Ref para o valor atual de hoveredEquipmentTag, usado em handleMouseMove para evitar staleness
  const hoveredEquipmentTagRef = useRef(hoveredEquipmentTag);
  useEffect(() => {
    hoveredEquipmentTagRef.current = hoveredEquipmentTag;
  }, [hoveredEquipmentTag]);

  /**
   * Manipula eventos de movimento do mouse para hover, delegando para `mouse-interaction-manager`.
   */
  const handleMouseMove = useCallback((event: MouseEvent) => {
    // console.log("[ThreeScene] handleMouseMove triggered");
    if (!isSceneReady || !mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current ) {
      // console.log("[ThreeScene handleMouseMove] SKIPPING: Scene not ready or core refs not available.");
      if (hoveredEquipmentTagRef.current !== null) {
        if (typeof setHoveredEquipmentTagCallbackRef.current === 'function') {
          setHoveredEquipmentTagCallbackRef.current(null);
        } else {
          // console.error('[ThreeScene] setHoveredEquipmentTagCallbackRef.current is not a function during mouse move (clearing hover).');
        }
      }
      return;
    }
    if (equipmentMeshesRef.current.length === 0) {
      // console.log("[ThreeScene handleMouseMove] No meshes, clearing hover.");
       if (hoveredEquipmentTagRef.current !== null && typeof setHoveredEquipmentTagCallbackRef.current === 'function') {
        setHoveredEquipmentTagCallbackRef.current(null);
      }
      return;
    }

    processSceneMouseMove(
        event,
        mountRef.current,
        cameraRef.current,
        equipmentMeshesRef.current,
        (foundHoverTag) => {
          if (hoveredEquipmentTagRef.current !== foundHoverTag) {
            if (typeof setHoveredEquipmentTagCallbackRef.current === 'function') {
              setHoveredEquipmentTagCallbackRef.current(foundHoverTag);
            } else {
              // console.error('[ThreeScene] setHoveredEquipmentTagCallbackRef.current is not a function during mouse move update.');
            }
          }
        }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSceneReady]); // Não adicione refs (.current) diretamente aqui


  /**
   * Manipula eventos de clique do mouse para seleção, delegando para `mouse-interaction-manager`.
   * Processa apenas cliques com o botão esquerdo do mouse.
   */
  const handleClick = useCallback((event: MouseEvent) => {
    // console.log(`[ThreeScene] handleClick triggered, button: ${event.button}`);
    if (event.button !== 0) { // Apenas processa cliques esquerdos para seleção
      // console.log("[ThreeScene handleClick] Non-left click, ignoring for selection.");
      return;
    }

    if (!isSceneReady || !mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current ) {
        // console.log("[ThreeScene] handleClick: SKIPPING due to unready refs or meshes.");
        if (typeof onSelectEquipmentRef.current === 'function' && (!equipmentMeshesRef.current || equipmentMeshesRef.current.length === 0)) {
            // console.log("[ThreeScene] handleClick: No meshes, clearing selection via callback.");
            onSelectEquipmentRef.current(null, false);
        }
        return;
    }
    if (equipmentMeshesRef.current.length === 0) {
        if (typeof onSelectEquipmentRef.current === 'function') {
            // console.log("[ThreeScene] handleClick: No meshes to select, clearing selection.");
            onSelectEquipmentRef.current(null, false);
        }
        return;
    }
    if (typeof onSelectEquipmentRef.current !== 'function') {
      // console.error("[ThreeScene] handleClick: onSelectEquipmentRef.current is not a function.");
      return;
    }

    processSceneClick(
        event,
        mountRef.current,
        cameraRef.current,
        equipmentMeshesRef.current,
        onSelectEquipmentRef.current
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSceneReady]);


  /**
   * useEffect para gerenciar os pins de anotação, delegando para `label-renderer-utils`.
   * Atualiza os pins quando as anotações, camadas, dados de equipamento ou o estado de prontidão da cena mudam.
   */
  useEffect(() => {
    // console.log(`[ThreeScene Annotations] useEffect triggered. Annotations count: ${annotations?.length}, isSceneReady: ${isSceneReady}`);
    if (!isSceneReady || !sceneRef.current || !labelRendererRef.current || !Array.isArray(annotations)) {
      // console.log('[ThreeScene Annotations] SKIPPING: Core refs not ready, scene not ready, or annotations not an array.');
      return;
    }
    // console.log('[ThreeScene] Attempting to update annotation pins.');
    updateAnnotationPins({
      scene: sceneRef.current,
      labelRenderer: labelRendererRef.current,
      annotations: annotations,
      equipmentData: equipment,
      layers: layers,
      existingPinsRef: annotationPinObjectsRef,
    });
  }, [annotations, layers, equipment, isSceneReady]); // labelRendererRef é estável após a montagem.


  /**
   * useEffect para aplicar o estado da câmera controlado programaticamente.
   * Reage a mudanças na prop `programmaticCameraState`.
   */
  useEffect(() => {
    // console.log('[ThreeScene] Programmatic camera state change detected:', programmaticCameraState);
    if (programmaticCameraState && cameraRef.current && controlsRef.current && isSceneReady) {
      const camera = cameraRef.current;
      const controls = controlsRef.current;

      const targetPosition = new THREE.Vector3(
        programmaticCameraState.position.x,
        programmaticCameraState.position.y,
        programmaticCameraState.position.z
      );
      const targetLookAt = programmaticCameraState.lookAt ? new THREE.Vector3(
        programmaticCameraState.lookAt.x,
        programmaticCameraState.lookAt.y,
        programmaticCameraState.lookAt.z
      ) : controls.target.clone(); // Fallback to current target if lookAt is not provided

      const positionChanged = !camera.position.equals(targetPosition);
      const lookAtChanged = !controls.target.equals(targetLookAt);

      if (positionChanged || lookAtChanged) {
        // console.log('[ThreeScene] Applying programmatic camera change.');
        if (positionChanged) camera.position.copy(targetPosition);
        if (lookAtChanged) controls.target.copy(targetLookAt);
        controls.update();
      }
    }
  }, [programmaticCameraState, isSceneReady]);


  /**
   * useEffect para focar a câmera em um sistema específico, utilizando `camera-utils`.
   * Reage a mudanças na prop `targetSystemToFrame`.
   */
  useEffect(() => {
    // console.log(`[ThreeScene FocusSystem] useEffect triggered. Target system: ${targetSystemToFrame}, isSceneReady: ${isSceneReady}`);
    if (!targetSystemToFrame || !sceneRef.current || !cameraRef.current || !controlsRef.current || !isSceneReady || equipmentMeshesRef.current.length === 0) {
      if (targetSystemToFrame && typeof onSystemFramed === 'function') {
        // console.log(`[ThreeScene FocusSystem] Conditions not met or no meshes for system ${targetSystemToFrame}, calling onSystemFramed.`);
        onSystemFramed();
      }
      return;
    }
    // console.log(`[ThreeScene FocusSystem] Attempting to frame system: ${targetSystemToFrame}`);

    const systemMeshes = equipmentMeshesRef.current.filter(
      (mesh) => mesh.userData.sistema === targetSystemToFrame && mesh.visible
    );

    if (systemMeshes.length === 0) {
      // console.log(`[ThreeScene FocusSystem] No visible meshes found for system: ${targetSystemToFrame}`);
      if (typeof onSystemFramed === 'function') onSystemFramed();
      return;
    }

    const newView = calculateViewForMeshes(systemMeshes, cameraRef.current);

    if (newView && typeof onCameraChangeRef.current === 'function') {
      // console.log(`[ThreeScene FocusSystem] New view calculated. Position:`, newView.position, `LookAt:`, newView.lookAt);
      onCameraChangeRef.current({
        position: newView.position,
        lookAt: newView.lookAt,
      });
    }
    if (typeof onSystemFramed === 'function') onSystemFramed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSystemToFrame, isSceneReady]); // equipment & layers affect equipmentMeshesRef implicitly

  /**
   * Hook que gerencia o efeito de contorno (OutlinePass) para seleção e hover.
   */
  useSceneOutline({
    outlinePassRef,
    equipmentMeshesRef,
    selectedEquipmentTags,
    hoveredEquipmentTag,
    isSceneReady,
  });

  /**
   * Hook que gerencia o loop de animação da cena.
   */
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
