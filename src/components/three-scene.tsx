
/**
 * @fileoverview Componente React para renderizar a cena 3D usando Three.js.
 *
 * Responsabilidades Principais:
 * - Orquestrar a configuração inicial da cena 3D (câmera, luzes, renderizador principal, controles),
 *   delegando partes do setup para módulos utilitários.
 * - Utilizar utilitários para configurar o pipeline de pós-processamento (EffectComposer, OutlinePass)
 *   e o renderizador de rótulos 2D (CSS2DRenderer para anotações).
 * - Gerenciar a criação, atualização e remoção dos meshes dos equipamentos com base nas props recebidas
 *   (utilizando `equipment-geometry-factory` e `color-utils`).
 * - Gerenciar a criação e atualização dos indicadores visuais (pins) para anotações.
 * - Delegar o processamento de interações do mouse (clique para seleção, movimento para hover)
 *   para o `mouse-interaction-manager`.
 * - Aplicar atualizações de câmera programáticas (e.g., para focar em sistemas) e responder a
 *   mudanças de câmera iniciadas pelo usuário através do OrbitControls.
 * - Gerenciar o redimensionamento da cena e o loop de animação.
 * - Aplicar o efeito de contorno (aura) para equipamentos selecionados ou sob o cursor,
 *   utilizando o `postprocessing-utils` para gerenciar os estilos do OutlinePass.
 */
"use client";

import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import type { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';

import type { Equipment, Layer, CameraState, Annotation, ColorMode } from '@/lib/types';
import { getEquipmentColor } from '@/core/graphics/color-utils';
import { processSceneClick, processSceneMouseMove } from '@/core/three/mouse-interaction-manager';
import { createGeometryForItem } from '@/core/three/equipment-geometry-factory';
import { setupPostProcessing, updatePostProcessingSize, applyOutlinePassStyle, setOutlinePassObjects } from '@/core/three/postprocessing-utils';
import { setupLabelRenderer, updateLabelRendererSize } from '@/core/three/label-renderer-utils';

/**
 * Props para o componente ThreeScene.
 * @interface ThreeSceneProps
 * @property {Equipment[]} equipment - Lista de equipamentos a serem renderizados.
 * @property {Layer[]} layers - Lista de camadas para controlar a visibilidade dos tipos de equipamento e outros elementos (anotações, terreno).
 * @property {Annotation[]} annotations - Lista de anotações a serem exibidas como pins na cena.
 * @property {string[]} selectedEquipmentTags - Array de tags dos equipamentos atualmente selecionados, para aplicar a aura de seleção.
 * @property {(tag: string | null, isMultiSelect: boolean) => void} onSelectEquipment - Callback invocado quando um equipamento é clicado.
 * @property {string | null} hoveredEquipmentTag - Tag do equipamento atualmente sob o cursor, para aplicar a aura de hover.
 * @property {(tag: string | null) => void} setHoveredEquipmentTag - Callback para atualizar o estado do equipamento em hover no componente pai.
 * @property {CameraState | undefined} cameraState - Estado da câmera (posição, lookAt) controlado programaticamente pelo componente pai.
 * @property {(cameraState: CameraState) => void} onCameraChange - Callback invocado quando a câmera é alterada pelo usuário (e.g., via OrbitControls).
 * @property {{ x: number; y: number; z: number }} initialCameraPosition - Posição inicial da câmera no carregamento da cena.
 * @property {{ x: number; y: number; z: number }} initialCameraLookAt - Ponto para o qual a câmera olha inicialmente.
 * @property {ColorMode} colorMode - Modo de colorização atual dos equipamentos.
 * @property {string | null} targetSystemToFrame - Nome do sistema para o qual a câmera deve focar.
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
  // Ref para armazenar a função setHoveredEquipmentTag, permitindo que o callback handleMouseMove
  // (que é memoizado com array de dependências vazio) sempre acesse a versão mais recente da função.
  const setHoveredEquipmentTagCallbackRef = useRef(setHoveredEquipmentTag);
  // Ref para armazenar o valor atual de hoveredEquipmentTag, usado para comparação dentro de handleMouseMove.
  const hoveredEquipmentTagRef = useRef(hoveredEquipmentTag); 

  const [isSceneReady, setIsSceneReady] = useState(false);

  // Atualiza os refs para os callbacks se as props mudarem.
  // Isso é crucial para que os manipuladores de eventos que são memoizados com `useCallback`
  // (e dependências vazias) possam chamar a versão mais recente das funções de callback.
  useEffect(() => { onSelectEquipmentRef.current = onSelectEquipment; }, [onSelectEquipment]);
  useEffect(() => { onCameraChangeRef.current = onCameraChange; }, [onCameraChange]);
  useEffect(() => { 
    setHoveredEquipmentTagCallbackRef.current = setHoveredEquipmentTag; 
  }, [setHoveredEquipmentTag]);
  useEffect(() => { 
    hoveredEquipmentTagRef.current = hoveredEquipmentTag;
  }, [hoveredEquipmentTag]);

  /**
   * Manipula o redimensionamento da janela/contêiner.
   * Atualiza as dimensões da câmera, renderizador principal, labelRenderer e composer.
   * Usado como callback para o ResizeObserver e chamado no setup inicial.
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
   * Cria um mesh 3D para um equipamento específico.
   * Utiliza `createGeometryForItem` para a geometria e `getEquipmentColor` para a cor.
   * Define a posição, rotação, userData (com a tag), e propriedades de sombra.
   * A cor é determinada pelo `colorMode` e `operationalState`.
   * Equipamentos com `operationalState === 'Não aplicável'` são renderizados com transparência.
   * @param {Equipment} item O objeto de equipamento a ser transformado em mesh.
   * @returns {THREE.Object3D} O mesh 3D criado.
   */
  const createEquipmentMesh = useCallback((item: Equipment): THREE.Object3D => {
    const baseColorFromUtil = getEquipmentColor(item, colorMode);
    let stateColor = new THREE.Color();

    // Aplica cores específicas para estados operacionais se o modo de cor não for 'Produto' ou 'Equipamento'
    // que já são tratados pelo getEquipmentColor.
    // A principal mudança de cor com base no estado já acontece em getEquipmentColor.
    // Aqui, nos certificamos apenas do estado de transparência.
    if (colorMode === 'Estado Operacional') {
      switch (item.operationalState) {
        case 'operando':       stateColor.setHex(0xFF0000); break; // Vermelho
        case 'não operando': stateColor.setHex(0x00FF00); break; // Verde
        case 'manutenção':   stateColor.setHex(0xFFFF00); break; // Amarelo
        case 'em falha':       stateColor.setHex(0xDA70D6); break; // Roxo Orchid
        case 'Não aplicável':
        default:
          stateColor.copy(baseColorFromUtil); // Usa a cor base se não houver mapeamento de estado
          break;
      }
    } else {
      stateColor.copy(baseColorFromUtil);
    }
    // console.log(`[ThreeScene createEquipmentMesh] Item: ${item.tag}, Type: ${item.type}, OpState: ${item.operationalState}, Prod: ${item.product}, ColorMode: ${colorMode}, BaseColorFromUtil: #${baseColorFromUtil.getHexString()}, FinalStateColor: #${stateColor.getHexString()}`);
    
    const material = new THREE.MeshStandardMaterial({
        color: stateColor,
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
    mesh.castShadow = false; // Sombras desabilitadas conforme solicitado
    mesh.receiveShadow = false; // Sombras desabilitadas
    return mesh;
  }, [colorMode]);

  /**
   * useEffect para configuração inicial da cena Three.js.
   * É executado apenas uma vez na montagem do componente (array de dependências vazio).
   * Configura a cena, câmera, renderizador, luzes, controles, plano de chão,
   * pipeline de pós-processamento (OutlinePass), renderizador de rótulos 2D,
   * e anexa os ouvintes de evento.
   */
  useEffect(() => {
    // console.log('[ThreeScene] Main setup useEffect RUNNING');
    if (!mountRef.current) {
        // console.log('[ThreeScene] Main setup: mountRef.current is not available. Bailing out.');
        return;
    }
    const currentMount = mountRef.current;
    // console.log(`[ThreeScene] Mount dimensions AT START of useEffect: ${currentMount.clientWidth}x${currentMount.clientHeight}`);

    sceneRef.current = new THREE.Scene();
    sceneRef.current.background = new THREE.Color(0xA9C1D1); // Cor de fundo tipo céu/atmosfera
    sceneRef.current.fog = new THREE.Fog(0xA9C1D1, 40, 150); // Névoa correspondente
    
    const initialWidth = Math.max(1, currentMount.clientWidth);
    const initialHeight = Math.max(1, currentMount.clientHeight);

    cameraRef.current = new THREE.PerspectiveCamera(75, initialWidth / initialHeight, 0.1, 1000);
    cameraRef.current.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);
    // console.log('[ThreeScene] Camera created at:', cameraRef.current.position.clone());
    
    rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current.setPixelRatio(window.devicePixelRatio);
    currentMount.appendChild(rendererRef.current.domElement);
    // console.log('[ThreeScene] Renderer DOM element appended.');
    
    // Configura pós-processamento usando o utilitário
    const postProcessing = setupPostProcessing(rendererRef.current, sceneRef.current, cameraRef.current, initialWidth, initialHeight);
    composerRef.current = postProcessing.composer;
    outlinePassRef.current = postProcessing.outlinePass;
    // console.log('[ThreeScene] PostProcessing setup complete.');
    
    // Configura renderizador de rótulos usando o utilitário
    labelRendererRef.current = setupLabelRenderer(currentMount, initialWidth, initialHeight);
    // console.log('[ThreeScene] LabelRenderer setup complete.');
        
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0); 
    sceneRef.current.add(ambientLight);

    const hemisphereLight = new THREE.HemisphereLight(0xADD8E6, 0x495436, 0.8); // Sky color, ground color, intensity
    sceneRef.current.add(hemisphereLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 3.0);
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = false; // Sombras desabilitadas
    sceneRef.current.add(directionalLight);
    // console.log('[ThreeScene] Lights added.');
    
    controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
    controlsRef.current.enableDamping = true;
    controlsRef.current.target.set(initialCameraLookAt.x, initialCameraLookAt.y, initialCameraLookAt.z);
    controlsRef.current.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY, // Padrão para zoom com o botão do meio
      RIGHT: THREE.MOUSE.PAN
    };
    controlsRef.current.update();
    // console.log('[ThreeScene] OrbitControls created, target:', controlsRef.current.target.clone());

    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0xE6D8B0, // Cor de areia pastel suave
      side: THREE.DoubleSide,
      metalness: 0.1,
      roughness: 0.8,
      transparent: true,
      opacity: 0.4, 
    });
    groundMeshRef.current = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMeshRef.current.rotation.x = -Math.PI / 2;
    groundMeshRef.current.position.y = 0; // Ajuste se necessário para o nível do chão
    groundMeshRef.current.receiveShadow = false; // Sombras desabilitadas
    sceneRef.current.add(groundMeshRef.current);
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
      // Renderiza a cena usando o composer (que inclui o OutlinePass)
      composerRef.current?.render(); 
      // Renderiza os rótulos 2D separadamente
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
      resizeObserver.unobserve(currentMount);
      currentMount.removeEventListener('click', handleClick);
      currentMount.removeEventListener('mousemove', handleMouseMove);
      controlsRef.current?.removeEventListener('end', handleControlsChangeEnd);
      controlsRef.current?.dispose();

      // Limpeza de meshes
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

      // Limpeza de anotações
      annotationPinObjectsRef.current.forEach(annoObj => {
        sceneRef.current?.remove(annoObj);
        if (annoObj.element.parentNode) {
          annoObj.element.parentNode.removeChild(annoObj.element);
        }
      });
      annotationPinObjectsRef.current = [];
      
      // Limpeza do chão
      if (sceneRef.current && groundMeshRef.current) {
        sceneRef.current.remove(groundMeshRef.current);
        groundMeshRef.current.geometry?.dispose();
        if (groundMeshRef.current.material instanceof THREE.Material) {
           groundMeshRef.current.material.dispose();
        }
      }
      
      // Limpeza do composer e passes
      composerRef.current?.passes.forEach(pass => { if ((pass as any).dispose) (pass as any).dispose(); });
      
      // Limpeza do renderizador e labelRenderer
      if (rendererRef.current?.domElement?.parentNode === currentMount) {
        currentMount.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();

      if (labelRendererRef.current?.domElement?.parentNode === currentMount) {
        currentMount.removeChild(labelRendererRef.current.domElement);
      }
      // console.log('[ThreeScene] Main setup useEffect CLEANED UP.');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Array de dependências vazio para garantir execução única na montagem

  /**
   * Manipula o evento de movimento do mouse na cena.
   * Delega para `processSceneMouseMove` para detectar equipamento em hover.
   * @param {MouseEvent} event O evento de movimento do mouse.
   */
  const handleMouseMove = useCallback((event: MouseEvent) => {
    // console.log(`[ThreeScene] handleMouseMove triggered. isSceneReady: ${isSceneReady}`);
    if (!isSceneReady || !mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current) {
        // console.log('[ThreeScene] handleMouseMove: SKIPPING due to unready refs or scene not ready.');
        // Limpa o hover se a cena não estiver pronta para evitar estado obsoleto
        if (hoveredEquipmentTagRef.current !== null) {
          if (typeof setHoveredEquipmentTagCallbackRef.current === 'function') {
            setHoveredEquipmentTagCallbackRef.current(null);
          } else {
            // console.error('[ThreeScene] setHoveredEquipmentTagCallbackRef.current is not a function (core refs missing).');
          }
        }
        return;
    }
     if (equipmentMeshesRef.current.length === 0 && hoveredEquipmentTagRef.current !== null) {
        // console.log('[ThreeScene] handleMouseMove: SKIPPING due to no equipment meshes.');
        if (typeof setHoveredEquipmentTagCallbackRef.current === 'function') {
            setHoveredEquipmentTagCallbackRef.current(null);
        } else {
            // console.error('[ThreeScene] setHoveredEquipmentTagCallbackRef.current is not a function (no meshes).');
        }
        return;
    }
    
    processSceneMouseMove(
        event,
        mountRef.current,
        cameraRef.current,
        equipmentMeshesRef.current,
        (tag) => { 
          if (hoveredEquipmentTagRef.current !== tag) { 
            if (typeof setHoveredEquipmentTagCallbackRef.current === 'function') {
                // console.log(`[ThreeScene] Calling setHoveredEquipmentTagCallbackRef.current with: ${tag}`);
                setHoveredEquipmentTagCallbackRef.current(tag);
            } else {
                // console.error('[ThreeScene] setHoveredEquipmentTagCallbackRef.current is not a function in processSceneMouseMove wrapper.');
            }
          }
        }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSceneReady]); 

  /**
   * Manipula o evento de clique do mouse na cena.
   * Delega para `processSceneClick` para detectar seleção de equipamento.
   * Garante que apenas cliques esquerdos sejam processados para seleção.
   * @param {MouseEvent} event O evento de clique do mouse.
   */
  const handleClick = useCallback((event: MouseEvent) => {
    // console.log(`[ThreeScene] handleClick triggered, button: ${event.button}, isSceneReady: ${isSceneReady}`);
    
    if (event.button !== 0) { // Processa apenas cliques esquerdos para seleção
        // console.log('[ThreeScene] handleClick: Non-left button click, ignoring for selection.');
        return;
    }

    if (!isSceneReady || !mountRef.current || !cameraRef.current || !sceneRef.current || !equipmentMeshesRef.current) {
      // console.log(`[ThreeScene] handleClick: SKIPPING due to unready refs, no meshes or scene not ready.`);
      return;
    }
     if (equipmentMeshesRef.current.length === 0) {
        // console.log(`[ThreeScene] handleClick: SKIPPING due to no equipment meshes.`);
        if (typeof onSelectEquipmentRef.current === 'function') {
            onSelectEquipmentRef.current(null, false); // Limpa a seleção se não houver meshes
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
   * É executado quando `equipment`, `layers`, `colorMode` ou `isSceneReady` mudam.
   * Remove meshes antigos, atualiza materiais de meshes existentes ou cria novos meshes.
   * Também controla a visibilidade do plano de chão.
   */
  useEffect(() => {
    // console.log(`[ThreeScene] Updating equipment. Data count: ${equipment?.length}, ColorMode: ${colorMode}, isSceneReady: ${isSceneReady}`);
    if (!sceneRef.current || !isSceneReady || !Array.isArray(equipment)) {
      // console.log('[ThreeScene] Updating equipment: SKIPPING - Scene not ready or equipment not an array.');
      return;
    }

    const newEquipmentPropTags = new Set(equipment.map(e => e.tag)); 

    // Remove meshes que não estão mais em `equipment` ou cuja camada está invisível
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
        // Atualiza o material do mesh existente se a cor ou transparência mudou
        if (existingMesh instanceof THREE.Mesh && existingMesh.material instanceof THREE.MeshStandardMaterial) {
            let newColor = getEquipmentColor(item, colorMode);
            if (colorMode === 'Estado Operacional') { // Re-aplicar cores de estado se necessário
                switch (item.operationalState) {
                    case 'operando':       newColor = new THREE.Color(0xFF0000); break;
                    case 'não operando': newColor = new THREE.Color(0x00FF00); break;
                    case 'manutenção':   newColor = new THREE.Color(0xFFFF00); break;
                    case 'em falha':       newColor = new THREE.Color(0xDA70D6); break;
                    case 'Não aplicável':
                    default: break; // getEquipmentColor já deve ter retornado item.color
                }
            }
            const newOpacity = item.operationalState === 'Não aplicável' ? 0.5 : 1.0;
            const newTransparent = item.operationalState === 'Não aplicável';

            if (!existingMesh.material.color.equals(newColor) || 
                existingMesh.material.opacity !== newOpacity ||
                existingMesh.material.transparent !== newTransparent) {
                // console.log(`[ThreeScene] Updating material for: ${item.tag} to color ${newColor.getHexString()}`);
                existingMesh.material.color.copy(newColor);
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
    
    // Gerencia a visibilidade do terreno
    const terrainLayer = layers.find(l => l.equipmentType === 'Terrain');
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
   * É executado quando `annotations`, `layers`, `equipment` ou `isSceneReady` mudam.
   * Remove pins antigos e cria novos com base nos dados atuais e na visibilidade da camada de anotações.
   */
  useEffect(() => {
    // console.log(`[ThreeScene] Updating annotations. Count: ${annotations?.length}, isSceneReady: ${isSceneReady}`);
    if (!sceneRef.current || !labelRendererRef.current || !isSceneReady || !Array.isArray(annotations) || !Array.isArray(equipment)) {
      // console.log('[ThreeScene] Updating annotations: SKIPPING - Prerequisites not met.');
      return;
    }

    // Remove pins de anotação antigos
    annotationPinObjectsRef.current.forEach(obj => {
      sceneRef.current?.remove(obj); 
      if (obj.element.parentNode) { 
        obj.element.parentNode.removeChild(obj.element);
      }
    });
    annotationPinObjectsRef.current = [];

    const annotationsLayer = layers.find(l => l.equipmentType === 'Annotations');
    const areAnnotationsVisible = annotationsLayer?.isVisible ?? true;

    // Controla a visibilidade do contêiner do renderizador de rótulos
    if (labelRendererRef.current.domElement) {
      labelRendererRef.current.domElement.style.display = areAnnotationsVisible ? '' : 'none';
    }

    if (areAnnotationsVisible) {
      annotations.forEach(anno => {
        const equipmentForItem = equipment.find(e => e.tag === anno.equipmentTag);
        if (equipmentForItem) {
            const pinDiv = document.createElement('div');
            // Usando fill direto no SVG para garantir a cor amarela
            pinDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#FFD700" style="opacity: 0.9; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5));"><path d="M12 2C8.13 2 5 5.13 5 9c0 4.17 4.42 9.92 6.24 12.11.4.48 1.13.48 1.53 0C14.58 18.92 19 13.17 19 9c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>`;
            pinDiv.style.pointerEvents = 'none'; 
            pinDiv.style.width = '24px';
            pinDiv.style.height = '24px';
            
            const pinLabel = new CSS2DObject(pinDiv);
            
            let yOffset = 0;
            const defaultSize = { width: 1, height: 1, depth: 1 }; 
            const itemSize = equipmentForItem.size || defaultSize;
            const itemHeight = equipmentForItem.height || itemSize.height;

            // Ajuste do offset Y para o pin com base no tipo/tamanho do equipamento
            if (equipmentForItem.type === 'Tank' || equipmentForItem.type === 'Pipe') {
                yOffset = (itemHeight) / 2 + 0.8; // Para cilindros, acima do topo
            } else if (itemSize.height) { // Para caixas
                yOffset = itemSize.height / 2 + 0.8; // Acima do topo
            } else { // Para esferas (válvulas) ou padrão
                 yOffset = (equipmentForItem.radius || 0.3) + 0.8; // Acima do topo da esfera
            }
            pinLabel.position.set(equipmentForItem.position.x, equipmentForItem.position.y + yOffset, equipmentForItem.position.z);
            
            sceneRef.current?.add(pinLabel);
            annotationPinObjectsRef.current.push(pinLabel);
        }
      });
    }
  }, [annotations, layers, equipment, isSceneReady]);

  /**
   * useEffect para atualizar a câmera programaticamente (e.g., via presets ou "Focus on System").
   * É executado quando `programmaticCameraState` ou `isSceneReady` mudam.
   */
  useEffect(() => {
    // console.log('[ThreeScene] Programmatic camera state changed:', programmaticCameraState);
    if (programmaticCameraState && cameraRef.current && controlsRef.current && isSceneReady) {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      // Clona para evitar modificação direta do objeto de estado
      const targetPosition = new THREE.Vector3().copy(programmaticCameraState.position as THREE.Vector3);
      const targetLookAt = programmaticCameraState.lookAt ? new THREE.Vector3().copy(programmaticCameraState.lookAt as THREE.Vector3) : controls.target.clone();
      
      const positionChanged = !camera.position.equals(targetPosition);
      const lookAtChanged = !controls.target.equals(targetLookAt);

      if (positionChanged || lookAtChanged) {
        // console.log('[ThreeScene] Applying programmatic camera change. Pos changed:', positionChanged, 'LookAt changed:', lookAtChanged);
        const oldControlsEnabled = controls.enabled;
        controls.enabled = false; // Desabilita controles durante a mudança programática
        if (positionChanged) camera.position.copy(targetPosition);
        if (lookAtChanged) controls.target.copy(targetLookAt);
        controls.update(); // Força a atualização dos controles com a nova posição/alvo
        controls.enabled = oldControlsEnabled; // Reabilita controles
      }
    }
  }, [programmaticCameraState, isSceneReady]);

  /**
   * useEffect para focar a câmera em um sistema específico.
   * É executado quando `targetSystemToFrame`, `equipment`, `layers` ou `isSceneReady` mudam.
   * Calcula a caixa delimitadora dos equipamentos do sistema alvo e ajusta a câmera para enquadrá-los.
   */
  useEffect(() => {
    // console.log('[ThreeScene] targetSystemToFrame changed:', targetSystemToFrame);
    if (!targetSystemToFrame || !sceneRef.current || !cameraRef.current || !controlsRef.current || !Array.isArray(equipment) || equipment.length === 0 || !isSceneReady) {
      if (targetSystemToFrame) {
        // console.log('[ThreeScene] targetSystemToFrame present, but prerequisites not met. Calling onSystemFramed.');
        onSystemFramed(); // Reseta o gatilho se não puder processar
      }
      return;
    }

    // console.log(`[ThreeScene] Focusing on system: ${targetSystemToFrame}`);
    const systemMeshes = equipmentMeshesRef.current.filter(
      (mesh) => mesh.userData.sistema === targetSystemToFrame && mesh.visible
    );

    if (systemMeshes.length === 0) {
      // console.log(`[ThreeScene] No visible meshes found for system: ${targetSystemToFrame}. Calling onSystemFramed.`);
      onSystemFramed(); // Reseta o gatilho
      return;
    }

    const totalBoundingBox = new THREE.Box3();
    systemMeshes.forEach(mesh => {
      if ((mesh as THREE.Mesh).geometry) { 
        mesh.updateMatrixWorld(true); // Garante que a matriz do mundo esteja atualizada
        const meshBox = new THREE.Box3().setFromObject(mesh);
        totalBoundingBox.union(meshBox);
      }
    });

    if (totalBoundingBox.isEmpty()) {
      // console.log(`[ThreeScene] Bounding box for system ${targetSystemToFrame} is empty. Calling onSystemFramed.`);
      onSystemFramed(); // Reseta o gatilho
      return;
    }

    const center = new THREE.Vector3();
    totalBoundingBox.getCenter(center);
    const size = new THREE.Vector3();
    totalBoundingBox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = cameraRef.current.fov * (Math.PI / 180);
    let cameraDistance = maxDim / (2 * Math.tan(fov / 2));
    cameraDistance = cameraDistance * 1.5; // Fator de zoom out
    cameraDistance = Math.max(cameraDistance, 5); // Distância mínima

    // Calcula uma nova posição para a câmera, um pouco acima e atrás do centro do bounding box
    const newCamPos = new THREE.Vector3(
      center.x,
      center.y + Math.max(size.y * 0.5, maxDim * 0.3), // Eleva um pouco a câmera
      center.z + cameraDistance // Afasta a câmera ao longo do eixo Z local do centro
    );
     // Ajuste para objetos muito planos (ex: apenas terreno)
     if (size.y < maxDim * 0.2) { 
       newCamPos.y = center.y + cameraDistance * 0.5; 
     }
     newCamPos.y = Math.max(newCamPos.y, center.y + 2); // Garante uma altura mínima

    // Solicita a mudança de câmera através do callback, que registrará no histórico
    if (onCameraChangeRef.current) {
      // console.log('[ThreeScene] Calling onCameraChangeRef.current for system focus.');
      onCameraChangeRef.current({
        position: newCamPos,
        lookAt: center,
      });
    }
    onSystemFramed(); // Notifica que o processamento do foco foi concluído
  }, [targetSystemToFrame, onSystemFramed, equipment, layers, isSceneReady]); 

  /**
   * useEffect para gerenciar o OutlinePass (efeito de aura).
   * É executado quando `selectedEquipmentTags`, `hoveredEquipmentTag`, `equipmentMeshesRef.current` (implícito por `equipment` e `layers`), ou `isSceneReady` mudam.
   * Define quais objetos devem ser contornados e o estilo do contorno.
   */
  useEffect(() => {
    if (!isSceneReady || !outlinePassRef.current || !sceneRef.current || !equipmentMeshesRef.current) {
      // console.log('[ThreeScene OutlinePass] SKIPPING: Core refs not ready or scene not ready yet.');
      if (outlinePassRef.current) setOutlinePassObjects(outlinePassRef.current, []);
      return;
    }
    
    // Garante valores padrão para as props se forem undefined na primeira execução
    const effectiveSelectedTags = selectedEquipmentTags ?? [];
    const effectiveHoveredTag = hoveredEquipmentTag === undefined ? null : hoveredEquipmentTag;
    
    // console.log(`[ThreeScene OutlinePass] Received Props: selectedTags=${JSON.stringify(selectedEquipmentTags)}, hoveredTag=${hoveredEquipmentTag}`);
    // console.log(`[ThreeScene OutlinePass] Effective Values: selected=${JSON.stringify(effectiveSelectedTags)}, hovered=${effectiveHoveredTag}`);

    let objectsToOutline: THREE.Object3D[] = [];
    const meshesToConsider = equipmentMeshesRef.current.filter(mesh => mesh.visible);
    // if (meshesToConsider.length > 0) console.log(`[ThreeScene OutlinePass] Meshes to consider for outline: ${meshesToConsider.map(m => m.userData.tag).join(', ')}`);
    
    let styleType: 'selected' | 'hover' | 'none' = 'none';

    if (Array.isArray(effectiveSelectedTags) && effectiveSelectedTags.length > 0) {
      effectiveSelectedTags.forEach(tag => {
        const selectedMesh = meshesToConsider.find(mesh => mesh.userData.tag === tag);
        if (selectedMesh) {
          objectsToOutline.push(selectedMesh);
          // console.log(`[ThreeScene OutlinePass] Adding SELECTED mesh to outline: ${tag}`);
        }
      });
      if (objectsToOutline.length > 0) {
        styleType = 'selected';
      }
    }
    
    if (effectiveHoveredTag && (!Array.isArray(effectiveSelectedTags) || !effectiveSelectedTags.includes(effectiveHoveredTag))) {
      const hoveredMesh = meshesToConsider.find(mesh => mesh.userData.tag === effectiveHoveredTag);
      if (hoveredMesh) {
        objectsToOutline.push(hoveredMesh);
        // Se já temos algo selecionado, o estilo de seleção prevalece, mas o objeto em hover também é adicionado ao contorno
        // (o OutlinePass contorna todos em selectedObjects com o mesmo estilo).
        // Se quisermos estilos diferentes, precisaríamos de múltiplos OutlinePasses ou técnicas mais avançadas.
        // Para simplicidade, se algo está selecionado, tudo em objectsToOutline usa o estilo 'selected'.
        if (styleType !== 'selected') { 
            styleType = 'hover';
        }
        // console.log(`[ThreeScene OutlinePass] Adding HOVERED mesh to outline: ${effectiveHoveredTag}`);
      }
    }
    
    // console.log(`[ThreeScene OutlinePass] Style: ${styleType}. Strength ${outlinePassRef.current.edgeStrength}. Outlining: ${objectsToOutline.map(o => o.userData.tag).join(', ') || 'None'}`);
    setOutlinePassObjects(outlinePassRef.current, objectsToOutline);
    applyOutlinePassStyle(outlinePassRef.current, styleType);
    // console.log(`[ThreeScene OutlinePass] Final selectedObjects for outlinePass: ${objectsToOutline.length > 0 ? objectsToOutline.map(o => o.userData.tag).join(', ') : 'None'}`);
  
  }, [selectedEquipmentTags, hoveredEquipmentTag, equipment, layers, isSceneReady]); 


  return <div ref={mountRef} className="w-full h-full" />;
};

export default ThreeScene;
