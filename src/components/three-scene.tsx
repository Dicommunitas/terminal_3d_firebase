
/**
 * @fileoverview Component React para renderizar e orquestrar a cena 3D usando Three.js.
 *
 * Responsabilidades Principais:
 * - Orquestrar a configuração inicial da cena 3D (câmera, luzes, renderizadores, controles, chão, pós-processamento)
 *   utilizando módulos utilitários de `src/core/three/`.
 * - Gerenciar a criação e atualização dos meshes de equipamentos na cena, delegando para `scene-elements-setup`.
 * - Gerenciar a exibição de indicadores visuais (pins) para anotações, delegando para `label-renderer-utils`.
 * - Delegar interações do mouse (clique, hover) para o `mouse-interaction-manager`.
 * - Aplicar efeitos visuais (aura do OutlinePass) para seleção e hover, utilizando o hook `useSceneOutline`.
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
import { updateAnnotationPins } from '@/core/three/label-renderer-utils';
import { calculateViewForMeshes } from '@/core/three/camera-utils';
import { useAnimationLoop } from '@/hooks/use-animation-loop';
import { useSceneOutline } from '@/hooks/use-scene-outline';

/**
 * Props para o componente ThreeScene.
 * @interface ThreeSceneProps
 * @property {Equipment[]} equipment - Lista de equipamentos a serem renderizados (já filtrados).
 * @property {Layer[]} layers - Lista de camadas para controlar a visibilidade.
 * @property {Annotation[]} annotations - Lista de anotações a serem exibidas.
 * @property {string[]} selectedEquipmentTags - Tags dos equipamentos selecionados. (Pode ser undefined inicialmente)
 * @property {(tag: string | null, isMultiSelect: boolean) => void} onSelectEquipment - Callback para seleção de equipamento.
 * @property {string | null} hoveredEquipmentTag - Tag do equipamento em hover. (Pode ser undefined inicialmente)
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
  selectedEquipmentTags: string[] | undefined; // Permitindo undefined como valor inicial de prop
  onSelectEquipment: (tag: string | null, isMultiSelectModifierPressed: boolean) => void;
  hoveredEquipmentTag: string | null | undefined; // Permitindo undefined
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
 *
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

  // console.log(`[ThreeScene RENDER] Props: selectedTags=${JSON.stringify(selectedEquipmentTags)}, hoveredTag=${hoveredEquipmentTag}, equipmentCount=${equipment.length}`);

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

  // Refs para callbacks para evitar problemas de staleness em useEffects/useCallback
  const onSelectEquipmentRef = useRef(onSelectEquipment);
  const setHoveredEquipmentTagCallbackRef = useRef(setHoveredEquipmentTag);
  const onCameraChangeRef = useRef(onCameraChange);

  useEffect(() => { onSelectEquipmentRef.current = onSelectEquipment; }, [onSelectEquipment]);
  useEffect(() => { setHoveredEquipmentTagCallbackRef.current = setHoveredEquipmentTag; }, [setHoveredEquipmentTag]);
  useEffect(() => { onCameraChangeRef.current = onCameraChange; }, [onCameraChange]);


  /**
   * Manipula o redimensionamento da janela/contêiner.
   * Atualiza as dimensões da câmera e dos renderizadores (principal, labels, composer).
   */
  const handleResize = useCallback(() => {
    if (mountRef.current && cameraRef.current && rendererRef.current) {
      const width = Math.max(1, mountRef.current.clientWidth);
      const height = Math.max(1, mountRef.current.clientHeight);
      // console.log(`[ThreeScene] handleResize CALLED. New dimensions: ${width}x${height}`);

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      
      rendererRef.current.setSize(width, height);
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
        // console.log('[ThreeScene] handleResize SKIPPED: Core refs not ready.');
    }
  }, []);


  /**
   * useEffect para configuração inicial da cena Three.js.
   * Este hook é executado apenas uma vez, quando o componente é montado.
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

    const pipeline = setupRenderPipeline(currentMount, sceneRef.current, cameraRef.current);
    if (!pipeline) {
      console.error("[ThreeScene Setup] Failed to setup render pipeline. Aborting setup.");
      return;
    }
    rendererRef.current = pipeline.renderer;
    labelRendererRef.current = pipeline.labelRenderer;
    composerRef.current = pipeline.composer;
    outlinePassRef.current = pipeline.outlinePass;

    if (sceneRef.current) {
      setupLighting(sceneRef.current);
      groundMeshRef.current = setupGroundPlane(sceneRef.current);
    }

    import('three/examples/jsm/controls/OrbitControls.js')
      .then(module => {
        const OrbitControls = module.OrbitControls;
        if (!cameraRef.current || !rendererRef.current?.domElement || !sceneRef.current) {
          console.error("[ThreeScene] Failed to initialize OrbitControls: Prerequisite refs not ready.");
          return;
        }

        controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
        controlsRef.current.enableDamping = true;

        if (initialCameraLookAt) {
          controlsRef.current.target.set(initialCameraLookAt.x, initialCameraLookAt.y, initialCameraLookAt.z);
        } else {
          console.error("[ThreeScene] initialLookAt is undefined during OrbitControls setup. Using default target (0,0,0).");
          controlsRef.current.target.set(0, 0, 0); // Fallback
        }
        
        controlsRef.current.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN
        };
        controlsRef.current.update();

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
        
        const currentControls = controlsRef.current; // Capture for cleanup
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
      handleResize();
      setIsSceneReady(true);
      console.log('[ThreeScene] Scene is now READY (after delay).');
    }, 150);


    return () => {
      console.log('[ThreeScene] Main setup useEffect CLEANUP running.');
      clearTimeout(initialSetupTimeoutId);
      if (currentMount) {
        resizeObserver.unobserve(currentMount);
        currentMount.removeEventListener('click', handleClick);
        currentMount.removeEventListener('mousemove', handleMouseMove);
      }

      if (controlsRef.current) {
        if (controlsRef.current.userData && typeof controlsRef.current.userData.cleanup === 'function') {
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
  }, []); // Array de dependências vazio para executar apenas na montagem/desmontagem


  /**
   * Cria um mesh 3D para um equipamento, usando utilitários para geometria e cor.
   * Define posição, rotação, userData e propriedades de sombra.
   * Memoizado com useCallback para otimizar performance, dependendo de `colorMode`.
   * @param {Equipment} item - O objeto de equipamento.
   * @returns {THREE.Object3D} O mesh 3D criado.
   */
  const createSingleEquipmentMesh = useCallback((item: Equipment): THREE.Object3D => {
    // console.log(`[ThreeScene createEquipmentMesh] Creating mesh for ${item.tag}, colorMode: ${colorMode}, state: ${item.operationalState}`);
    const finalColor = getEquipmentColor(item, colorMode);
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
  }, [colorMode]); // colorMode é a única dependência externa que afeta a criação do material aqui.


  /**
   * useEffect para atualizar os meshes dos equipamentos na cena.
   * Reage a mudanças nos dados de equipamento, camadas de visibilidade, modo de coloração ou prontidão da cena.
   * Delega a lógica de atualização para `updateEquipmentMeshesInScene`.
   */
  useEffect(() => {
    // console.log(`[ThreeScene] useEffect for equipment update. isSceneReady: ${isSceneReady}, equipment count: ${equipment.length}`);
    if (!isSceneReady || !sceneRef.current || !groundMeshRef) {
      // console.log('[ThreeScene EquipmentUpdate] SKIPPING: Scene not ready or core refs not available.');
      return;
    }
    // console.log(`[ThreeScene EquipmentUpdate] Updating equipment meshes. Equipment count: ${equipment.length}, ColorMode: ${colorMode}`);
    updateEquipmentMeshesInScene({
      scene: sceneRef.current,
      equipmentMeshesRef: equipmentMeshesRef,
      newEquipmentData: equipment,
      layers,
      colorMode,
      createSingleEquipmentMesh, // Passando a função memoizada
      groundMeshRef,
    });
    console.log(`[ThreeScene EquipmentUpdate] Done. Meshes in ref: ${equipmentMeshesRef.current.length}`);
  }, [equipment, layers, colorMode, isSceneReady, createSingleEquipmentMesh, groundMeshRef]);


  /**
   * Manipula eventos de movimento do mouse para hover, delegando para `mouse-interaction-manager`.
   */
  const handleMouseMove = useCallback((event: MouseEvent) => {
    console.log("[ThreeScene] handleMouseMove triggered");
    if (!isSceneReady) {
      console.log("[ThreeScene handleMouseMove] SKIPPING: Scene not ready.");
      if (typeof setHoveredEquipmentTagCallbackRef.current === 'function' && hoveredEquipmentTag !== null) {
        setHoveredEquipmentTagCallbackRef.current(null);
      }
      return;
    }
    if (!mountRef.current) {
      console.log("[ThreeScene handleMouseMove] SKIPPING: mountRef not ready.");
      return;
    }
    if (!cameraRef.current) {
      console.log("[ThreeScene handleMouseMove] SKIPPING: cameraRef not ready.");
      return;
    }
     if (!equipmentMeshesRef.current || equipmentMeshesRef.current.length === 0) {
      console.log("[ThreeScene handleMouseMove] SKIPPING: No meshes to interact with or equipmentMeshesRef not ready.");
      if (typeof setHoveredEquipmentTagCallbackRef.current === 'function' && hoveredEquipmentTag !== null) {
        setHoveredEquipmentTagCallbackRef.current(null);
      }
      return;
    }

    processSceneMouseMove(
        event,
        mountRef.current,
        cameraRef.current,
        equipmentMeshesRef.current, // Passando os meshes atuais
        (foundHoverTag) => {
          // console.log("[ThreeScene handleMouseMove] Raycaster found:", foundHoverTag, "Currently hovered:", hoveredEquipmentTag);
          if (hoveredEquipmentTag !== foundHoverTag) { // Compare com o valor da prop diretamente
            if (typeof setHoveredEquipmentTagCallbackRef.current === 'function') {
              // console.log("[ThreeScene handleMouseMove] Calling setHoveredEquipmentTagCallbackRef.current with:", foundHoverTag);
              setHoveredEquipmentTagCallbackRef.current(foundHoverTag);
            } else {
              console.error('[ThreeScene] setHoveredEquipmentTagCallbackRef.current is not a function.');
            }
          }
        }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSceneReady, hoveredEquipmentTag]); // Adicionado hoveredEquipmentTag para comparação direta


  /**
   * Manipula eventos de clique do mouse para seleção, delegando para `mouse-interaction-manager`.
   * Processa apenas cliques com o botão esquerdo do mouse.
   */
  const handleClick = useCallback((event: MouseEvent) => {
    console.log(`[ThreeScene] handleClick triggered, button: ${event.button}`);
    if (event.button !== 0) {
      console.log("[ThreeScene handleClick] Non-left click, ignoring for selection.");
      return;
    }
    if (!isSceneReady) {
      console.log("[ThreeScene handleClick] SKIPPING: Scene not ready.");
      return;
    }
     if (!mountRef.current) {
      console.log("[ThreeScene handleClick] SKIPPING: mountRef not ready.");
      return;
    }
    if (!cameraRef.current) {
      console.log("[ThreeScene handleClick] SKIPPING: cameraRef not ready.");
      return;
    }
    if (!sceneRef.current) { // Adicionado sceneRef.current check
        console.log("[ThreeScene handleClick] SKIPPING: sceneRef not ready.");
        return;
    }
    if (!equipmentMeshesRef.current || equipmentMeshesRef.current.length === 0) {
        console.log("[ThreeScene handleClick] SKIPPING: No meshes to interact with or equipmentMeshesRef not ready.");
        if (typeof onSelectEquipmentRef.current === 'function') {
            onSelectEquipmentRef.current(null, false); // Limpa seleção se não houver meshes
        }
        return;
    }
    
    if (typeof onSelectEquipmentRef.current !== 'function') {
      console.error("[ThreeScene handleClick] onSelectEquipmentRef.current is not a function.");
      return;
    }
    
    console.log("[ThreeScene handleClick] Processing click with processSceneClick...");
    processSceneClick(
        event,
        mountRef.current,
        cameraRef.current,
        equipmentMeshesRef.current, // Passando os meshes atuais
        onSelectEquipmentRef.current
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSceneReady]);


  /**
   * useEffect para gerenciar os pins de anotação, delegando para `label-renderer-utils`.
   */
  useEffect(() => {
    // console.log(`[ThreeScene Annotations] useEffect. isSceneReady: ${isSceneReady}, annotations: ${annotations?.length}`);
    if (!isSceneReady || !sceneRef.current || !labelRendererRef.current || !Array.isArray(annotations) || !Array.isArray(equipment)) {
      // console.log('[ThreeScene Annotations] SKIPPING: Core refs not ready, scene not ready, or data not valid.');
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


  /**
   * useEffect para aplicar o estado da câmera controlado programaticamente.
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
      ) : controls.target.clone();

      const positionChanged = !camera.position.equals(targetPosition);
      const lookAtChanged = !controls.target.equals(targetLookAt);

      if (positionChanged || lookAtChanged) {
        // console.log('[ThreeScene] Applying programmatic camera change.');
        controls.enabled = false;
        if (positionChanged) camera.position.copy(targetPosition);
        if (lookAtChanged) controls.target.copy(targetLookAt);
        controls.update();
        controls.enabled = true;
      }
    }
  }, [programmaticCameraState, isSceneReady]);


  /**
   * useEffect para focar a câmera em um sistema específico.
   */
  useEffect(() => {
    // console.log(`[ThreeScene FocusSystem] Target system: ${targetSystemToFrame}, isSceneReady: ${isSceneReady}`);
    if (!targetSystemToFrame || !sceneRef.current || !cameraRef.current || !controlsRef.current || !isSceneReady || equipmentMeshesRef.current.length === 0) {
      if (targetSystemToFrame && typeof props.onSystemFramed === 'function') {
        // console.log(`[ThreeScene FocusSystem] Conditions not met or no meshes for system ${targetSystemToFrame}, calling onSystemFramed.`);
        props.onSystemFramed();
      }
      return;
    }

    const systemMeshes = equipmentMeshesRef.current.filter(
      (mesh) => mesh.userData.sistema === targetSystemToFrame && mesh.visible
    );

    if (systemMeshes.length === 0) {
      // console.log(`[ThreeScene FocusSystem] No visible meshes found for system: ${targetSystemToFrame}`);
      if (typeof props.onSystemFramed === 'function') props.onSystemFramed();
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
    if (typeof props.onSystemFramed === 'function') props.onSystemFramed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSystemToFrame, isSceneReady, equipment, layers]);


  /** Hook para gerenciar o efeito de contorno (OutlinePass). */
  useSceneOutline({
    outlinePassRef,
    equipmentMeshesRef,
    selectedEquipmentTags,
    hoveredEquipmentTag,
    isSceneReady,
  });

  /** Hook que gerencia o loop de animação da cena. */
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
