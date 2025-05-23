
/**
 * @fileOverview Custom hook para gerenciar o loop de animação de uma cena Three.js.
 *
 * Responsabilidades:
 * - Encapsular a lógica de `requestAnimationFrame` para renderizar a cena continuamente.
 * - Atualizar controles de órbita (se habilitados e presentes).
 * - Renderizar o composer principal (para pós-processamento) e o renderizador de rótulos 2D (se presentes).
 * - Iniciar o loop apenas quando a cena estiver pronta e os refs necessários estiverem disponíveis.
 */
import type * as THREE from 'three';
import { useEffect, type RefObject } from 'react';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import type { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

/**
 * Props para o hook useAnimationLoop.
 * @interface UseAnimationLoopProps
 * @property {boolean} isSceneReady - Indica se a cena está pronta para iniciar o loop.
 * @property {RefObject<THREE.Scene | null>} sceneRef - Ref para a cena Three.js.
 * @property {RefObject<THREE.PerspectiveCamera | null>} cameraRef - Ref para a câmera da cena.
 * @property {RefObject<OrbitControls | null>} controlsRef - Ref para os OrbitControls.
 * @property {RefObject<EffectComposer | null>} composerRef - Ref para o EffectComposer (pós-processamento).
 * @property {RefObject<CSS2DRenderer | null>} labelRendererRef - Ref para o CSS2DRenderer (rótulos HTML).
 */
interface UseAnimationLoopProps {
  isSceneReady: boolean;
  sceneRef: RefObject<THREE.Scene | null>;
  cameraRef: RefObject<THREE.PerspectiveCamera | null>;
  controlsRef: RefObject<OrbitControls | null>;
  composerRef: RefObject<EffectComposer | null>;
  labelRendererRef: RefObject<CSS2DRenderer | null>;
}

/**
 * Hook customizado para gerenciar o loop de animação de uma cena Three.js.
 * Ele configura e executa o `requestAnimationFrame` para renderizar a cena
 * e atualizar os controles, o composer e o renderizador de rótulos.
 * O loop só é iniciado quando `isSceneReady` é verdadeiro e todos os refs necessários estão populados.
 *
 * @param {UseAnimationLoopProps} props - As props necessárias para o loop de animação.
 */
export function useAnimationLoop({
  isSceneReady,
  sceneRef,
  cameraRef,
  controlsRef,
  composerRef,
  labelRendererRef,
}: UseAnimationLoopProps): void {
  useEffect(() => {
    // console.log(`[AnimationLoop] useEffect triggered. isSceneReady: ${isSceneReady}`);
    if (!isSceneReady || !sceneRef.current || !cameraRef.current || !controlsRef.current || !composerRef.current || !labelRendererRef.current) {
      // console.log('[AnimationLoop] Skipping animation frame: Not all refs are ready or scene is not ready.');
      return;
    }

    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const composer = composerRef.current;
    const labelRenderer = labelRendererRef.current;

    let animationFrameId: number;

    /**
     * Função de animação chamada recursivamente via requestAnimationFrame.
     * Atualiza controles e renderiza a cena.
     */
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (controls.enabled) controls.update(); // Atualiza apenas se habilitado
      composer.render();
      labelRenderer.render(scene, camera);
    };

    // console.log('[AnimationLoop] Starting animation loop.');
    animate();

    return () => {
      // console.log('[AnimationLoop] Cancelling animation frame.');
      cancelAnimationFrame(animationFrameId);
    };
  }, [isSceneReady, sceneRef, cameraRef, controlsRef, composerRef, labelRendererRef]);
}

    