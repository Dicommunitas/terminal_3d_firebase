/**
 * @fileoverview Componente React para renderizar a cena 3D usando Three.js.
 *
 * Responsabilidades Principais:
 * - Orquestrar a configuração inicial da cena 3D (câmera, luzes, renderizadores, controles),
 *   delegando partes do setup para módulos utilitários.
 * - Gerenciar a criação, atualização e remoção dos meshes dos equipamentos e pins de anotação
 *   com base nas props recebidas, utilizando os respectivos utilitários.
 * - Delegar o processamento de interações do mouse (clique para seleção, hover).
 * - Aplicar atualizações de câmera programáticas e responder a mudanças de câmera do usuário.
 * - Gerenciar o redimensionamento da cena e o loop de animação (delegado para um hook).
 * - Coordenar a aplicação do efeito de contorno (aura) para seleção/hover.
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
import { updateOutlineEffect } from '@/core/three/postprocessing-utils';
import { updateAnnotationPins } from '@/core/three/label-renderer-utils';
import { setupLighting, setupGroundPlane, updateEquipmentMeshesInScene, setupRenderPipeline } from '@/core/three/scene-elements-setup';
import { calculateViewForMeshes } from '@/core/three/camera-utils';
import { useAnimationLoop } from '@/hooks/use-animation-loop'; // Novo hook

/**
 * Props para o componente ThreeScene.
 * @interface ThreeSceneProps
 * @property {Equipment[]} equipment - Lista de equipamentos a serem renderizados.
 * @property {Layer[]} layers - Lista de camadas para controlar a visibilidade.
 * @property {Annotation[]} annotations - Lista de anotações a serem exibidas.
 * @property {string[]} selectedEquipmentTags - Tags dos equipamentos selecionados.
 * @property {(tag: string | null, isMultiSelect: boolean) => void} onSelectEquipment - Callback para seleção.
 * @property {string | null} hoveredEquipmentTag - Tag do equipamento em hover.
 * @property {(tag: string | null) => void} setHoveredEquipmentTag - Callback para hover.
 * @property {CameraState | undefined} cameraState - Estado da câmera controlado externamente.
 * @property {(cameraState: CameraState) => void} onCameraChange - Callback para mudança de câmera.
 * @property {{ x: number; y: number; z: number }} initialCameraPosition - Posição inicial da câmera.
 * @property {{ x: number; y: number; z: number }} initialCameraLookAt - Alvo inicial da câmera.
 * @property {ColorMode} colorMode - Modo de colorização dos equipamentos.
 * @property {string | null} targetSystemToFrame - Sistema para focar a câmera.
 * @property {() => void} onSystemFramed - Callback após focar no sistema.
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
  
  const [isSceneReady, setIsSceneReady] = useState(false);

  useEffect(() => { onSelectEquipmentRef.current = onSelectEquipment; }, [onSelectEquipment]);
  useEffect(() => { onCameraChangeRef.current = onCameraChange; }, [onCameraChange]);
  useEffect(() => { setHoveredEquipmentTagCallbackRef.current = setHoveredEquipmentTag; }, [setHoveredEquipmentTag]);

  /**
   * Manipula o redimensionamento da janela/contêiner.
   */
  const handleResize = useCallback(() => {
    if (mountRef.current && cameraRef.current && rendererRef.current && labelRendererRef.current && composerRef.current) {
      const width = Math.max(1, mountRef.current.clientWidth);
      const height = Math.max(1, mountRef.current.clientHeight);

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      
      rendererRef.current.setSize(width, height);
      labelRendererRef.current.setSize(width, height);
      composerRef.current.setSize(width, height);
      if(outlinePassRef.current) { // OutlinePass pode não estar pronto imediatamente
         outlinePassRef.current.resolution.set(width, height);
      }
    }
  }, []);

  /**
   * useEffect para configuração inicial da cena Three.js.
   * Este hook é executado apenas uma vez, quando o componente é montado.
   */
  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;

    let OrbitControls: typeof OrbitControlsType | null = null;

    // Importação dinâmica de OrbitControls
    import('three/examples/jsm/controls/OrbitControls.js')
      .then(module => {
        OrbitControls = module.OrbitControls;

        if (!mountRef.current || !OrbitControls) return; // Checagem adicional

        sceneRef.current = new THREE.Scene();
        cameraRef.current = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
        cameraRef.current.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);
        
        const { renderer, labelRenderer, composer, outlinePass } = setupRenderPipeline(
          currentMount,
          sceneRef.current,
          cameraRef.current,
          currentMount.clientWidth,
          currentMount.clientHeight
        );
        rendererRef.current = renderer;
        labelRendererRef.current = labelRenderer;
        composerRef.current = composer;
        outlinePassRef.current = outlinePass;
              
        setupLighting(sceneRef.current);
        
        controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
        controlsRef.current.enableDamping = true;
        controlsRef.current.target.set(initialCameraLookAt.x, initialCameraLookAt.y, initialCameraLookAt.z);
        controlsRef.current.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN
        };
        controlsRef.current.update();

        groundMeshRef.current = setupGroundPlane(sceneRef.current);
        
        handleResize(); 

        const delayedResizeTimeoutId = setTimeout(() => {
          handleResize();
        }, 150);

        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(currentMount);

        currentMount.addEventListener('click', handleClick);
        currentMount.addEventListener('mousemove', handleMouseMove);
        
        const handleControlsChangeEnd = () => {
          if (cameraRef.current && controlsRef.current && onCameraChangeRef.current) {
            const newCameraState = {
              position: cameraRef.current.position.clone(),
              lookAt: controlsRef.current.target.clone(),
            };
            onCameraChangeRef.current(newCameraState);
          }
        };
        controlsRef.current?.addEventListener('end', handleControlsChangeEnd);

        setIsSceneReady(true); 
        
        // Cleanup
        return () => {
          setIsSceneReady(false);
          clearTimeout(delayedResizeTimeoutId);
          if (currentMount) { // currentMount pode ser null se o componente for desmontado rapidamente
            resizeObserver.unobserve(currentMount);
            currentMount.removeEventListener('click', handleClick);
            currentMount.removeEventListener('mousemove', handleMouseMove);
          }
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
          
          if (rendererRef.current?.domElement && rendererRef.current.domElement.parentNode === currentMount) {
            currentMount.removeChild(rendererRef.current.domElement);
          }
          rendererRef.current?.dispose();

          if (labelRendererRef.current?.domElement && labelRendererRef.current.domElement.parentNode === currentMount) {
            currentMount.removeChild(labelRendererRef.current.domElement);
          }
        };
      })
      .catch(err => console.error("Failed to load OrbitControls", err));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCameraPosition, initialCameraLookAt]); // Dependências mínimas para setup inicial

  // Utiliza o hook customizado para o loop de animação
  useAnimationLoop({
    isSceneReady,
    sceneRef,
    cameraRef,
    controlsRef,
    composerRef,
    labelRendererRef,
  });

  /**
   * Cria um mesh 3D para um equipamento específico.
   * @param {Equipment} item O objeto de equipamento.
   * @param {ColorMode} currentCM O modo de cor atual.
   * @returns {THREE.Object3D} O mesh 3D criado.
   */
  const createEquipmentMesh = useCallback((item: Equipment, currentCM: ColorMode): THREE.Object3D => {
    const finalColor = getEquipmentColor(item, currentCM); // Usa currentCM em vez de colorMode da prop
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

    mesh.position.copy(item.position as THREE.Vector3);
    if (item.rotation) {
        mesh.rotation.set(item.rotation.x, item.rotation.y, item.rotation.z);
    }
    mesh.userData = { tag: item.tag, type: item.type, sistema: item.sistema }; 
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return mesh;
  }, []); // colorMode foi removido das dependências, pois é passado como argumento


  /**
   * Manipula o evento de movimento do mouse na cena, delegando para `mouse-interaction-manager`.
   */
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isSceneReady || !mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current) {
      if (typeof setHoveredEquipmentTagCallbackRef.current === 'function') {
        setHoveredEquipmentTagCallbackRef.current(null);
      }
      return;
    }
    if (equipmentMeshesRef.current.length === 0 ) {
      if (typeof setHoveredEquipmentTagCallbackRef.current === 'function') {
        setHoveredEquipmentTagCallbackRef.current(null);
      }
      return;
    }
    if (typeof setHoveredEquipmentTagCallbackRef.current !== 'function') return;

    processSceneMouseMove(
        event,
        mountRef.current,
        cameraRef.current,
        equipmentMeshesRef.current,
        setHoveredEquipmentTagCallbackRef.current 
    );
  }, [isSceneReady]); 

  /**
   * Manipula o evento de clique do mouse na cena, delegando para `mouse-interaction-manager`.
   */
  const handleClick = useCallback((event: MouseEvent) => {
    if (event.button !== 0) return;
    if (!isSceneReady || !mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current || equipmentMeshesRef.current.length === 0) {
        // Log se alguma das refs não estiver pronta ou não houver meshes
        // console.log('[ThreeScene] handleClick: SKIPPING due to unready refs or no meshes.', { isSceneReady, camera: !!cameraRef.current, scene: !!sceneRef.current, meshes: equipmentMeshesRef.current?.length });
        if (typeof onSelectEquipmentRef.current === 'function' && equipmentMeshesRef.current?.length === 0) {
            onSelectEquipmentRef.current(null, false); 
        }
        return;
    }
    if (typeof onSelectEquipmentRef.current !== 'function') return;
    
    processSceneClick(
        event,
        mountRef.current,
        cameraRef.current,
        equipmentMeshesRef.current,
        onSelectEquipmentRef.current 
    );
  }, [isSceneReady]); 

  /**
   * useEffect para atualizar os meshes dos equipamentos na cena.
   * Utiliza a função `updateEquipmentMeshesInScene` para gerenciar os meshes.
   */
  useEffect(() => {
    if (!sceneRef.current || !isSceneReady || !Array.isArray(equipment)) {
      return;
    }
    // Passa colorMode diretamente para createEquipmentMesh, que é então passado para updateEquipmentMeshesInScene
    const boundCreateMesh = (item: Equipment) => createEquipmentMesh(item, colorMode);

    updateEquipmentMeshesInScene(
      sceneRef.current,
      equipmentMeshesRef,
      equipment,
      layers,
      colorMode, // Passado para a função externa, mas createEquipmentMesh usará seu próprio argumento
      boundCreateMesh,
      groundMeshRef
    );
  }, [equipment, layers, colorMode, isSceneReady, createEquipmentMesh]);

  /**
   * useEffect para atualizar os pins de anotação na cena.
   */
  useEffect(() => {
    if (!isSceneReady || !sceneRef.current || !labelRendererRef.current || !Array.isArray(annotations) || !Array.isArray(equipment) || !Array.isArray(layers)) {
      return;
    }
    updateAnnotationPins({
      scene: sceneRef.current,
      labelRenderer: labelRendererRef.current,
      annotations, 
      equipmentData: equipment, 
      layers, 
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
      const targetPosition = new THREE.Vector3().copy(programmaticCameraState.position as THREE.Vector3);
      const targetLookAt = programmaticCameraState.lookAt ? new THREE.Vector3().copy(programmaticCameraState.lookAt as THREE.Vector3) : controls.target.clone();
      
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
   * Delega o cálculo da visão para `camera-utils`.
   */
  useEffect(() => {
    if (!targetSystemToFrame || !sceneRef.current || !cameraRef.current || !controlsRef.current || !Array.isArray(equipment) || equipment.length === 0 || !isSceneReady) {
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
      onCameraChangeRef.current({
        position: newView.position,
        lookAt: newView.lookAt,
      });
    }
    if (typeof onSystemFramed === 'function') onSystemFramed(); 
  }, [targetSystemToFrame, onSystemFramed, equipment, layers, isSceneReady]); 

  /**
   * useEffect para gerenciar o OutlinePass (efeito de aura) para seleção e hover.
   * Delega a lógica de atualização para `updateOutlineEffect`.
   */
  useEffect(() => {
    // console.log('[ThreeScene OutlinePass] useEffect triggered. isSceneReady:', isSceneReady, 'OutlinePass ready:', !!outlinePassRef.current, 'Meshes ready:', !!equipmentMeshesRef.current);
    if (!isSceneReady || !outlinePassRef.current || !equipmentMeshesRef.current) {
        // console.log('[ThreeScene OutlinePass] SKIPPING: Core refs not ready or scene not ready yet.');
      if(outlinePassRef.current) { // Se o outlinePass existe mas o resto não, limpa o outline
        updateOutlineEffect(outlinePassRef.current, [], [], null);
      }
      return;
    }
    
    const effectiveSelectedTags = selectedEquipmentTags ?? [];
    const effectiveHoveredTag = hoveredEquipmentTag === undefined ? null : hoveredEquipmentTag;

    // console.log(`[ThreeScene OutlinePass] Received Props: selectedTags=${JSON.stringify(selectedEquipmentTags)}, hoveredTag=${hoveredEquipmentTag}`);
    // console.log(`[ThreeScene OutlinePass] Effective Values: selected=${JSON.stringify(effectiveSelectedTags)}, hovered=${effectiveHoveredTag}`);
    // console.log(`[ThreeScene OutlinePass] equipmentMeshesRef.current tags: ${equipmentMeshesRef.current.map(m => m.userData.tag).join(', ')}`);
    
    updateOutlineEffect(
      outlinePassRef.current,
      equipmentMeshesRef.current, // Passa a referência atual dos meshes
      effectiveSelectedTags,
      effectiveHoveredTag
    );
  
  }, [selectedEquipmentTags, hoveredEquipmentTag, equipment, layers, isSceneReady]); // Adicionado equipment e layers como dependências, pois afetam equipmentMeshesRef


  return <div ref={mountRef} className="w-full h-full" />;
};

export default ThreeScene;
