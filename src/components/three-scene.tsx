
/**
 * @fileoverview Componente React para renderizar a cena 3D usando Three.js.
 *
 * Responsabilidades Principais:
 * - Orquestrar a configuração inicial da cena 3D (câmera, luzes, renderizadores, controles),
 *   delegando partes do setup para módulos utilitários (`postprocessing-utils`, `label-renderer-utils`, `scene-elements-setup`).
 * - Gerenciar a criação, atualização e remoção dos meshes dos equipamentos com base nas props recebidas
 *   (utilizando `equipment-geometry-factory` e `color-utils`).
 * - Delegar a criação e atualização dos indicadores visuais (pins) para anotações para `label-renderer-utils`.
 * - Delegar o processamento de interações do mouse (clique para seleção, hover)
 *   para o `mouse-interaction-manager`.
 * - Aplicar atualizações de câmera programáticas (e.g., para focar em sistemas) e responder a
 *   mudanças de câmera iniciadas pelo usuário através do OrbitControls.
 * - Gerenciar o redimensionamento da cena e o loop de animação.
 * - Coordenar a aplicação do efeito de contorno (aura) para equipamentos selecionados ou sob o cursor,
 *   utilizando o `postprocessing-utils` para gerenciar os objetos e estilos do OutlinePass.
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
import { setupPostProcessing, updatePostProcessingSize, updateOutlineEffect } from '@/core/three/postprocessing-utils';
import { setupLabelRenderer, updateLabelRendererSize, updateAnnotationPins } from '@/core/three/label-renderer-utils';
import { setupLighting, setupGroundPlane } from '@/core/three/scene-elements-setup'; // Nova importação

/**
 * Props para o componente ThreeScene.
 * @interface ThreeSceneProps
 * @property {Equipment[]} equipment - Lista de equipamentos a serem renderizados (geralmente já filtrada).
 * @property {Layer[]} layers - Lista de camadas para controlar a visibilidade dos tipos de equipamento e outros elementos.
 * @property {Annotation[]} annotations - Lista de anotações a serem exibidas como pins na cena.
 * @property {string[]} selectedEquipmentTags - Array de tags dos equipamentos atualmente selecionados.
 * @property {(tag: string | null, isMultiSelect: boolean) => void} onSelectEquipment - Callback invocado quando um equipamento é clicado.
 * @property {string | null} hoveredEquipmentTag - Tag do equipamento atualmente sob o cursor.
 * @property {(tag: string | null) => void} setHoveredEquipmentTag - Callback para atualizar o estado do equipamento em hover.
 * @property {CameraState | undefined} cameraState - Estado da câmera controlado programaticamente.
 * @property {(cameraState: CameraState) => void} onCameraChange - Callback invocado quando a câmera é alterada pelo usuário.
 * @property {{ x: number; y: number; z: number }} initialCameraPosition - Posição inicial da câmera.
 * @property {{ x: number; y: number; z: number }} initialCameraLookAt - Ponto para o qual a câmera olha inicialmente.
 * @property {ColorMode} colorMode - Modo de colorização atual dos equipamentos.
 * @property {string | null} targetSystemToFrame - Nome do sistema para o qual a câmera deve focar. Null se nenhum.
 * @property {() => void} onSystemFramed - Callback chamado após a câmera terminar de focar em um sistema.
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
  // console.log(`[ThreeScene RENDER] Props: `, { selectedEquipmentTags, hoveredEquipmentTag, colorMode, targetSystemToFrame, equipmentCount: equipment?.length });

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

  const onSelectEquipmentRef = useRef(onSelectEquipment);
  const onCameraChangeRef = useRef(onCameraChange);
  const setHoveredEquipmentTagCallbackRef = useRef(setHoveredEquipmentTag);
  
  const [isSceneReady, setIsSceneReady] = useState(false);

  // Atualiza refs para callbacks para evitar que o useEffect principal dependa delas diretamente.
  useEffect(() => { onSelectEquipmentRef.current = onSelectEquipment; }, [onSelectEquipment]);
  useEffect(() => { onCameraChangeRef.current = onCameraChange; }, [onCameraChange]);
  useEffect(() => { setHoveredEquipmentTagCallbackRef.current = setHoveredEquipmentTag; }, [setHoveredEquipmentTag]);

  /**
   * Manipula o redimensionamento da janela/contêiner.
   * Atualiza as dimensões da câmera, renderizador principal, labelRenderer e composer.
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
        updateLabelRendererSize(labelRendererRef.current, width, height);
      }
      if (composerRef.current && outlinePassRef.current) {
        updatePostProcessingSize(composerRef.current, outlinePassRef.current, width, height);
      }
    }
  }, []);

  /**
   * useEffect para configuração inicial da cena Three.js.
   * Este hook é executado apenas uma vez, quando o componente é montado.
   * Responsável por criar a cena, câmera, renderizador, luzes, controles, chão,
   * EffectComposer, OutlinePass, CSS2DRenderer e anexar ouvintes de evento.
   */
  useEffect(() => {
    // console.log('[ThreeScene] Main setup useEffect RUNNING');
    if (!mountRef.current) return;
    const currentMount = mountRef.current;
    // console.log(`[ThreeScene] Mount dimensions AT START of useEffect: ${currentMount.clientWidth}x${currentMount.clientHeight}`);

    sceneRef.current = new THREE.Scene();
    sceneRef.current.background = new THREE.Color(0xA9C1D1); 
    sceneRef.current.fog = new THREE.Fog(0xA9C1D1, 40, 150);
    // console.log('[ThreeScene] Scene created');
    
    const initialWidth = Math.max(1, currentMount.clientWidth);
    const initialHeight = Math.max(1, currentMount.clientHeight);

    cameraRef.current = new THREE.PerspectiveCamera(75, initialWidth / initialHeight, 0.1, 1000);
    cameraRef.current.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);
    // console.log('[ThreeScene] Camera created at:', cameraRef.current.position.clone());
    
    rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current.setPixelRatio(window.devicePixelRatio);
    currentMount.appendChild(rendererRef.current.domElement);
    // console.log('[ThreeScene] Renderer DOM element appended.');
    
    const postProcessing = setupPostProcessing(rendererRef.current, sceneRef.current, cameraRef.current, initialWidth, initialHeight);
    composerRef.current = postProcessing.composer;
    outlinePassRef.current = postProcessing.outlinePass;
    
    labelRendererRef.current = setupLabelRenderer(currentMount, initialWidth, initialHeight);
        
    setupLighting(sceneRef.current); // Delega setup de luzes
    // console.log('[ThreeScene] Lights added.');
    
    controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
    controlsRef.current.enableDamping = true;
    controlsRef.current.target.set(initialCameraLookAt.x, initialCameraLookAt.y, initialCameraLookAt.z);
    controlsRef.current.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN
    };
    controlsRef.current.update();
    // console.log('[ThreeScene] OrbitControls created, target:', controlsRef.current.target.clone());

    groundMeshRef.current = setupGroundPlane(sceneRef.current); // Delega setup do chão
    // console.log('[ThreeScene] Ground plane added.');
    
    // console.log(`[ThreeScene] Attempting initial resize. Mount dimensions BEFORE first handleResize: ${currentMount.clientWidth}x${currentMount.clientHeight}`);
    handleResize(); 

    const delayedResizeTimeoutId = setTimeout(() => {
      // console.log(`[ThreeScene] Attempting DELAYED resize. Mount dimensions BEFORE delayed handleResize: ${currentMount.clientWidth}x${currentMount.clientHeight}`);
      handleResize();
    }, 150);

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(currentMount);

    // console.log('[ThreeScene] Adding mouse event listeners.');
    currentMount.addEventListener('click', handleClick);
    currentMount.addEventListener('mousemove', handleMouseMove);

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controlsRef.current?.update();
      composerRef.current?.render(); 
      labelRendererRef.current?.render(sceneRef.current!, cameraRef.current!);
    };
    animate();
    // console.log('[ThreeScene] Animation loop started.');
    
    const handleControlsChangeEnd = () => {
      if (cameraRef.current && controlsRef.current && onCameraChangeRef.current) {
        // console.log('[ThreeScene] OrbitControls "end" event, calling onCameraChange.');
        const newCameraState = {
          position: cameraRef.current.position.clone(),
          lookAt: controlsRef.current.target.clone(),
        };
        onCameraChangeRef.current(newCameraState);
      }
    };
    controlsRef.current?.addEventListener('end', handleControlsChangeEnd);

    setIsSceneReady(true); 
    // console.log('[ThreeScene] Scene is now READY.');
    
    return () => {
      // console.log('[ThreeScene] Cleanup: Main setup useEffect');
      setIsSceneReady(false);
      cancelAnimationFrame(animationFrameId);
      clearTimeout(delayedResizeTimeoutId);
      if (currentMount) { // Adicionado currentMount check para segurança no unmount
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
      // console.log('[ThreeScene] Main setup useEffect CLEANED UP.');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  /**
   * Cria um mesh 3D para um equipamento específico.
   * @param {Equipment} item O objeto de equipamento.
   * @returns {THREE.Object3D} O mesh 3D criado.
   */
  const createEquipmentMesh = useCallback((item: Equipment): THREE.Object3D => {
    const finalColor = getEquipmentColor(item, colorMode); // Lógica de cor já extraída
    
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

    const geometry = createGeometryForItem(item); // Lógica de geometria já extraída
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.copy(item.position as THREE.Vector3);
    if (item.rotation) {
        mesh.rotation.set(item.rotation.x, item.rotation.y, item.rotation.z);
    }
    mesh.userData = { tag: item.tag, type: item.type, sistema: item.sistema }; 
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return mesh;
  }, [colorMode]);

  /**
   * Manipula o evento de movimento do mouse na cena, delegando para `mouse-interaction-manager`.
   * @param {MouseEvent} event O evento de movimento do mouse.
   */
  const handleMouseMove = useCallback((event: MouseEvent) => {
    // console.log(`[ThreeScene] handleMouseMove triggered. isSceneReady: ${isSceneReady}`);
    if (!isSceneReady || !mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current) {
        // console.log('[ThreeScene] handleMouseMove: SKIPPING due to unready refs or scene not ready.');
        if (typeof setHoveredEquipmentTagCallbackRef.current === 'function') {
          setHoveredEquipmentTagCallbackRef.current(null);
        }
        return;
    }
     if (equipmentMeshesRef.current.length === 0 ) {
        // console.log('[ThreeScene] handleMouseMove: SKIPPING due to no equipment meshes.');
        if (typeof setHoveredEquipmentTagCallbackRef.current === 'function') {
          setHoveredEquipmentTagCallbackRef.current(null);
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
  }, [isSceneReady]); 

  /**
   * Manipula o evento de clique do mouse na cena, delegando para `mouse-interaction-manager`.
   * @param {MouseEvent} event O evento de clique do mouse.
   */
  const handleClick = useCallback((event: MouseEvent) => {
    // console.log(`[ThreeScene] handleClick triggered, button: ${event.button}, isSceneReady: ${isSceneReady}`);
    
    if (event.button !== 0) { 
        // console.log('[ThreeScene] handleClick: Non-left button click, ignoring for selection.');
        return;
    }

    if (!isSceneReady || !mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current) {
      // console.log(`[ThreeScene] handleClick: SKIPPING due to unready refs or scene not ready.`);
      return;
    }
     if (equipmentMeshesRef.current.length === 0) {
        // console.log(`[ThreeScene handleClick] SKIPPING due to no equipment meshes.`);
        if (typeof onSelectEquipmentRef.current === 'function') {
            onSelectEquipmentRef.current(null, false); 
        }
        return;
    }

    if (typeof onSelectEquipmentRef.current !== 'function') {
      // console.error('[ThreeScene] handleClick: onSelectEquipmentRef.current is not a function.');
      return;
    }
    
    // console.log(`[ThreeScene handleClick] Calling processSceneClick.`);
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
   * useEffect para atualizar os meshes dos equipamentos na cena.
   * Executado quando as props `equipment`, `layers`, `colorMode` ou o estado `isSceneReady` mudam.
   * Remove meshes antigos, atualiza materiais dos existentes e cria novos meshes.
   * Também gerencia a visibilidade do plano de chão (terreno).
   */
  useEffect(() => {
    // console.log(`[ThreeScene] Updating equipment. Data count: ${equipment?.length}, ColorMode: ${colorMode}, isSceneReady: ${isSceneReady}`);
    if (!sceneRef.current || !isSceneReady || !Array.isArray(equipment)) {
      // console.log('[ThreeScene] Updating equipment: SKIPPING - Scene not ready or equipment not an array.');
      return;
    }

    const newEquipmentPropTags = new Set(equipment.map(e => e.tag)); 

    equipmentMeshesRef.current = equipmentMeshesRef.current.filter(mesh => {
      const layer = layers.find(l => l.equipmentType === mesh.userData.type);
      const isVisibleByLayer = layer?.isVisible ?? true;
      const isStillInEquipmentProp = newEquipmentPropTags.has(mesh.userData.tag);

      if (!isVisibleByLayer || !isStillInEquipmentProp) {
        // console.log(`[ThreeScene] Removing mesh: ${mesh.userData.tag}`);
        sceneRef.current?.remove(mesh);
        if (mesh instanceof THREE.Mesh) {
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
          } else if (mesh.material instanceof THREE.Material) {
            mesh.material.dispose();
          }
        }
        return false; 
      }
      return true; 
    });
    // console.log(`[ThreeScene] Old equipment meshes removed. Remaining: ${equipmentMeshesRef.current.length}`);
    
    const newMeshesThisRun: THREE.Object3D[] = [];
    equipment.forEach(item => { 
      const layer = layers.find(l => l.equipmentType === item.type);
      const isVisibleByLayer = layer?.isVisible ?? true;
      
      if (!isVisibleByLayer) return; 

      const existingMesh = equipmentMeshesRef.current.find(mesh => mesh.userData.tag === item.tag);

      if (existingMesh) { 
        if (existingMesh instanceof THREE.Mesh && existingMesh.material instanceof THREE.MeshStandardMaterial) {
            const finalColor = getEquipmentColor(item, colorMode);
            const newOpacity = item.operationalState === 'Não aplicável' ? 0.5 : 1.0;
            const newTransparent = item.operationalState === 'Não aplicável';

            if (!existingMesh.material.color.equals(finalColor) || 
                existingMesh.material.opacity !== newOpacity ||
                existingMesh.material.transparent !== newTransparent) {
                // console.log(`[ThreeScene] Updating material for: ${item.tag} to color ${finalColor.getHexString()}`);
                existingMesh.material.color.copy(finalColor);
                existingMesh.material.opacity = newOpacity;
                existingMesh.material.transparent = newTransparent;
                existingMesh.material.needsUpdate = true;
            }
        }
         newMeshesThisRun.push(existingMesh); 
      } else { 
        // console.log(`[ThreeScene] Creating new mesh for: ${item.tag}`);
        const obj = createEquipmentMesh(item);
        sceneRef.current?.add(obj);
        newMeshesThisRun.push(obj);
      }
    });
    
    equipmentMeshesRef.current = newMeshesThisRun; 
    // console.log(`[ThreeScene] Updated equipment meshes. New count: ${equipmentMeshesRef.current.length}.`);
    
    const terrainLayer = layers.find(l => l.id === 'layer-terrain');
    if (terrainLayer && groundMeshRef.current && sceneRef.current) {
      const isGroundInScene = sceneRef.current.children.includes(groundMeshRef.current);
      if (terrainLayer.isVisible && !isGroundInScene) {
        sceneRef.current.add(groundMeshRef.current);
      } else if (!terrainLayer.isVisible && isGroundInScene) {
        sceneRef.current.remove(groundMeshRef.current);
      }
    }
  }, [equipment, layers, colorMode, isSceneReady, createEquipmentMesh]); 

  /**
   * useEffect para atualizar os pins de anotação na cena.
   * Executado quando `annotations`, `layers`, `equipment` ou `isSceneReady` mudam.
   * Utiliza `updateAnnotationPins` do `label-renderer-utils`.
   */
  useEffect(() => {
    // console.log(`[ThreeScene] Updating annotations. Count: ${annotations?.length}, isSceneReady: ${isSceneReady}`);
    if (!isSceneReady || !sceneRef.current || !labelRendererRef.current || !Array.isArray(annotations) || !Array.isArray(equipment) || !Array.isArray(layers)) {
      // console.log('[ThreeScene Annotations] Skipping update - Scene not ready or other prerequisites not met.');
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
   * useEffect para atualizar a câmera programaticamente.
   * Executado quando `programmaticCameraState` ou `isSceneReady` mudam.
   * Aplica o novo estado de câmera se houver uma mudança.
   */
  useEffect(() => {
    // console.log('[ThreeScene] Programmatic camera state changed:', programmaticCameraState);
    if (programmaticCameraState && cameraRef.current && controlsRef.current && isSceneReady) {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      const targetPosition = new THREE.Vector3().copy(programmaticCameraState.position as THREE.Vector3);
      const targetLookAt = programmaticCameraState.lookAt ? new THREE.Vector3().copy(programmaticCameraState.lookAt as THREE.Vector3) : controls.target.clone();
      
      const positionChanged = !camera.position.equals(targetPosition);
      const lookAtChanged = !controls.target.equals(targetLookAt);

      if (positionChanged || lookAtChanged) {
        // console.log('[ThreeScene] Applying programmatic camera change. Pos changed:', positionChanged, 'LookAt changed:', lookAtChanged);
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
   * Executado quando `targetSystemToFrame` ou outros estados relevantes mudam.
   * Calcula a caixa delimitadora dos equipamentos do sistema e ajusta a câmera.
   */
  useEffect(() => {
    // console.log('[ThreeScene] targetSystemToFrame changed:', targetSystemToFrame);
    if (!targetSystemToFrame || !sceneRef.current || !cameraRef.current || !controlsRef.current || !Array.isArray(equipment) || equipment.length === 0 || !isSceneReady) {
      if (targetSystemToFrame && typeof onSystemFramed === 'function') {
        // console.log('[ThreeScene] targetSystemToFrame present, but prerequisites not met. Calling onSystemFramed.');
        onSystemFramed(); 
      }
      return;
    }

    // console.log(`[ThreeScene] Focusing on system: ${targetSystemToFrame}`);
    const systemMeshes = equipmentMeshesRef.current.filter(
      (mesh) => mesh.userData.sistema === targetSystemToFrame && mesh.visible
    );

    if (systemMeshes.length === 0) {
      // console.log(`[ThreeScene] No visible meshes found for system: ${targetSystemToFrame}. Calling onSystemFramed.`);
      if (typeof onSystemFramed === 'function') onSystemFramed(); 
      return;
    }

    const totalBoundingBox = new THREE.Box3();
    systemMeshes.forEach(mesh => {
      if ((mesh as THREE.Mesh).geometry) { 
        mesh.updateMatrixWorld(true); 
        const meshBox = new THREE.Box3().setFromObject(mesh);
        totalBoundingBox.union(meshBox);
      }
    });

    if (totalBoundingBox.isEmpty()) {
      // console.log(`[ThreeScene] Bounding box for system ${targetSystemToFrame} is empty. Calling onSystemFramed.`);
      if (typeof onSystemFramed === 'function') onSystemFramed(); 
      return;
    }

    const center = new THREE.Vector3();
    totalBoundingBox.getCenter(center);
    const size = new THREE.Vector3();
    totalBoundingBox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = cameraRef.current.fov * (Math.PI / 180);
    let cameraDistance = maxDim / (2 * Math.tan(fov / 2));
    cameraDistance = cameraDistance * 1.5; 
    cameraDistance = Math.max(cameraDistance, 5); 

    const newCamPos = new THREE.Vector3(
      center.x,
      center.y + Math.max(size.y * 0.5, maxDim * 0.3), 
      center.z + cameraDistance 
    );
     if (size.y < maxDim * 0.2) { 
       newCamPos.y = center.y + cameraDistance * 0.5; 
     }
     newCamPos.y = Math.max(newCamPos.y, center.y + 2); 

    if (onCameraChangeRef.current) {
      // console.log('[ThreeScene] Calling onCameraChangeRef.current for system focus.');
      onCameraChangeRef.current({
        position: newCamPos,
        lookAt: center,
      });
    }
    if (typeof onSystemFramed === 'function') onSystemFramed(); 
  }, [targetSystemToFrame, onSystemFramed, equipment, layers, isSceneReady]); 

  /**
   * useEffect para gerenciar o OutlinePass (efeito de aura).
   * Executado quando props relevantes mudam.
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
  
  }, [selectedEquipmentTags, hoveredEquipmentTag, equipment, layers, isSceneReady]); 


  return <div ref={mountRef} className="w-full h-full" />;
};

export default ThreeScene;
