
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
import { updateOutlineEffect, setupPostProcessing, updatePostProcessingSize } from '@/core/three/postprocessing-utils';
import { updateAnnotationPins, setupLabelRenderer, updateLabelRendererSize } from '@/core/three/label-renderer-utils';
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
 * @param {ThreeSceneProps} props As props do componente.
 * @returns {JSX.Element} O componente ThreeScene.
 */
const ThreeScene: React.FC<ThreeSceneProps> = (props) => {
  // console.log(`[ThreeScene RENDER] Props: `, {
  //   selectedEquipmentTags: props.selectedEquipmentTags,
  //   hoveredEquipmentTag: props.hoveredEquipmentTag,
  //   colorMode: props.colorMode,
  //   targetSystemToFrame: props.targetSystemToFrame,
  //   equipmentCount: props.equipment.length
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
  const onSelectEquipmentRef = useRef(props.onSelectEquipment);
  const onCameraChangeRef = useRef(props.onCameraChange);
  const setHoveredEquipmentTagCallbackRef = useRef(props.setHoveredEquipmentTag);
  
  const [isSceneReady, setIsSceneReady] = useState(false);

  // Atualiza os refs dos callbacks quando as props mudam
  useEffect(() => { onSelectEquipmentRef.current = props.onSelectEquipment; }, [props.onSelectEquipment]);
  useEffect(() => { onCameraChangeRef.current = props.onCameraChange; }, [props.onCameraChange]);
  useEffect(() => { setHoveredEquipmentTagCallbackRef.current = props.setHoveredEquipmentTag; }, [props.setHoveredEquipmentTag]);

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
      
      rendererRef.current.setSize(width, height);
      updateLabelRendererSize(labelRendererRef.current, width, height);
      updatePostProcessingSize(composerRef.current, outlinePassRef.current, width, height);
    } else {
      // console.warn('[ThreeScene] handleResize SKIPPED: One or more refs not ready.');
    }
  }, []); // Dependências vazias, pois usa refs

  /**
   * useEffect para configuração inicial da cena Three.js.
   * Este hook é executado apenas uma vez, quando o componente é montado.
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
    
    cameraRef.current = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    cameraRef.current.position.set(props.initialCameraPosition.x, props.initialCameraPosition.y, props.initialCameraPosition.z);
    // console.log('[ThreeScene] Camera created at:', cameraRef.current.position.clone());

    // Utiliza setupRenderPipeline do scene-elements-setup.ts
    const pipeline = setupRenderPipeline(
      currentMount,
      sceneRef.current,
      cameraRef.current,
      currentMount.clientWidth,
      currentMount.clientHeight
    );
    rendererRef.current = pipeline.renderer;
    labelRendererRef.current = pipeline.labelRenderer;
    composerRef.current = pipeline.composer;
    outlinePassRef.current = pipeline.outlinePass;
    // console.log('[ThreeScene] Render pipeline (WebGL, CSS2D, Composer, OutlinePass) configured via util.');

    // Utiliza setupLighting do scene-elements-setup.ts
    setupLighting(sceneRef.current);
    // console.log('[ThreeScene] Lights added via util.');

    // Importação dinâmica de OrbitControls
    import('three/examples/jsm/controls/OrbitControls.js')
      .then(module => {
        OrbitControls = module.OrbitControls;
        if (!cameraRef.current || !rendererRef.current || !OrbitControls) return; // Checagem adicional

        controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
        controlsRef.current.enableDamping = true;
        controlsRef.current.target.set(props.initialCameraLookAt.x, props.initialCameraLookAt.y, props.initialCameraLookAt.z);
        controlsRef.current.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN
        };
        controlsRef.current.update();
        // console.log('[ThreeScene] OrbitControls created, target:', controlsRef.current.target.clone());

        // Event listener para mudanças de câmera pelo OrbitControls
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
        
        // Adiciona o listener de cleanup para o evento 'end'
        if (controlsRef.current) { // Necessário para o cleanup
            const currentControls = controlsRef.current;
            currentControls.userData.cleanup = () => {
                currentControls.removeEventListener('end', handleControlsChangeEnd);
            };
        }
      })
      .catch(err => console.error("[ThreeScene] Failed to load OrbitControls", err));
      
    // Utiliza setupGroundPlane do scene-elements-setup.ts
    groundMeshRef.current = setupGroundPlane(sceneRef.current);
    // console.log('[ThreeScene] Ground plane added via util.');
        
    // console.log(`[ThreeScene] Attempting initial resize. Mount dimensions BEFORE first handleResize: ${currentMount.clientWidth}x${currentMount.clientHeight}`);
    handleResize(); // Primeira chamada para garantir o dimensionamento

    // Um timeout pequeno para garantir que o layout do DOM esteja estável
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
      
      // Cleanup OrbitControls (incluindo o listener 'end')
      if (controlsRef.current) {
        if (controlsRef.current.userData.cleanup) {
            controlsRef.current.userData.cleanup();
        }
        controlsRef.current.dispose();
        controlsRef.current = null;
      }

      // Dispor meshes dos equipamentos
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

      // Dispor pins de anotação
      annotationPinObjectsRef.current.forEach(annoObj => {
        sceneRef.current?.remove(annoObj);
        if (annoObj.element.parentNode) {
          annoObj.element.parentNode.removeChild(annoObj.element);
        }
      });
      annotationPinObjectsRef.current = [];
      
      // Dispor plano de chão
      if (sceneRef.current && groundMeshRef.current) {
        sceneRef.current.remove(groundMeshRef.current);
        groundMeshRef.current.geometry?.dispose();
        if (groundMeshRef.current.material instanceof THREE.Material) {
           groundMeshRef.current.material.dispose();
        }
        groundMeshRef.current = null;
      }
      
      // Dispor composer e passes
      composerRef.current?.passes.forEach(pass => { if ((pass as any).dispose) (pass as any).dispose(); });
      composerRef.current = null;
      outlinePassRef.current = null; // O outlinePass é parte do composer

      // Dispor renderizadores e remover seus elementos DOM
      if (rendererRef.current?.domElement && rendererRef.current.domElement.parentNode === currentMount) {
        currentMount.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
      rendererRef.current = null;

      if (labelRendererRef.current?.domElement && labelRendererRef.current.domElement.parentNode === currentMount) {
        currentMount.removeChild(labelRendererRef.current.domElement);
      }
      // CSS2DRenderer não tem um método dispose explícito que limpe o DOM.
      labelRendererRef.current = null;
      
      sceneRef.current = null;
      cameraRef.current = null;
      // console.log('[ThreeScene] Main setup useEffect CLEANUP FINISHED.');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.initialCameraPosition, props.initialCameraLookAt]); // Dependências mínimas para setup inicial

  // Hook customizado para o loop de animação
  useAnimationLoop({
    isSceneReady,
    sceneRef,
    cameraRef,
    controlsRef,
    composerRef, // Passa o composer para ser renderizado
    labelRendererRef,
  });

  /**
   * Cria um mesh 3D para um equipamento específico, aplicando a cor correta
   * com base no modo de colorização e estado operacional.
   * Utiliza `getEquipmentColor` para a lógica de cor e `createGeometryForItem` para a geometria.
   * @param {Equipment} item O objeto de equipamento.
   * @returns {THREE.Object3D} O mesh 3D criado.
   */
  const createSingleEquipmentMesh = useCallback((item: Equipment): THREE.Object3D => {
    // console.log(`[ThreeScene createSingleEquipmentMesh] For: ${item.tag}, State: ${item.operationalState}, ColorMode: ${props.colorMode}`);
    const finalColor = getEquipmentColor(item, props.colorMode);
    
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
  }, [props.colorMode]); // Depende apenas de colorMode, pois item é um argumento


  /**
   * useEffect para atualizar os meshes dos equipamentos na cena.
   * É acionado quando `props.equipment`, `props.layers`, `props.colorMode`, `isSceneReady` ou `createSingleEquipmentMesh` mudam.
   * Delega a lógica de atualização para `updateEquipmentMeshesInScene`.
   */
  useEffect(() => {
    // console.log('[ThreeScene] useEffect for EQUIPMENT MESHES update triggered.');
    if (!isSceneReady || !sceneRef.current) {
      // console.log('[ThreeScene equipment useEffect] SKIPPING: Scene not ready or no sceneRef.');
      return;
    }
    // console.log(`[ThreeScene equipment useEffect] Updating. isSceneReady: ${isSceneReady}, Equipment count: ${props.equipment.length}`);
    
    updateEquipmentMeshesInScene(
      sceneRef.current,
      equipmentMeshesRef,
      props.equipment, // props.equipment já é a lista filtrada de page.tsx
      props.layers,
      createSingleEquipmentMesh, // Passa a função de criação de mesh
      groundMeshRef
    );
  }, [props.equipment, props.layers, props.colorMode, isSceneReady, createSingleEquipmentMesh]);


  /**
   * Manipula o evento de movimento do mouse na cena, delegando para `mouse-interaction-manager`.
   * Atualiza o estado `hoveredEquipmentTag` através do callback `setHoveredEquipmentTagCallbackRef`.
   */
  const handleMouseMove = useCallback((event: MouseEvent) => {
    // console.log('[ThreeScene] handleMouseMove triggered');
    if (!isSceneReady || !mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current || equipmentMeshesRef.current.length === 0) {
      // console.log('[ThreeScene] handleMouseMove: SKIPPING due to unready refs or no meshes.');
      if (typeof setHoveredEquipmentTagCallbackRef.current === 'function') {
        setHoveredEquipmentTagCallbackRef.current(null); // Garante que o hover seja limpo
      }
      return;
    }
    
    if (typeof setHoveredEquipmentTagCallbackRef.current !== 'function') {
      // console.error('[ThreeScene] handleMouseMove: setHoveredEquipmentTagCallbackRef.current is not a function.');
      return;
    }

    processSceneMouseMove(
        event,
        mountRef.current,
        cameraRef.current,
        equipmentMeshesRef.current,
        setHoveredEquipmentTagCallbackRef.current 
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSceneReady]); // Depende apenas de isSceneReady e dos refs, que são estáveis

  /**
   * Manipula o evento de clique do mouse na cena, delegando para `mouse-interaction-manager`.
   * Chama o callback `onSelectEquipmentRef.current` para atualizar a seleção.
   */
  const handleClick = useCallback((event: MouseEvent) => {
    // console.log(`[ThreeScene] handleClick triggered, button: ${event.button}`);
    if (event.button !== 0) { // Apenas processa cliques esquerdos para seleção
      // console.log('[ThreeScene] handleClick: Non-left click, ignoring for selection.');
      return;
    }

    if (!isSceneReady || !mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current ) {
        // console.warn('[ThreeScene] handleClick: SKIPPING due to unready refs or no scene/camera/meshes.', {
        //   isSceneReady, camera: !!cameraRef.current, scene: !!sceneRef.current, meshes: !!equipmentMeshesRef.current
        // });
        // Se não houver meshes ou a cena não estiver pronta, ainda pode ser um clique no vazio para desmarcar.
        // Mas a lógica de raycasting não fará sentido.
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
        equipmentMeshesRef.current, // Passa todos os meshes atualmente na ref
        onSelectEquipmentRef.current 
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSceneReady]); // Depende apenas de isSceneReady e dos refs

  /**
   * useEffect para atualizar os pins de anotação na cena.
   * É acionado quando `props.annotations`, `props.layers`, `props.equipment` ou `isSceneReady` mudam.
   * Delega a lógica para `updateAnnotationPins`.
   */
  useEffect(() => {
    // console.log('[ThreeScene] useEffect for ANNOTATION PINS update triggered.');
    if (!isSceneReady || !sceneRef.current || !labelRendererRef.current) {
      // console.log('[ThreeScene annotation useEffect] SKIPPING: Scene or labelRenderer not ready.');
      return;
    }
    // console.log(`[ThreeScene annotation useEffect] Updating. Annotations count: ${props.annotations.length}`);

    updateAnnotationPins({
      scene: sceneRef.current,
      labelRenderer: labelRendererRef.current,
      annotations: props.annotations, 
      equipmentData: props.equipment, // Passa a lista filtrada, pois o pin só deve aparecer se o equipamento estiver visível
      layers: props.layers, 
      existingPinsRef: annotationPinObjectsRef,
    });
  }, [props.annotations, props.layers, props.equipment, isSceneReady]); 

  /**
   * useEffect para atualizar a câmera programaticamente com base na prop `props.cameraState`.
   * É acionado quando `props.cameraState` ou `isSceneReady` mudam.
   */
  useEffect(() => {
    // console.log('[ThreeScene] useEffect for PROGRAMMATIC CAMERA update triggered. New state:', props.cameraState);
    if (props.cameraState && cameraRef.current && controlsRef.current && isSceneReady) {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      
      // Garante que os valores de props.cameraState.position/lookAt sejam tratados como objetos completos
      const targetPosition = new THREE.Vector3(
        props.cameraState.position.x,
        props.cameraState.position.y,
        props.cameraState.position.z
      );
      const targetLookAt = props.cameraState.lookAt ? new THREE.Vector3(
        props.cameraState.lookAt.x,
        props.cameraState.lookAt.y,
        props.cameraState.lookAt.z
      ) : controls.target.clone(); // Fallback para o target atual se lookAt não for fornecido
      
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
  }, [props.cameraState, isSceneReady]);

  /**
   * useEffect para focar a câmera em um sistema específico.
   * É acionado quando `props.targetSystemToFrame` muda ou quando outros fatores que afetam
   * os meshes (como `props.equipment`, `props.layers`, `isSceneReady`) mudam.
   * Delega o cálculo da visão para `camera-utils`.
   */
  useEffect(() => {
    // console.log('[ThreeScene] useEffect for TARGET SYSTEM TO FRAME triggered. Target:', props.targetSystemToFrame);
    if (!props.targetSystemToFrame || !sceneRef.current || !cameraRef.current || !controlsRef.current || !isSceneReady || equipmentMeshesRef.current.length === 0) {
      // console.log('[ThreeScene system focus useEffect] SKIPPING: Prerequisites not met.');
      if (props.targetSystemToFrame && typeof props.onSystemFramed === 'function') {
        // Se havia um alvo mas não podemos enquadrar, ainda chamamos onSystemFramed para resetar.
        props.onSystemFramed(); 
      }
      return;
    }

    const systemMeshes = equipmentMeshesRef.current.filter(
      (mesh) => mesh.userData.sistema === props.targetSystemToFrame && mesh.visible
    );

    if (systemMeshes.length === 0) {
      // console.log(`[ThreeScene system focus useEffect] No visible meshes found for system: ${props.targetSystemToFrame}`);
      if (typeof props.onSystemFramed === 'function') props.onSystemFramed(); 
      return;
    }
    
    // console.log(`[ThreeScene system focus useEffect] Found ${systemMeshes.length} meshes for system: ${props.targetSystemToFrame}. Calculating view...`);
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
    if (typeof props.onSystemFramed === 'function') props.onSystemFramed(); 
  }, [props.targetSystemToFrame, props.onSystemFramed, props.equipment, props.layers, isSceneReady]); 

  /**
   * useEffect para gerenciar o OutlinePass (efeito de aura) para seleção e hover.
   * É acionado por mudanças em `isSceneReady`, `props.selectedEquipmentTags`, `props.hoveredEquipmentTag`,
   * e `equipmentMeshesRef` (que muda com `props.equipment` e `props.layers`).
   * Delega a lógica de atualização para `updateOutlineEffect`.
   */
  useEffect(() => {
    if (!isSceneReady || !outlinePassRef.current || !equipmentMeshesRef.current) {
      // console.log('[ThreeScene OutlinePass] SKIPPING: Core refs not ready or scene not ready yet.');
      if(outlinePassRef.current) { 
        updateOutlineEffect(outlinePassRef.current, [], [], null);
      }
      return;
    }
    
    // Garante que as props sejam tratadas como arrays/null mesmo se undefined na primeira renderização.
    const effectiveSelectedTags = props.selectedEquipmentTags ?? [];
    const effectiveHoveredTag = props.hoveredEquipmentTag === undefined ? null : props.hoveredEquipmentTag;

    // console.log(`[ThreeScene OutlinePass] Received Props: selectedTags=${JSON.stringify(props.selectedEquipmentTags)}, hoveredTag=${props.hoveredEquipmentTag}`);
    // console.log(`[ThreeScene OutlinePass] Effective Values: selected=${JSON.stringify(effectiveSelectedTags)}, hovered=${effectiveHoveredTag}`);
    // console.log(`[ThreeScene OutlinePass] equipmentMeshesRef.current tags: ${equipmentMeshesRef.current.map(m => m.userData.tag).join(', ')}`);
    
    updateOutlineEffect(
      outlinePassRef.current,
      equipmentMeshesRef.current, // Passa a referência atual dos meshes
      effectiveSelectedTags,
      effectiveHoveredTag
    );
  
  }, [isSceneReady, props.selectedEquipmentTags, props.hoveredEquipmentTag, props.equipment, props.layers]); // equipment e layers afetam equipmentMeshesRef

  return <div ref={mountRef} className="w-full h-full" />;
};

export default ThreeScene;

// Correção do SVG pin - esta é a linha problemática que pode estar causando o erro de parsing
// A lógica para criar o pin está no updateAnnotationPins em label-renderer-utils.ts
// A linha problemática específica é:
// pinDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#FFD700" style="opacity: 0.9; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5));"><path d="M12 2C8.13 2 5 5.13 5 9c0 4.17 4.42 9.92 6.24 12.11.4.48 1.13.48 1.53 0C14.58 18.92 19 13.17 19 9c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>`;
// O erro `Expected unicode escape` é geralmente causado por um `\` extra ANTES do primeiro acento grave `\``.
// Assegure-se de que a linha seja exatamente como acima, sem um `\` antes do primeiro `\``.
