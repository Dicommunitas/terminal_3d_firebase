
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
// Temporarily comment out unused imports for debugging
// import { OrbitControls as OrbitControlsType } from 'three/examples/jsm/controls/OrbitControls.js';
// import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
// import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
// import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
// import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';

import type { Equipment, Layer, CameraState, Annotation, ColorMode } from '@/lib/types';
// import { getEquipmentColor } from '@/core/graphics/color-utils';
// import { processSceneClick, processSceneMouseMove } from '@/core/three/mouse-interaction-manager';
// import { createGeometryForItem } from '@/core/three/equipment-geometry-factory';
// import { setupLighting, setupGroundPlane, setupRenderPipeline, updateEquipmentMeshesInScene } from '@/core/three/scene-elements-setup';
// import { updateAnnotationPins } from '@/core/three/label-renderer-utils';
// import { calculateViewForMeshes } from '@/core/three/camera-utils';
// import { useAnimationLoop } from '@/hooks/use-animation-loop';
// import { useSceneOutline } from '@/hooks/use-scene-outline';

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
 * @param {ThreeSceneProps} props As propriedades do componente.
 * @returns {JSX.Element} Um elemento div que serve como contêiner para a cena 3D.
 */
const ThreeScene: React.FC<ThreeSceneProps> = (props) => {
  console.log('[ThreeScene] Component rendering');
  const {
    // equipment,
    // layers,
    // annotations,
    // selectedEquipmentTags,
    onSelectEquipment,
    // hoveredEquipmentTag,
    setHoveredEquipmentTag,
    // cameraState: programmaticCameraState,
    // onCameraChange,
    initialCameraPosition,
    initialCameraLookAt,
    // colorMode,
    // targetSystemToFrame,
    // onSystemFramed,
  } = props;

  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  // const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  // const controlsRef = useRef<OrbitControlsType | null>(null);
  // const composerRef = useRef<EffectComposer | null>(null);
  // const outlinePassRef = useRef<OutlinePass | null>(null);
  // const equipmentMeshesRef = useRef<THREE.Object3D[]>([]);
  // const annotationPinObjectsRef = useRef<CSS2DObject[]>([]);
  // const groundMeshRef = useRef<THREE.Mesh | null>(null);

  const [isSceneReady, setIsSceneReady] = useState(false);

  // Refs para callbacks para evitar problemas de staleness em useEffects/useCallback
  // const onSelectEquipmentRef = useRef(onSelectEquipment);
  // const setHoveredEquipmentTagCallbackRef = useRef(setHoveredEquipmentTag);
  // const onCameraChangeRef = useRef(onCameraChange);

  // useEffect(() => { onSelectEquipmentRef.current = onSelectEquipment; }, [onSelectEquipment]);
  // useEffect(() => { setHoveredEquipmentTagCallbackRef.current = setHoveredEquipmentTag; }, [setHoveredEquipmentTag]);
  // useEffect(() => { onCameraChangeRef.current = onCameraChange; }, [onCameraChange]);


  const handleResize = useCallback(() => {
    console.log('[ThreeScene handleResize] Triggered.');
    if (mountRef.current && cameraRef.current && rendererRef.current) {
      const width = Math.max(1, mountRef.current.clientWidth);
      const height = Math.max(1, mountRef.current.clientHeight);
      console.log(`[ThreeScene handleResize] New dimensions: ${width}x${height}`);

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      
      rendererRef.current.setSize(width, height);
      // labelRendererRef.current?.setSize(width, height);
      // composerRef.current?.setSize(width, height);
      // outlinePassRef.current?.resolution.set(width, height);
    } else {
        console.log('[ThreeScene handleResize] SKIPPED: Core refs not ready for resize.');
    }
  }, []); // mountRef is stable, other refs are set in useEffect


  /**
   * useEffect para configuração inicial da cena Three.js.
   */
  useEffect(() => {
    console.log('[ThreeScene Main Setup useEffect] RUNNING');
    if (!mountRef.current) {
      console.warn('[ThreeScene Setup] mountRef.current is null. Aborting setup.');
      return;
    }
    const currentMount = mountRef.current;
    console.log(`[ThreeScene Setup] Mount dimensions AT START of useEffect: ${currentMount.clientWidth}x${currentMount.clientHeight}`);

    // 1. Cena
    sceneRef.current = new THREE.Scene();
    sceneRef.current.background = new THREE.Color(0x87CEEB); // Light sky blue
    console.log('[ThreeScene Setup] Scene created.');

    // 2. Câmera
    cameraRef.current = new THREE.PerspectiveCamera(75, Math.max(1, currentMount.clientWidth) / Math.max(1, currentMount.clientHeight), 0.1, 2000);
    cameraRef.current.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);
    if (initialCameraLookAt) {
        cameraRef.current.lookAt(initialCameraLookAt.x, initialCameraLookAt.y, initialCameraLookAt.z);
    } else {
        cameraRef.current.lookAt(0, 0, 0);
    }
    console.log(`[ThreeScene Setup] Camera created at:`, cameraRef.current.position);

    // 3. Renderizador
    rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current.setPixelRatio(window.devicePixelRatio);
    // Size set in handleResize
    if (!rendererRef.current.domElement.parentNode) {
        currentMount.appendChild(rendererRef.current.domElement);
    }
    console.log('[ThreeScene Setup] WebGL Renderer created and appended.');

    // 4. Luz Básica
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    sceneRef.current.add(ambientLight);
    console.log('[ThreeScene Setup] Basic ambient light added.');

    // 5. Cubo de Teste
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 }); // Green cube
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(0, 1, 0); // Position it slightly above ground
    sceneRef.current.add(cube);
    console.log('[ThreeScene Setup] Test cube added to scene.');
    
    // 6. Redimensionamento Inicial e Prontidão
    console.log(`[ThreeScene Setup] Attempting initial resize. Mount dimensions BEFORE first handleResize: ${currentMount.clientWidth}x${currentMount.clientHeight}`);
    handleResize(); // Chamada manual para garantir o tamanho inicial

    const resizeObserver = new ResizeObserver(() => {
        console.log('[ThreeScene ResizeObserver] Triggered.');
        handleResize();
    });
    resizeObserver.observe(currentMount);

    // Adiciona um pequeno atraso antes de definir a cena como pronta
    const initialSetupTimeoutId = setTimeout(() => {
      console.log(`[ThreeScene Setup] Attempting DELAYED resize. Mount dimensions BEFORE delayed handleResize: ${currentMount.clientWidth}x${currentMount.clientHeight}`);
      handleResize(); // Segunda chamada para garantir o tamanho após o layout
      setIsSceneReady(true);
      console.log('[ThreeScene Setup] Scene is now READY (after delay).');
    }, 150); // Aumentado para 150ms

    // Função de Animação Simplificada
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        // console.log('[ThreeScene Animate] Rendering frame.'); // Pode ser muito ruidoso
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    
    // Inicia a animação apenas se não estivermos prontos (para o caso de HMR)
    // Mas, para depuração, vamos iniciar após setIsSceneReady(true)
    // A chamada para animate() será movida para um useEffect dependente de isSceneReady

    return () => {
      console.log('[ThreeScene Main Setup useEffect] CLEANUP running.');
      clearTimeout(initialSetupTimeoutId);
      if (currentMount) {
        resizeObserver.unobserve(currentMount);
      }
      cancelAnimationFrame(animationFrameId); // Limpa o loop de animação se estiver rodando

      if (rendererRef.current?.domElement && rendererRef.current.domElement.parentNode === currentMount) {
        currentMount.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
      sceneRef.current?.clear(); // Limpa os filhos da cena

      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      setIsSceneReady(false);
      console.log('[ThreeScene Main Setup useEffect] CLEANUP finished.');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Array de dependências vazio para executar apenas na montagem/desmontagem


  // useEffect para iniciar o loop de animação quando a cena estiver pronta
  useEffect(() => {
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    if (isSceneReady) {
      console.log('[ThreeScene] Animation loop STARTING because isSceneReady is true.');
      animate();
    } else {
      console.log('[ThreeScene] Animation loop NOT starting because isSceneReady is false.');
    }

    return () => {
      console.log('[ThreeScene] Animation loop cleanup. Cancelling animation frame.');
      cancelAnimationFrame(animationFrameId);
    };
  }, [isSceneReady]);


  // Temporariamente comentando toda a lógica complexa
  /*
  // const createSingleEquipmentMesh = useCallback((item: Equipment): THREE.Object3D => {
  //   // console.log(`[ThreeScene createSingleEquipmentMesh] Creating mesh for ${item.tag} (Type: ${item.type}) with colorMode: ${props.colorMode}`);
  //   const finalColor = getEquipmentColor(item, props.colorMode);
  //   const material = new THREE.MeshStandardMaterial({
  //     color: finalColor,
  //     metalness: 0.3,
  //     roughness: 0.6,
  //   });

  //   if (item.operationalState === 'Não aplicável') {
  //     material.transparent = true;
  //     material.opacity = 0.5;
  //   } else {
  //     material.transparent = false;
  //     material.opacity = 1.0;
  //   }

  //   const geometry = createGeometryForItem(item);
  //   const mesh = new THREE.Mesh(geometry, material);

  //   mesh.position.set(item.position.x, item.position.y, item.position.z);
  //   if (item.rotation) {
  //     mesh.rotation.set(item.rotation.x, item.rotation.y, item.rotation.z);
  //   }
  //   mesh.userData = { tag: item.tag, type: item.type, sistema: item.sistema }; // Adicionando sistema para Focus
  //   mesh.castShadow = false;
  //   mesh.receiveShadow = false;
  //   return mesh;
  // }, [props.colorMode]);


  // useEffect para atualizar os meshes dos equipamentos na cena.
  // useEffect(() => {
  //   console.log(`[ThreeScene EquipmentUpdate useEffect] Triggered. isSceneReady: ${isSceneReady}, Equipment count: ${equipment?.length}`);
  //   if (!isSceneReady || !sceneRef.current || !equipmentMeshesRef || !groundMeshRef ) {
  //     console.log('[ThreeScene EquipmentUpdate useEffect] SKIPPING: Scene not ready or core refs not available.');
  //     return;
  //   }
  //   if (!Array.isArray(equipment)) {
  //     console.log('[ThreeScene EquipmentUpdate useEffect] SKIPPING: props.equipment is not an array.');
  //     return;
  //   }
  //   updateEquipmentMeshesInScene({
  //     scene: sceneRef.current,
  //     equipmentMeshesRef: equipmentMeshesRef,
  //     newEquipmentData: equipment,
  //     layers,
  //     colorMode,
  //     createSingleEquipmentMesh,
  //     groundMeshRef,
  //   });
  // }, [equipment, layers, colorMode, isSceneReady, createSingleEquipmentMesh, groundMeshRef]);

  // const handleClick = useCallback((event: MouseEvent) => {
  //   console.log(`[ThreeScene] handleClick triggered, button: ${event.button}`);
  //   if (!isSceneReady || !mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current) {
  //     console.log(`[ThreeScene handleClick] SKIPPING. isSceneReady: ${isSceneReady}, mount: ${!!mountRef.current}, camera: ${!!cameraRef.current}, scene: ${!!sceneRef.current}, meshes: ${!!equipmentMeshesRef.current}`);
  //     return;
  //   }
  //   if (event.button !== 0) {
  //     console.log("[ThreeScene handleClick] Non-left click, ignoring for selection.");
  //     return;
  //   }
  //   if (typeof onSelectEquipmentRef.current !== 'function') {
  //     console.error("[ThreeScene handleClick] onSelectEquipmentRef.current is not a function.");
  //     return;
  //   }
  //   processSceneClick(
  //       event,
  //       mountRef.current,
  //       cameraRef.current,
  //       equipmentMeshesRef.current,
  //       onSelectEquipmentRef.current
  //   );
  // }, [isSceneReady, onSelectEquipmentRef]);


  // const handleMouseMove = useCallback((event: MouseEvent) => {
  //   // console.log("[ThreeScene] handleMouseMove triggered");
  //   if (!isSceneReady || !mountRef.current || !cameraRef.current || !equipmentMeshesRef.current) {
  //     // console.log(`[ThreeScene handleMouseMove] SKIPPING. isSceneReady: ${isSceneReady}, mount: ${!!mountRef.current}, camera: ${!!cameraRef.current}, meshes: ${!!equipmentMeshesRef.current}`);
  //     if (typeof setHoveredEquipmentTagCallbackRef.current === 'function' && hoveredEquipmentTagRef.current !== null) {
  //       setHoveredEquipmentTagCallbackRef.current(null);
  //     }
  //     return;
  //   }
  //    if (!equipmentMeshesRef.current || equipmentMeshesRef.current.length === 0) {
  //     // console.log("[ThreeScene handleMouseMove] SKIPPING: No meshes to interact with.");
  //     if (typeof setHoveredEquipmentTagCallbackRef.current === 'function' && hoveredEquipmentTagRef.current !== null) {
  //       setHoveredEquipmentTagCallbackRef.current(null);
  //     }
  //     return;
  //   }
  //   processSceneMouseMove(
  //       event,
  //       mountRef.current,
  //       cameraRef.current,
  //       equipmentMeshesRef.current,
  //       (foundHoverTag) => {
  //         if (hoveredEquipmentTagRef.current !== foundHoverTag) {
  //           if (typeof setHoveredEquipmentTagCallbackRef.current === 'function') {
  //             setHoveredEquipmentTagCallbackRef.current(foundHoverTag);
  //           } else {
  //             // console.error('[ThreeScene] setHoveredEquipmentTagCallbackRef.current is not a function during mouse move update.');
  //           }
  //         }
  //       }
  //   );
  // }, [isSceneReady, setHoveredEquipmentTagCallbackRef, hoveredEquipmentTagRef]);


  // useEffect para gerenciar os pins de anotação
  // useEffect(() => {
  //   // console.log(`[ThreeScene Annotations useEffect] Triggered. isSceneReady: ${isSceneReady}, annotations: ${annotations?.length}`);
  //   if (!isSceneReady || !sceneRef.current || !labelRendererRef.current || !Array.isArray(annotations) || !Array.isArray(equipment)) {
  //     // console.log('[ThreeScene Annotations useEffect] SKIPPING: Core refs not ready, scene not ready, or data not valid.');
  //     return;
  //   }
  //   updateAnnotationPins({
  //     scene: sceneRef.current,
  //     labelRenderer: labelRendererRef.current,
  //     annotations: annotations,
  //     equipmentData: equipment,
  //     layers: layers,
  //     existingPinsRef: annotationPinObjectsRef,
  //   });
  // }, [annotations, layers, equipment, isSceneReady, labelRendererRef]);

  // useSceneOutline({
  //   outlinePassRef,
  //   equipmentMeshesRef,
  //   selectedEquipmentTags,
  //   hoveredEquipmentTag,
  //   isSceneReady,
  // });

  // useEffect para aplicar o estado da câmera controlado programaticamente.
  // useEffect(() => {
  //   // console.log('[ThreeScene Programmatic Camera useEffect] Target state:', programmaticCameraState);
  //   if (programmaticCameraState && cameraRef.current && controlsRef.current && isSceneReady) {
  //     const camera = cameraRef.current;
  //     const controls = controlsRef.current;

  //     const targetPosition = programmaticCameraState.position ? new THREE.Vector3(
  //       programmaticCameraState.position.x,
  //       programmaticCameraState.position.y,
  //       programmaticCameraState.position.z
  //     ) : camera.position.clone();

  //     const targetLookAt = programmaticCameraState.lookAt ? new THREE.Vector3(
  //       programmaticCameraState.lookAt.x,
  //       programmaticCameraState.lookAt.y,
  //       programmaticCameraState.lookAt.z
  //     ) : controls.target.clone();

  //     const positionChanged = !camera.position.equals(targetPosition);
  //     const lookAtChanged = !controls.target.equals(targetLookAt);

  //     if (positionChanged || lookAtChanged) {
  //       // console.log('[ThreeScene Programmatic Camera useEffect] Applying new camera state.');
  //       controls.enabled = false; // Desabilita controles para evitar conflitos durante a transição
  //       if (positionChanged) camera.position.copy(targetPosition);
  //       if (lookAtChanged) controls.target.copy(targetLookAt);
  //       controls.update();
  //       controls.enabled = true; // Reabilita controles
  //     }
  //   }
  // }, [programmaticCameraState, isSceneReady]); // Depende de isSceneReady para garantir que controlsRef.current exista


  // useEffect para focar a câmera em um sistema específico.
  // useEffect(() => {
  //   // console.log(`[ThreeScene FocusSystem useEffect] Target system: ${targetSystemToFrame}, isSceneReady: ${isSceneReady}`);
  //   if (!targetSystemToFrame || !sceneRef.current || !cameraRef.current || !controlsRef.current || !isSceneReady || equipmentMeshesRef.current.length === 0) {
  //     if (targetSystemToFrame && typeof onSystemFramed === 'function') {
  //       // console.log(`[ThreeScene FocusSystem useEffect] Conditions not met or no meshes for system ${targetSystemToFrame}, calling onSystemFramed.`);
  //       onSystemFramed();
  //     }
  //     return;
  //   }

  //   const systemMeshes = equipmentMeshesRef.current.filter(
  //     (mesh) => mesh.userData.sistema === targetSystemToFrame && mesh.visible
  //   );

  //   if (systemMeshes.length === 0) {
  //     // console.log(`[ThreeScene FocusSystem useEffect] No visible meshes found for system: ${targetSystemToFrame}`);
  //     if (typeof onSystemFramed === 'function') onSystemFramed();
  //     return;
  //   }

  //   const newView = calculateViewForMeshes(systemMeshes, cameraRef.current);

  //   if (newView && typeof onCameraChangeRef.current === 'function') {
  //     // console.log(`[ThreeScene FocusSystem useEffect] New view calculated. Position:`, newView.position, `LookAt:`, newView.lookAt);
  //     onCameraChangeRef.current({
  //       position: newView.position,
  //       lookAt: newView.lookAt,
  //     });
  //   }
  //   if (typeof onSystemFramed === 'function') onSystemFramed();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [targetSystemToFrame, isSceneReady, equipment, layers]); // equipment e layers afetam equipmentMeshesRef

  */

  return <div ref={mountRef} className="w-full h-full" />;
};

export default ThreeScene;


    