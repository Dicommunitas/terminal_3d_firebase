
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
import type { OrbitControls as OrbitControlsType } from 'three/examples/jsm/controls/OrbitControls.js'; // Mantido para tipagem
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
 * @property {Layer[]} layers - Configuração das camadas de visibilidade.
 * @property {Annotation[]} annotations - Lista de anotações a serem exibidas.
 * @property {string[] | undefined} selectedEquipmentTags - Tags dos equipamentos atualmente selecionados.
 * @property {(tag: string | null, isMultiSelectModifierPressed: boolean) => void} onSelectEquipment - Callback para quando um equipamento é selecionado/deselecionado.
 * @property {string | null | undefined} hoveredEquipmentTag - Tag do equipamento atualmente sob o cursor.
 * @property {(tag: string | null) => void} setHoveredEquipmentTag - Callback para definir o equipamento em hover.
 * @property {CameraState | undefined} cameraState - O estado atual da câmera (posição, lookAt).
 * @property {(cameraState: CameraState) => void} onCameraChange - Callback para quando o estado da câmera muda devido à interação do usuário na cena.
 * @property {{ x: number; y: number; z: number }} initialCameraPosition - Posição inicial da câmera.
 * @property {{ x: number; y: number; z: number }} initialCameraLookAt - Ponto de observação (lookAt) inicial da câmera.
 * @property {ColorMode} colorMode - O modo de colorização atual para os equipamentos.
 * @property {string | null} targetSystemToFrame - O sistema que deve ser enquadrado pela câmera (se houver).
 * @property {() => void} onSystemFramed - Callback chamado após a câmera terminar de enquadrar um sistema.
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
  // console.log('[ThreeScene] Component rendering. Props:', {
  //   equipmentCount: props.equipment?.length,
  //   selectedEquipmentTags: props.selectedEquipmentTags,
  //   hoveredEquipmentTag: props.hoveredEquipmentTag,
  //   colorMode: props.colorMode,
  //   targetSystemToFrame: props.targetSystemToFrame
  // });

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

  // Refs para callbacks para evitar stale closures em manipuladores de eventos e useEffects
  const onSelectEquipmentRef = useRef(onSelectEquipment);
  const setHoveredEquipmentTagCallbackRef = useRef(setHoveredEquipmentTag);
  const onCameraChangeRef = useRef(onCameraChange);
  const onSystemFramedRef = useRef(onSystemFramed);

  useEffect(() => { onSelectEquipmentRef.current = onSelectEquipment; }, [onSelectEquipment]);
  useEffect(() => { setHoveredEquipmentTagCallbackRef.current = setHoveredEquipmentTag; }, [setHoveredEquipmentTag]);
  useEffect(() => { onCameraChangeRef.current = onCameraChange; }, [onCameraChange]);
  useEffect(() => { onSystemFramedRef.current = onSystemFramed; }, [onSystemFramed]);
  
  const hoveredEquipmentTagRef = useRef(hoveredEquipmentTag); // Para acesso dentro de callbacks não atualizados
  useEffect(() => { hoveredEquipmentTagRef.current = hoveredEquipmentTag; }, [hoveredEquipmentTag]);


  /**
   * Cria um mesh 3D para um equipamento individual.
   * Utiliza utilitários para geometria e cor.
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
      material.opacity = 0.5; // Aumentada a transparência
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
    mesh.userData = { tag: item.tag, type: item.type, sistema: item.sistema }; // Armazena a TAG
    mesh.castShadow = false; // Sombras desabilitadas
    mesh.receiveShadow = false; // Sombras desabilitadas
    return mesh;
  }, [colorMode]); // colorMode é uma dependência chave aqui


  /**
   * Manipula o redimensionamento do contêiner da cena, atualizando a câmera e os renderizadores.
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
   * Configura cena, câmera, renderizador WebGL, luzes, chão, OrbitControls,
   * renderizador de rótulos 2D, e o pipeline de pós-processamento (EffectComposer, OutlinePass).
   * Também configura o observador de redimensionamento e define isSceneReady.
   */
  useEffect(() => {
    console.log('[ThreeScene Main Setup useEffect] RUNNING');
    const currentMount = mountRef.current;
    if (!currentMount) {
      console.warn('[ThreeScene Setup] mountRef.current is null. Aborting setup.');
      return;
    }
    // console.log(`[ThreeScene Setup] Mount dimensions AT START of useEffect: ${currentMount.clientWidth}x${currentMount.clientHeight}`);

    sceneRef.current = new THREE.Scene();
    // console.log('[ThreeScene Setup] Scene created.');

    cameraRef.current = new THREE.PerspectiveCamera(75, Math.max(1, currentMount.clientWidth) / Math.max(1, currentMount.clientHeight), 0.1, 2000);
    if (initialCameraPosition) {
        cameraRef.current.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);
        // Adicionado para garantir que a câmera olhe para o alvo inicial se os controles ainda não estiverem prontos
        if (initialCameraLookAt && !controlsRef.current) {
            cameraRef.current.lookAt(initialCameraLookAt.x, initialCameraLookAt.y, initialCameraLookAt.z);
        }
    } else {
        console.error("[ThreeScene Setup] initialCameraPosition is undefined. Using default (0,5,10).");
        cameraRef.current.position.set(5, 5, 5); // Posição de fallback mais próxima para o cubo
        cameraRef.current.lookAt(0, 1, 0); // Olhar para o cubo de teste
    }
    // console.log(`[ThreeScene Setup] Camera created at:`, cameraRef.current.position);

    const pipeline = setupRenderPipeline(currentMount, sceneRef.current, cameraRef.current);
    if (!pipeline) {
      console.error("[ThreeScene Setup] Failed to setup render pipeline. Aborting.");
      setIsSceneReady(false); // Garantir que a cena não seja marcada como pronta
      return;
    }
    rendererRef.current = pipeline.renderer;
    labelRendererRef.current = pipeline.labelRenderer;
    composerRef.current = pipeline.composer;
    outlinePassRef.current = pipeline.outlinePass;
    // console.log('[ThreeScene Setup] Render pipeline (WebGL, CSS2D, Composer, OutlinePass) created.');
    
    setupLighting(sceneRef.current);
    // console.log('[ThreeScene Setup] Lighting setup.');
    
    groundMeshRef.current = setupGroundPlane(sceneRef.current);
    // console.log('[ThreeScene Setup] Ground plane setup.');
    
    let OrbitControls: typeof OrbitControlsType | null = null;
    const handleControlsChangeEnd = () => { // Definida aqui para ter acesso a onCameraChangeRef.current
        if (cameraRef.current && controlsRef.current && onCameraChangeRef.current) {
            // console.log('[ThreeScene OrbitControls] "end" event triggered.');
            const newCameraState: CameraState = {
                position: { x: cameraRef.current.position.x, y: cameraRef.current.position.y, z: cameraRef.current.position.z },
                lookAt: { x: controlsRef.current.target.x, y: controlsRef.current.target.y, z: controlsRef.current.target.z },
            };
            onCameraChangeRef.current(newCameraState);
        }
    };

    import('three/examples/jsm/controls/OrbitControls.js').then(module => {
        OrbitControls = module.OrbitControls;
        if (OrbitControls && cameraRef.current && rendererRef.current?.domElement) {
            const currentControls = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
            currentControls.enableDamping = true;
            currentControls.dampingFactor = 0.1;

            if (initialCameraLookAt) {
                currentControls.target.set(initialCameraLookAt.x, initialCameraLookAt.y, initialCameraLookAt.z);
            } else {
                console.error("[ThreeScene Setup] initialCameraLookAt is undefined during OrbitControls setup. Using default target (0,0,0).");
                currentControls.target.set(0, 0, 0); // Posição de fallback para o alvo
            }
            
            currentControls.mouseButtons = {
                LEFT: THREE.MOUSE.ROTATE,
                MIDDLE: THREE.MOUSE.ROTATE, 
                RIGHT: THREE.MOUSE.PAN
            };
            console.log('[ThreeScene OrbitControls] Applied mouseButtons:', currentControls.mouseButtons);

            currentControls.update();
            controlsRef.current = currentControls; 
            // console.log(`[ThreeScene Setup] OrbitControls created. Target:`, currentControls.target);
            
            currentControls.addEventListener('end', handleControlsChangeEnd);
            console.log('[ThreeScene OrbitControls] "end" event listener ADDED.');

        } else {
            console.error("[ThreeScene Setup] Failed to initialize OrbitControls: Camera or Renderer domElement not ready, or OrbitControls module not loaded.");
        }
    }).catch(err => console.error("Error loading OrbitControls", err));

    // console.log('[ThreeScene Setup] Attempting initial resize. Mount dimensions BEFORE first handleResize:', `${currentMount.clientWidth}x${currentMount.clientHeight}`);
    handleResize(); 
    
    const resizeObserver = new ResizeObserver(handleResize);
    if (currentMount) {
      resizeObserver.observe(currentMount);
    }
    
    const initialSetupTimeoutId = setTimeout(() => {
      // console.log('[ThreeScene Setup] Attempting DELAYED resize. Mount dimensions BEFORE delayed handleResize:', `${currentMount?.clientWidth}x${currentMount?.clientHeight}`);
      handleResize(); 
      setIsSceneReady(true);
      console.log('[ThreeScene Setup] Scene is now READY (after delay).');
    }, 150);

    return () => {
      console.log('[ThreeScene Main Setup useEffect] CLEANUP running.');
      clearTimeout(initialSetupTimeoutId);
      if (currentMount) {
        resizeObserver.unobserve(currentMount);
      }
      
      if (controlsRef.current) {
        console.log('[ThreeScene OrbitControls] Removing "end" event listener in cleanup.');
        controlsRef.current.removeEventListener('end', handleControlsChangeEnd);
        controlsRef.current.dispose();
        controlsRef.current = null;
      }
      
      composerRef.current?.dispose();
      composerRef.current = null;
      outlinePassRef.current = null; // O OutlinePass é um pass do composer, não precisa de dispose separado se o composer for disposto.

      labelRendererRef.current?.domElement?.remove();
      labelRendererRef.current = null;

      rendererRef.current?.domElement?.remove();
      rendererRef.current?.dispose();
      rendererRef.current = null;
      
      sceneRef.current?.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(m => m?.dispose());
        }
      });
      sceneRef.current?.clear();
      sceneRef.current = null;
      
      equipmentMeshesRef.current = [];
      annotationPinObjectsRef.current.forEach(pin => pin.element.remove());
      annotationPinObjectsRef.current = [];

      groundMeshRef.current = null; // A geometria e material do chão são limpos com scene.traverse
      cameraRef.current = null;
      
      setIsSceneReady(false);
      console.log('[ThreeScene Main Setup useEffect] CLEANUP finished.');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Deve rodar apenas uma vez


  /**
   * Manipulador para o evento de movimento do mouse na cena.
   * Utiliza o `mouse-interaction-manager` para processar o hover.
   */
  const handleMouseMove = useCallback((event: MouseEvent) => {
    console.log('[ThreeScene] handleMouseMove triggered');
    if (!isSceneReady || !mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current) {
      const reasons = [];
      if (!isSceneReady) reasons.push("Scene not ready");
      if (!mountRef.current) reasons.push("mountRef not current");
      if (!cameraRef.current) reasons.push("cameraRef not current");
      if (!sceneRef.current) reasons.push("sceneRef not current");
      if (!equipmentMeshesRef.current) reasons.push("equipmentMeshesRef not current");
      console.log(`[ThreeScene handleMouseMove] SKIPPING: ${reasons.join(', ')}.`);
      return;
    }
    
    processSceneMouseMove(
        event,
        mountRef.current,
        cameraRef.current,
        equipmentMeshesRef.current, // Passa os meshes atuais
        (tag) => { // Este é o setHoveredEquipmentTagCallback
            if (typeof setHoveredEquipmentTagCallbackRef.current === 'function') {
                // console.log(`[ThreeScene handleMouseMove] Calling setHoveredEquipmentTagCallbackRef with tag: ${tag}`);
                setHoveredEquipmentTagCallbackRef.current(tag);
            } else {
                console.error('[ThreeScene handleMouseMove] setHoveredEquipmentTagCallbackRef.current is not a function.');
            }
        }
    );
  }, [isSceneReady]); // Depende de isSceneReady para ter a versão correta

  /**
   * Manipulador para o evento de clique na cena.
   * Utiliza o `mouse-interaction-manager` para processar a seleção.
   */
  const handleClick = useCallback((event: MouseEvent) => {
    console.log('[ThreeScene] handleClick triggered, Raw event:', event);
    console.log(`[ThreeScene handleClick] Event details - button: ${event.button}, buttons: ${event.buttons}, which: ${event.which}`);
    
    if (event.button !== 0) {
      console.log(`[ThreeScene handleClick] SKIPPING: Not a left click (event.button: ${event.button}).`);
      return;
    }

    if (!isSceneReady || !mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current) {
      const reasons = [];
      if (!isSceneReady) reasons.push("Scene not ready");
      if (!mountRef.current) reasons.push("mountRef not current");
      if (!cameraRef.current) reasons.push("cameraRef not current");
      if (!sceneRef.current) reasons.push("sceneRef not current");
      if (!equipmentMeshesRef.current) reasons.push("equipmentMeshesRef not current");
      console.log(`[ThreeScene handleClick] SKIPPING: ${reasons.join(', ')}.`);
      return;
    }
    
    console.log('[ThreeScene handleClick] Processing click for selection.');
    processSceneClick(
        event,
        mountRef.current,
        cameraRef.current,
        equipmentMeshesRef.current, // Passa os meshes atuais
        (tag, isMultiSelect) => { // Este é o onSelectEquipmentCallback
             if (typeof onSelectEquipmentRef.current === 'function') {
                // console.log(`[ThreeScene handleClick] Calling onSelectEquipmentRef with tag: ${tag}, multi: ${isMultiSelect}`);
                onSelectEquipmentRef.current(tag, isMultiSelect);
            } else {
                console.error('[ThreeScene handleClick] onSelectEquipmentRef.current is not a function.');
            }
        }
    );
  }, [isSceneReady]); // Depende de isSceneReady para ter a versão correta


  /**
   * useEffect para adicionar/remover ouvintes de eventos do mouse (click e mousemove).
   * Depende de `handleClick` e `handleMouseMove` para garantir que as versões mais recentes
   * dos callbacks (que capturam o `isSceneReady` correto) sejam usadas.
   */
  useEffect(() => {
    const currentMount = mountRef.current;
    if (currentMount && isSceneReady) { // Adiciona listeners apenas se a cena estiver pronta
      console.log('[ThreeScene EventListeners useEffect] ADDING mouse event listeners (isSceneReady: true).');
      currentMount.addEventListener('click', handleClick);
      currentMount.addEventListener('mousemove', handleMouseMove);

      return () => {
        console.log('[ThreeScene EventListeners useEffect] REMOVING mouse event listeners.');
        currentMount.removeEventListener('click', handleClick);
        currentMount.removeEventListener('mousemove', handleMouseMove);
      };
    } else if (currentMount) {
        console.log('[ThreeScene EventListeners useEffect] SKIPPING adding mouse listeners (isSceneReady: false).');
        // Limpeza caso os listeners tenham sido adicionados em uma execução anterior e isSceneReady mudou para false
        currentMount.removeEventListener('click', handleClick);
        currentMount.removeEventListener('mousemove', handleMouseMove);
    }
  }, [handleClick, handleMouseMove, isSceneReady]); // Adicionado isSceneReady como dependência direta


  /**
   * useEffect para atualizar os meshes dos equipamentos na cena.
   * É acionado quando `equipment`, `layers`, `colorMode` ou `isSceneReady` mudam.
   * Utiliza `updateEquipmentMeshesInScene` de `scene-elements-setup.ts`.
   */
  useEffect(() => {
    // console.log(`[ThreeScene EquipmentUpdate useEffect] Triggered. Equipment count: ${equipment?.length}, isSceneReady: ${isSceneReady}, colorMode: ${colorMode}`);
    if (!isSceneReady || !sceneRef.current || !Array.isArray(equipment)) {
      // console.log('[ThreeScene EquipmentUpdate useEffect] SKIPPING: Scene not ready, sceneRef not current, or equipment not an array.');
      return;
    }
    updateEquipmentMeshesInScene({
      scene: sceneRef.current,
      equipmentMeshesRef: equipmentMeshesRef,
      newEquipmentData: equipment,
      layers,
      colorMode,
      createSingleEquipmentMesh, // Passando a função memoizada
      groundMeshRef,
    });
    // console.log(`[ThreeScene EquipmentUpdate useEffect] Done. Meshes in ref: ${equipmentMeshesRef.current.length}`);
  }, [equipment, layers, colorMode, isSceneReady, createSingleEquipmentMesh]);

  /**
   * useEffect para gerenciar os pins de anotação.
   * É acionado quando `annotations`, `layers`, `equipment` ou `isSceneReady` mudam.
   * Utiliza `updateAnnotationPins` de `label-renderer-utils.ts`.
   */
  useEffect(() => {
    // console.log(`[ThreeScene Annotations useEffect] Triggered. Annotations: ${annotations?.length}, isSceneReady: ${isSceneReady}`);
    if (!isSceneReady || !sceneRef.current || !labelRendererRef.current || !Array.isArray(annotations) || !Array.isArray(equipment)) {
      // console.log('[ThreeScene Annotations useEffect] SKIPPING: Scene not ready, core refs not available, or data not valid.');
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
  }, [annotations, layers, equipment, isSceneReady]); // Adicionado equipment como dependência

  // Hook para gerenciar o efeito de contorno (OutlinePass).
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
        // console.log('[ThreeScene Programmatic Camera] Applying change. Pos changed:', positionChanged, 'LookAt changed:', lookAtChanged);
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
    // console.log(`[ThreeScene FocusSystem useEffect] Target system: ${targetSystemToFrame}, isSceneReady: ${isSceneReady}, Equipment meshes count: ${equipmentMeshesRef.current.length}`);
    if (!targetSystemToFrame || !sceneRef.current || !cameraRef.current || !controlsRef.current || !isSceneReady || equipmentMeshesRef.current.length === 0) {
      if (targetSystemToFrame && typeof onSystemFramedRef.current === 'function') {
        // console.log('[ThreeScene FocusSystem useEffect] Conditions not met, but calling onSystemFramed if targetSystemToFrame was set.');
        onSystemFramedRef.current(); 
      }
      return;
    }
    // console.log('[ThreeScene FocusSystem useEffect] Finding meshes for system:', targetSystemToFrame);
    const systemMeshes = equipmentMeshesRef.current.filter(mesh => mesh.userData.sistema === targetSystemToFrame && mesh.visible);
    // console.log(`[ThreeScene FocusSystem useEffect] Found ${systemMeshes.length} meshes for system ${targetSystemToFrame}.`);

    if (systemMeshes.length === 0) {
      if (typeof onSystemFramedRef.current === 'function') onSystemFramedRef.current();
      return;
    }
    const newView = calculateViewForMeshes(systemMeshes, cameraRef.current);
    if (newView && typeof onCameraChangeRef.current === 'function') {
      // console.log('[ThreeScene FocusSystem useEffect] Calculated new view, calling onCameraChange:', newView);
      onCameraChangeRef.current({
        position: {x: newView.position.x, y: newView.position.y, z: newView.position.z },
        lookAt: {x: newView.lookAt.x, y: newView.lookAt.y, z: newView.lookAt.z },
      });
    }
    if (typeof onSystemFramedRef.current === 'function') {
      // console.log('[ThreeScene FocusSystem useEffect] Calling onSystemFramed.');
      onSystemFramedRef.current();
    }
  }, [targetSystemToFrame, isSceneReady, equipment]); // equipment é uma dependência indireta via equipmentMeshesRef

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

