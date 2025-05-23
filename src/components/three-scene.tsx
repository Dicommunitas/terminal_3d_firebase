
/**
 * @fileoverview Componente React para renderizar a cena 3D usando Three.js.
 *
 * Responsabilidades Principais:
 * - Orquestrar a configuração inicial da cena 3D (câmera, luzes, renderizadores, controles),
 *   delegando partes do setup para módulos utilitários.
 * - Gerenciar a criação, atualização e remoção dos meshes dos equipamentos e pins de anotação
 *   com base nas props recebidas, utilizando os respectivos utilitários.
 * - Delegar o processamento de interações do mouse (clique para seleção, hover) para o mouse-interaction-manager.
 * - Aplicar atualizações de câmera programáticas (e.g., foco em sistema) e responder a mudanças de câmera do usuário.
 * - Gerenciar o redimensionamento da cena e o loop de animação (delegado para o hook useAnimationLoop).
 * - Coordenar a aplicação do efeito de contorno (aura) para seleção/hover, usando postprocessing-utils.
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
import { setupPostProcessing, updatePostProcessingSize, updateOutlineEffect } from '@/core/three/postprocessing-utils';
import { updateAnnotationPins } from '@/core/three/label-renderer-utils';
import { setupLighting, setupGroundPlane, updateEquipmentMeshesInScene, setupRenderPipeline } from '@/core/three/scene-elements-setup';
import { calculateViewForMeshes } from '@/core/three/camera-utils';
import { useAnimationLoop } from '@/hooks/use-animation-loop';

/**
 * Props para o componente ThreeScene.
 * @interface ThreeSceneProps
 * @property {Equipment[]} equipment - Lista de equipamentos a serem renderizados (já filtrados).
 * @property {Layer[]} layers - Lista de camadas para controlar a visibilidade por tipo.
 * @property {Annotation[]} annotations - Lista de anotações a serem exibidas.
 * @property {string[]} selectedEquipmentTags - Tags dos equipamentos selecionados.
 * @property {(tag: string | null, isMultiSelect: boolean) => void} onSelectEquipment - Callback para seleção de equipamento.
 * @property {string | null} hoveredEquipmentTag - Tag do equipamento em hover.
 * @property {(tag: string | null) => void} setHoveredEquipmentTag - Callback para definir o equipamento em hover.
 * @property {CameraState | undefined} cameraState - Estado da câmera controlado externamente.
 * @property {(cameraState: CameraState) => void} onCameraChange - Callback para notificar mudança de câmera pelo usuário.
 * @property {{ x: number; y: number; z: number }} initialCameraPosition - Posição inicial da câmera.
 * @property {{ x: number; y: number; z: number }} initialCameraLookAt - Alvo inicial da câmera.
 * @property {ColorMode} colorMode - Modo de colorização dos equipamentos.
 * @property {string | null} targetSystemToFrame - Sistema para focar a câmera. Null se nenhum.
 * @property {() => void} onSystemFramed - Callback chamado após o enquadramento do sistema ser concluído.
 */
interface ThreeSceneProps {
  equipment: Equipment[];
  layers: Layer[];
  annotations: Annotation[];
  selectedEquipmentTags: string[];
  onSelectEquipment: (tag: string | null, isMultiSelectModifierPressed: boolean) => void;
  hoveredEquipmentTag: string | null;
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
 * Orquestra a cena Three.js, equipamentos, interações e efeitos visuais.
 * Este componente é o coração da visualização 3D, lidando com:
 * - Configuração inicial de todos os elementos Three.js (cena, câmera, renderizadores, luzes, controles).
 * - Gerenciamento do ciclo de vida dos objetos 3D (meshes de equipamentos, pins de anotação) em resposta a mudanças nas props.
 * - Captura e delegação de interações do mouse para seleção e hover.
 * - Aplicação de efeitos visuais como auras de contorno.
 * - Controle programático da câmera para funcionalidades como "focar em sistema".
 * - Manutenção do loop de animação e responsividade ao redimensionamento.
 *
 * @param {ThreeSceneProps} props As props do componente.
 * @returns {JSX.Element} O componente ThreeScene.
 */
const ThreeScene: React.FC<ThreeSceneProps> = ({
  equipment,
  layers,
  annotations,
  selectedEquipmentTags,
  onSelectEquipment,
  hoveredEquipmentTag,
  setHoveredEquipmentTag,
  cameraState: programmaticCameraState, // Renomeado para clareza interna
  onCameraChange,
  initialCameraPosition,
  initialCameraLookAt,
  colorMode,
  targetSystemToFrame,
  onSystemFramed,
}) => {
  // console.log(`[ThreeScene RENDER] Props: `, {
  //   selectedEquipmentTags,
  //   hoveredEquipmentTag,
  //   colorMode,
  //   targetSystemToFrame,
  //   equipmentCount: equipment.length
  // });

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

  // Refs para callbacks para evitar problemas de closure em manipuladores de eventos
  const onSelectEquipmentRef = useRef(onSelectEquipment);
  const onCameraChangeRef = useRef(onCameraChange);
  const setHoveredEquipmentTagCallbackRef = useRef(setHoveredEquipmentTag);
  // Ref para o estado de hover, usado para comparação dentro de handleMouseMove
  const hoveredEquipmentTagRef = useRef(hoveredEquipmentTag); 
  
  const [isSceneReady, setIsSceneReady] = useState(false);

  // Atualiza os refs dos callbacks quando as props mudam
  useEffect(() => { onSelectEquipmentRef.current = onSelectEquipment; }, [onSelectEquipment]);
  useEffect(() => { onCameraChangeRef.current = onCameraChange; }, [onCameraChange]);
  useEffect(() => { setHoveredEquipmentTagCallbackRef.current = setHoveredEquipmentTag; }, [setHoveredEquipmentTag]);
  useEffect(() => { hoveredEquipmentTagRef.current = hoveredEquipmentTag; }, [hoveredEquipmentTag]);


  /**
   * Manipula o redimensionamento da janela/contêiner.
   * Atualiza as dimensões da câmera e dos renderizadores.
   * @callback
   */
  const handleResize = useCallback(() => {
    if (mountRef.current && cameraRef.current && rendererRef.current && labelRendererRef.current && composerRef.current && outlinePassRef.current) {
      const width = Math.max(1, mountRef.current.clientWidth);
      const height = Math.max(1, mountRef.current.clientHeight);
      // console.log(`[ThreeScene] handleResize CALLED. New dimensions: ${width}x${height}`);

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      
      if (rendererRef.current) {
        rendererRef.current.setSize(width, height);
      }
      if (labelRendererRef.current) { // labelRenderer é configurado por setupRenderPipeline
        labelRendererRef.current.setSize(width, height);
      }
      if (composerRef.current && outlinePassRef.current) {
        updatePostProcessingSize(composerRef.current, outlinePassRef.current, width, height);
      }
    } else {
      // console.warn('[ThreeScene] handleResize SKIPPED: One or more refs not ready.');
    }
  }, []); // Dependências vazias, pois usa refs

  /**
   * useEffect para configuração inicial da cena Three.js.
   * Este hook é executado apenas uma vez, quando o componente é montado.
   * Responsável por:
   * - Criar a cena, câmera, renderizador WebGL.
   * - Configurar e adicionar o renderizador CSS2D para rótulos.
   * - Configurar o EffectComposer e o OutlinePass para pós-processamento.
   * - Adicionar iluminação e plano de chão.
   * - Inicializar OrbitControls para navegação.
   * - Anexar ouvintes de evento para redimensionamento e interações do mouse.
   * - Definir `isSceneReady` como true ao final.
   */
  useEffect(() => {
    // console.log('[ThreeScene] Main setup useEffect RUNNING');
    if (!mountRef.current) {
      // console.warn('[ThreeScene] Main setup useEffect SKIPPED: mountRef.current is null.');
      return;
    }
    const currentMount = mountRef.current;
    // console.log(`[ThreeScene] Mount dimensions AT START of useEffect: ${currentMount.clientWidth}x${currentMount.clientHeight}`);
    
    let OrbitControls: typeof OrbitControlsType | null = null;

    sceneRef.current = new THREE.Scene();
    // console.log('[ThreeScene] Scene created');
    
    cameraRef.current = new THREE.PerspectiveCamera(75, Math.max(1, currentMount.clientWidth) / Math.max(1, currentMount.clientHeight), 0.1, 1000);
    cameraRef.current.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);
    // console.log('[ThreeScene] Camera created at:', cameraRef.current.position.clone());

    const pipeline = setupRenderPipeline(
      currentMount,
      sceneRef.current,
      cameraRef.current,
      Math.max(1, currentMount.clientWidth),
      Math.max(1, currentMount.clientHeight)
    );
    rendererRef.current = pipeline.renderer;
    labelRendererRef.current = pipeline.labelRenderer;
    composerRef.current = pipeline.composer;
    outlinePassRef.current = pipeline.outlinePass;
    // console.log('[ThreeScene] Render pipeline (WebGL, CSS2D, Composer, OutlinePass) configured via util.');

    setupLighting(sceneRef.current);
    // console.log('[ThreeScene] Lights added via util.');

    import('three/examples/jsm/controls/OrbitControls.js')
      .then(module => {
        OrbitControls = module.OrbitControls;
        if (!cameraRef.current || !rendererRef.current || !OrbitControls || !currentMount) return; 

        controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
        controlsRef.current.enableDamping = true;
        controlsRef.current.target.set(initialLookAt.x, initialLookAt.y, initialLookAt.z);
        controlsRef.current.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN
        };
        controlsRef.current.update();
        // console.log('[ThreeScene] OrbitControls created, target:', controlsRef.current.target.clone());

        const handleControlsChangeEnd = () => {
          if (cameraRef.current && controlsRef.current && onCameraChangeRef.current) {
            const newCameraState: CameraState = {
              position: cameraRef.current.position.clone(),
              lookAt: controlsRef.current.target.clone(),
            };
            // console.log('[ThreeScene] OrbitControls "end" event. New camera state:', newCameraState);
            onCameraChangeRef.current(newCameraState);
          }
        };
        controlsRef.current?.addEventListener('end', handleControlsChangeEnd);
        
        if (controlsRef.current) { 
            const currentControls = controlsRef.current;
             // Ensure userData is initialized as an object
            if (!currentControls.userData) {
                currentControls.userData = {};
            }
            currentControls.userData.cleanup = () => {
                currentControls.removeEventListener('end', handleControlsChangeEnd);
            };
        }
      })
      .catch(err => console.error("[ThreeScene] Failed to load OrbitControls", err));
      
    groundMeshRef.current = setupGroundPlane(sceneRef.current);
    // console.log('[ThreeScene] Ground plane added via util.');
        
    // console.log(`[ThreeScene] Attempting initial resize. Mount dimensions BEFORE first handleResize: ${currentMount.clientWidth}x${currentMount.clientHeight}`);
    handleResize();

    const delayedResizeTimeoutId = setTimeout(() => {
      // console.log(`[ThreeScene] Attempting DELAYED resize. Mount dimensions BEFORE delayed handleResize: ${currentMount.clientWidth}x${currentMount.clientHeight}`);
      handleResize();
    }, 150);

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(currentMount);

    currentMount.addEventListener('click', handleClick);
    currentMount.addEventListener('mousemove', handleMouseMove);
    
    setIsSceneReady(true); 
    // console.log('[ThreeScene] Scene is now READY.');
    
    // Cleanup
    return () => {
      // console.log('[ThreeScene] Main setup useEffect CLEANUP running.');
      setIsSceneReady(false);
      clearTimeout(delayedResizeTimeoutId);
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
      // console.log('[ThreeScene] Main setup useEffect CLEANUP FINISHED.');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Array de dependências vazio para garantir que rode apenas uma vez

  /**
   * Hook customizado para gerenciar o loop de animação da cena.
   */
  useAnimationLoop({
    isSceneReady,
    sceneRef,
    cameraRef,
    controlsRef,
    composerRef,
    labelRendererRef,
  });

  /**
   * Cria um mesh 3D para um equipamento, aplicando cor e outras propriedades.
   * Utiliza `getEquipmentColor` para a lógica de cor e `createGeometryForItem` para a geometria.
   * @param {Equipment} item - O objeto de equipamento.
   * @param {ColorMode} currentCM - O modo de coloração atual.
   * @returns {THREE.Object3D} O mesh 3D criado.
   * @callback
   */
  const createSingleEquipmentMesh = useCallback((item: Equipment, currentCM: ColorMode): THREE.Object3D => {
    // console.log(`[ThreeScene createSingleEquipmentMesh] For: ${item.tag}, State: ${item.operationalState}, ColorMode: ${currentCM}`);
    const finalColor = getEquipmentColor(item, currentCM);
    
    const material = new THREE.MeshStandardMaterial({
        color: finalColor,
        metalness: 0.3,
        roughness: 0.6,
    });

    if (item.operationalState === 'Não aplicável') {
        // console.log(`[ThreeScene createSingleEquipmentMesh] ${item.tag} is 'Não aplicável', setting transparency.`);
        material.transparent = true;
        material.opacity = 0.5; 
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
    return mesh;
  }, []); // colorMode não é mais uma dependência direta aqui, pois será passado como argumento

  /**
   * useEffect para atualizar os meshes dos equipamentos na cena.
   * É acionado quando `equipment`, `layers`, `colorMode` ou `isSceneReady` mudam.
   * Delega a lógica de atualização para `updateEquipmentMeshesInScene`.
   */
  useEffect(() => {
    // console.log('[ThreeScene] useEffect for EQUIPMENT MESHES update triggered.');
    if (!isSceneReady || !sceneRef.current) {
      // console.log('[ThreeScene equipment useEffect] SKIPPING: Scene not ready or no sceneRef.');
      return;
    }
    // console.log(`[ThreeScene equipment useEffect] Updating. isSceneReady: ${isSceneReady}, Equipment count: ${equipment.length}`);
    
    updateEquipmentMeshesInScene(
      sceneRef.current,
      equipmentMeshesRef,
      equipment,
      layers,
      (item) => createSingleEquipmentMesh(item, colorMode), // Passa colorMode aqui
      groundMeshRef
    );
  }, [equipment, layers, colorMode, isSceneReady, createSingleEquipmentMesh]);


  /**
   * Manipula o evento de movimento do mouse na cena, delegando para `mouse-interaction-manager`.
   * Atualiza o estado `hoveredEquipmentTag` através do callback `setHoveredEquipmentTagCallbackRef`.
   * @param {MouseEvent} event - O evento de mouse.
   * @callback
   */
  const handleMouseMove = useCallback((event: MouseEvent) => {
    // console.log(`[ThreeScene] handleMouseMove triggered. Currently hovered (ref): ${hoveredEquipmentTagRef.current}`);
    if (!isSceneReady || !mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current) {
        // console.warn('[ThreeScene] handleMouseMove: SKIPPING due to unready refs or no scene/camera/meshes.');
        if (typeof setHoveredEquipmentTagCallbackRef.current === 'function' && hoveredEquipmentTagRef.current !== null) {
            // console.log('[ThreeScene] handleMouseMove: Clearing hover because prerequisites not met.');
            setHoveredEquipmentTagCallbackRef.current(null);
        }
        return;
    }
     if (equipmentMeshesRef.current.length === 0 && typeof setHoveredEquipmentTagCallbackRef.current === 'function' && hoveredEquipmentTagRef.current !== null) {
      // console.log('[ThreeScene] handleMouseMove: No meshes, clearing hover.');
      setHoveredEquipmentTagCallbackRef.current(null);
      return;
    }
    
    processSceneMouseMove(
        event,
        mountRef.current,
        cameraRef.current,
        equipmentMeshesRef.current,
        (foundHoverTag) => { // Esta é a função interna que será chamada por processSceneMouseMove
            // console.log(`[ThreeScene] MouseMove found (internal callback):`, foundHoverTag, `Currently hovered (ref):`, hoveredEquipmentTagRef.current);
            if (hoveredEquipmentTagRef.current !== foundHoverTag) {
              if (typeof setHoveredEquipmentTagCallbackRef.current === 'function') {
                // console.log(`[ThreeScene] Calling setHoveredEquipmentTagCallbackRef.current with:`, foundHoverTag);
                setHoveredEquipmentTagCallbackRef.current(foundHoverTag);
              } else {
                // console.error('[ThreeScene] setHoveredEquipmentTagCallbackRef.current is not a function during mouse move update.');
              }
            }
        }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSceneReady]); // Depende apenas de isSceneReady e dos refs, que são estáveis

  /**
   * Manipula o evento de clique do mouse na cena, delegando para `mouse-interaction-manager`.
   * Chama o callback `onSelectEquipmentRef.current` para atualizar a seleção.
   * @param {MouseEvent} event - O evento de mouse.
   * @callback
   */
  const handleClick = useCallback((event: MouseEvent) => {
    // console.log(`[ThreeScene] handleClick triggered, button: ${event.button}`);
    if (event.button !== 0) { 
      // console.log('[ThreeScene] handleClick: Non-left click, ignoring for selection.');
      return;
    }

    if (!isSceneReady || !mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current ) {
        // console.warn('[ThreeScene] handleClick: SKIPPING due to unready refs or meshes.', {
        //   isSceneReady, camera: !!cameraRef.current, scene: !!sceneRef.current, meshes: !!equipmentMeshesRef.current
        // });
        if (typeof onSelectEquipmentRef.current === 'function' && (!equipmentMeshesRef.current || equipmentMeshesRef.current.length === 0)) {
             onSelectEquipmentRef.current(null, false); 
        }
        return;
    }

    if (equipmentMeshesRef.current.length === 0 && typeof onSelectEquipmentRef.current === 'function') {
      // console.log('[ThreeScene] handleClick: No meshes to intersect, clearing selection.');
      onSelectEquipmentRef.current(null, false);
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
  }, [isSceneReady]); // Depende apenas de isSceneReady e dos refs

  /**
   * useEffect para atualizar os pins de anotação na cena.
   * É acionado quando `annotations`, `layers`, `equipment` ou `isSceneReady` mudam.
   * Delega a lógica para `updateAnnotationPins`.
   */
  useEffect(() => {
    // console.log('[ThreeScene] useEffect for ANNOTATION PINS update triggered.');
    if (!isSceneReady || !sceneRef.current || !labelRendererRef.current) {
      // console.log('[ThreeScene annotation useEffect] SKIPPING: Scene or labelRenderer not ready.');
      return;
    }
    // console.log(`[ThreeScene annotation useEffect] Updating. Annotations count: ${annotations.length}`);

    updateAnnotationPins({
      scene: sceneRef.current,
      // labelRenderer: labelRendererRef.current, // labelRenderer é obtido dentro do utilitário se necessário
      annotations: annotations, 
      equipmentData: equipment, 
      layers: layers, 
      existingPinsRef: annotationPinObjectsRef,
      labelRendererInstance: labelRendererRef.current, // Passa a instância explicitamente
    });
  }, [annotations, layers, equipment, isSceneReady]); 

  /**
   * useEffect para atualizar a câmera programaticamente com base na prop `programmaticCameraState`.
   * É acionado quando `programmaticCameraState` ou `isSceneReady` mudam.
   */
  useEffect(() => {
    // console.log('[ThreeScene] useEffect for PROGRAMMATIC CAMERA update triggered. New state:', programmaticCameraState);
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
        // console.log(`[ThreeScene] Applying programmatic camera change. Pos changed: ${positionChanged}, LookAt changed: ${lookAtChanged}`);
        const oldControlsEnabled = controls.enabled;
        controls.enabled = false; 
        if (positionChanged) camera.position.copy(targetPosition);
        if (lookAtChanged) controls.target.copy(targetLookAt);
        controls.update(); 
        controls.enabled = oldControlsEnabled; 
      } else {
        // console.log('[ThreeScene] Programmatic camera state is the same as current, no update needed.');
      }
    }
  }, [programmaticCameraState, isSceneReady]);

  /**
   * useEffect para focar a câmera em um sistema específico.
   * É acionado quando `targetSystemToFrame` muda ou quando outros fatores que afetam
   * os meshes (como `equipment`, `layers`, `isSceneReady`) mudam.
   * Delega o cálculo da visão para `camera-utils`.
   */
  useEffect(() => {
    // console.log('[ThreeScene] useEffect for TARGET SYSTEM TO FRAME triggered. Target:', targetSystemToFrame);
    if (!targetSystemToFrame || !sceneRef.current || !cameraRef.current || !controlsRef.current || !isSceneReady || equipmentMeshesRef.current.length === 0) {
      // console.log('[ThreeScene system focus useEffect] SKIPPING: Prerequisites not met.');
      if (targetSystemToFrame && typeof onSystemFramed === 'function') {
        onSystemFramed(); 
      }
      return;
    }

    const systemMeshes = equipmentMeshesRef.current.filter(
      (mesh) => mesh.userData.sistema === targetSystemToFrame && mesh.visible
    );

    if (systemMeshes.length === 0) {
      // console.log(`[ThreeScene system focus useEffect] No visible meshes found for system: ${targetSystemToFrame}`);
      if (typeof onSystemFramed === 'function') onSystemFramed(); 
      return;
    }
    
    // console.log(`[ThreeScene system focus useEffect] Found ${systemMeshes.length} meshes for system: ${targetSystemToFrame}. Calculating view...`);
    const newView = calculateViewForMeshes(systemMeshes, cameraRef.current);

    if (newView && onCameraChangeRef.current) {
      // console.log('[ThreeScene system focus useEffect] New view calculated. Calling onCameraChange:', newView);
      onCameraChangeRef.current({
        position: newView.position,
        lookAt: newView.lookAt,
      });
    } else {
      // console.log('[ThreeScene system focus useEffect] Could not calculate new view.');
    }
    if (typeof onSystemFramed === 'function') onSystemFramed(); 
  }, [targetSystemToFrame, onSystemFramed, equipment, layers, isSceneReady]); // equipment e layers afetam equipmentMeshesRef

  /**
   * useEffect para gerenciar o OutlinePass (efeito de aura) para seleção e hover.
   * Delega a lógica de atualização para `updateOutlineEffect`.
   */
  useEffect(() => {
    // console.log(`[ThreeScene OutlinePass] useEffect triggered. isSceneReady: ${isSceneReady}`);
    if (!isSceneReady || !outlinePassRef.current || !equipmentMeshesRef.current) {
      // console.log('[ThreeScene OutlinePass] SKIPPING: Core refs not ready or scene not ready yet.');
      if(outlinePassRef.current) { 
        updateOutlineEffect(outlinePassRef.current, [], [], null);
      }
      return;
    }
    
    // console.log(`[ThreeScene OutlinePass] Received Props: selectedTags=${JSON.stringify(selectedEquipmentTags)}, hoveredTag=${hoveredEquipmentTag}`);
    const effectiveSelectedTags = Array.isArray(selectedEquipmentTags) ? selectedEquipmentTags : [];
    const effectiveHoveredTag = hoveredEquipmentTag === undefined ? null : hoveredEquipmentTag;
    // console.log(`[ThreeScene OutlinePass] Effective Values: selected=${JSON.stringify(effectiveSelectedTags)}, hovered=${effectiveHoveredTag}`);
    // console.log(`[ThreeScene OutlinePass] equipmentMeshesRef.current tags: ${equipmentMeshesRef.current.map(m => m.userData.tag).join(', ')}`);
    
    updateOutlineEffect(
      outlinePassRef.current,
      equipmentMeshesRef.current,
      effectiveSelectedTags,
      effectiveHoveredTag
    );
  
  }, [isSceneReady, selectedEquipmentTags, hoveredEquipmentTag, equipment, layers]); 

  return <div ref={mountRef} className="w-full h-full" />;
};

export default ThreeScene;
