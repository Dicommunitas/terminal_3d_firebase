
/**
 * @fileoverview Component React para renderizar a cena 3D usando Three.js.
 *
 * Responsabilidades:
 * - Orquestrar a configuração da cena 3D (câmera, luzes, renderizadores, controles) utilizando módulos utilitários.
 * - Gerenciar o ciclo de vida dos meshes de equipamentos e pins de anotação com base nas props.
 * - Delegar interações do mouse (clique, hover) para o `mouse-interaction-manager`.
 * - Aplicar efeitos visuais (OutlinePass) utilizando `postprocessing-utils`.
 * - Lidar com o loop de animação e redimensionamento.
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
import { setupLighting, setupGroundPlane, setupRenderPipeline, updateEquipmentMeshesInScene } from '@/core/three/scene-elements-setup';
import { updateOutlineEffect, setupPostProcessing, updatePostProcessingSize } from '@/core/three/postprocessing-utils';
import { setupLabelRenderer, updateLabelRendererSize, updateAnnotationPins } from '@/core/three/label-renderer-utils';
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
export interface ThreeSceneProps {
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
 * Este componente é o coração da visualização 3D.
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
  cameraState: programmaticCameraState,
  onCameraChange,
  initialCameraPosition,
  initialCameraLookAt,
  colorMode,
  targetSystemToFrame,
  onSystemFramed,
}) => {
  // console.log(`[ThreeScene RENDER] Props: `, { selectedEquipmentTags, hoveredEquipmentTag, colorMode, targetSystemToFrame, equipmentCount: equipment.length });

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
  const onCameraChangeRef = useRef(onCameraChange);
  const setHoveredEquipmentTagCallbackRef = useRef(setHoveredEquipmentTag);
  const hoveredEquipmentTagRef = useRef(hoveredEquipmentTag);

  const [isSceneReady, setIsSceneReady] = useState(false);

  useEffect(() => { onSelectEquipmentRef.current = onSelectEquipment; }, [onSelectEquipment]);
  useEffect(() => { onCameraChangeRef.current = onCameraChange; }, [onCameraChange]);
  useEffect(() => { setHoveredEquipmentTagCallbackRef.current = setHoveredEquipmentTag; }, [setHoveredEquipmentTag]);
  useEffect(() => { hoveredEquipmentTagRef.current = hoveredEquipmentTag; }, [hoveredEquipmentTag]);

  /**
   * Manipula o redimensionamento da janela/contêiner.
   * Atualiza as dimensões da câmera e dos renderizadores.
   */
  const handleResize = useCallback(() => {
    if (mountRef.current && cameraRef.current && rendererRef.current && labelRendererRef.current && composerRef.current && outlinePassRef.current) {
      const width = Math.max(1, mountRef.current.clientWidth);
      const height = Math.max(1, mountRef.current.clientHeight);
      console.log(`[ThreeScene] handleResize CALLED. New dimensions: ${width}x${height}`);

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();

      updateLabelRendererSize(labelRendererRef.current, width, height);
      updatePostProcessingSize(composerRef.current, outlinePassRef.current, width, height);
      rendererRef.current.setSize(width, height);
    } else {
      console.warn('[ThreeScene] handleResize SKIPPED: One or more refs not ready for resize.');
    }
  }, []);


  /**
   * useEffect para configuração inicial da cena Three.js.
   * Este hook é executado apenas uma vez, quando o componente é montado.
   */
  useEffect(() => {
    console.log('[ThreeScene] Main setup useEffect RUNNING');
    if (!mountRef.current) {
      console.warn('[ThreeScene] Main setup useEffect SKIPPED: mountRef.current is null.');
      return;
    }
    const currentMount = mountRef.current;
    console.log(`[ThreeScene] Mount dimensions AT START of useEffect: ${currentMount.clientWidth}x${currentMount.clientHeight}`);

    sceneRef.current = new THREE.Scene();
    console.log('[ThreeScene] Scene created');

    cameraRef.current = new THREE.PerspectiveCamera(75, Math.max(1, currentMount.clientWidth) / Math.max(1, currentMount.clientHeight), 0.1, 1000);
    cameraRef.current.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);
    console.log('[ThreeScene] Camera created at:', cameraRef.current.position.clone());
    
    const pipeline = setupRenderPipeline(
      currentMount,
      sceneRef.current,
      cameraRef.current
    );
    rendererRef.current = pipeline.renderer;
    labelRendererRef.current = pipeline.labelRenderer;
    composerRef.current = pipeline.composer;
    outlinePassRef.current = pipeline.outlinePass;
    console.log('[ThreeScene] Render pipeline configured via util.');

    setupLighting(sceneRef.current);
    console.log('[ThreeScene] Lights added');
    groundMeshRef.current = setupGroundPlane(sceneRef.current);
    console.log('[ThreeScene] Ground plane added');

    import('three/examples/jsm/controls/OrbitControls.js')
      .then(module => {
        const OrbitControls = module.OrbitControls;
        if (!cameraRef.current || !rendererRef.current?.domElement || !OrbitControls || !currentMount) {
            console.error("[ThreeScene] Failed to initialize OrbitControls: Prerequisite refs not ready.");
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
        console.log('[ThreeScene] OrbitControls created, target:', controlsRef.current.target.clone());

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

        if (controlsRef.current) {
            const currentControls = controlsRef.current;
            if (!currentControls.userData) { 
                currentControls.userData = {};
            }
            currentControls.userData.cleanup = () => {
                currentControls.removeEventListener('end', handleControlsChangeEnd);
            };
        }
      })
      .catch(err => console.error("[ThreeScene] Failed to load OrbitControls", err));

    const resizeObserver = new ResizeObserver(() => {
        // console.log('[ThreeScene] ResizeObserver triggered handleResize.');
        handleResize();
    });
    resizeObserver.observe(currentMount);

    currentMount.addEventListener('click', handleClick);
    currentMount.addEventListener('mousemove', handleMouseMove);

    // Delayed initial resize and scene ready state
    const initialSetupTimeoutId = setTimeout(() => {
      console.log(`[ThreeScene] Attempting DELAYED initial resize. Mount dimensions: ${currentMount.clientWidth}x${currentMount.clientHeight}`);
      handleResize(); // Call resize one more time after a short delay
      setIsSceneReady(true);
      console.log('[ThreeScene] Scene is now READY (after delay).');
    }, 150); // 150ms delay

    console.log('[ThreeScene] Main setup useEffect ALMOST FINISHED, waiting for delayed ready state.');

    return () => {
      console.log('[ThreeScene] Main setup useEffect CLEANUP running.');
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
      setIsSceneReady(false); // Ensure scene is marked not ready on cleanup
      console.log('[ThreeScene] Main setup useEffect CLEANUP FINISHED.');
    };
  }, [initialCameraPosition, initialCameraLookAt, handleResize]); // Added handleResize to deps

  /**
   * Hook para gerenciar o loop de animação.
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
   * Cria um mesh 3D para um item de equipamento.
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
   * useEffect para atualizar os meshes dos equipamentos na cena.
   */
  useEffect(() => {
    if (!isSceneReady || !sceneRef.current) {
      return;
    }
    updateEquipmentMeshesInScene(
      sceneRef.current,
      equipmentMeshesRef, 
      equipment,          
      layers,
      createEquipmentMesh,
      groundMeshRef
    );
  }, [equipment, layers, colorMode, isSceneReady, createEquipmentMesh]);


  /**
   * Manipula eventos de movimento do mouse para hover.
   */
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isSceneReady || !mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current) {
      if (typeof setHoveredEquipmentTagCallbackRef.current === 'function' && hoveredEquipmentTagRef.current !== null) {
        setHoveredEquipmentTagCallbackRef.current(null);
      }
      return;
    }
    if (equipmentMeshesRef.current.length === 0 && typeof setHoveredEquipmentTagCallbackRef.current === 'function' && hoveredEquipmentTagRef.current !== null) {
      setHoveredEquipmentTagCallbackRef.current(null);
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
                console.error('[ThreeScene] setHoveredEquipmentTagCallbackRef.current is not a function during mouse move update.');
              }
            }
        }
    );
  }, [isSceneReady]);


  /**
   * Manipula eventos de clique do mouse para seleção.
   */
  const handleClick = useCallback((event: MouseEvent) => {
    if (event.button !== 0) { 
      return;
    }

    if (!isSceneReady || !mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current ) {
        if (typeof onSelectEquipmentRef.current === 'function' && (!equipmentMeshesRef.current || equipmentMeshesRef.current.length === 0)) {
             onSelectEquipmentRef.current(null, false);
        }
        return;
    }

    if (equipmentMeshesRef.current.length === 0 && typeof onSelectEquipmentRef.current === 'function') {
      onSelectEquipmentRef.current(null, false);
      return;
    }

    if (typeof onSelectEquipmentRef.current !== 'function') {
      console.error("[ThreeScene] handleClick: onSelectEquipmentRef.current is not a function.");
      return;
    }

    processSceneClick(
        event,
        mountRef.current,
        cameraRef.current,
        equipmentMeshesRef.current,
        onSelectEquipmentRef.current 
    );
  }, [isSceneReady]);


  /**
   * useEffect para gerenciar os pins de anotação.
   */
  useEffect(() => {
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

  /**
   * useEffect para atualizar a câmera programaticamente com base na prop `programmaticCameraState`.
   */
  useEffect(() => {
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
        const oldControlsEnabled = controls.enabled;
        controls.enabled = false; 
        if (positionChanged) camera.position.copy(targetPosition);
        if (lookAtChanged) controls.target.copy(targetLookAt);
        controls.update();
        controls.enabled = oldControlsEnabled; 
      }
    }
  }, [programmaticCameraState, isSceneReady]);

  /**
   * useEffect para focar a câmera em um sistema específico.
   */
  useEffect(() => {
    if (!targetSystemToFrame || !sceneRef.current || !cameraRef.current || !controlsRef.current || !isSceneReady || equipmentMeshesRef.current.length === 0) {
      if (targetSystemToFrame && typeof onSystemFramed === 'function') {
        onSystemFramed(); 
      }
      return;
    }

    const systemMeshes = equipmentMeshesRef.current.filter(
      (mesh) => mesh.userData.sistema === targetSystemToFrame && mesh.visible
    );

    if (systemMeshes.length === 0) {
      if (typeof onSystemFramed === 'function') onSystemFramed();
      return;
    }

    const newView = calculateViewForMeshes(systemMeshes, cameraRef.current);

    if (newView && onCameraChangeRef.current) {
      if (typeof onCameraChangeRef.current === 'function') {
        onCameraChangeRef.current({
          position: newView.position,
          lookAt: newView.lookAt,
        });
      }
    }
    if (typeof onSystemFramed === 'function') onSystemFramed();
  }, [targetSystemToFrame, isSceneReady, equipment, layers, onSystemFramed]);


  /**
   * useEffect para gerenciar o OutlinePass (efeito de aura) para seleção e hover.
   */
  useEffect(() => {
    if (!isSceneReady || !outlinePassRef.current || !equipmentMeshesRef.current) {
      // console.log('[ThreeScene OutlinePass] SKIPPING: Core refs not ready or scene not ready yet.');
      if(outlinePassRef.current) {
        updateOutlineEffect(outlinePassRef.current, [], [], null); // Clear outline if not ready
      }
      return;
    }
    
    const effectiveSelectedTags = selectedEquipmentTags ?? [];
    const effectiveHoveredTag = hoveredEquipmentTag === undefined ? null : hoveredEquipmentTag;
    
    // console.log(`[ThreeScene OutlinePass] Received Props: selectedTags=${JSON.stringify(effectiveSelectedTags)}, hoveredTag=${effectiveHoveredTag}`);
    // console.log(`[ThreeScene OutlinePass] Meshes to consider for outline: ${equipmentMeshesRef.current.map(m => m.userData.tag).join(', ')}`);

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

    