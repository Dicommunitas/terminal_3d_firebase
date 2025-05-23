import { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsType } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import type { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';

import { setupLighting, setupGroundPlane, setupRenderPipeline } from '@/core/three/scene-elements-setup';
import type { CameraState } from '@/lib/types';

/**
 * Props for the useSceneSetup hook.
 * @interface UseSceneSetupProps
 * @property {React.RefObject<HTMLDivElement>} mountRef - Ref to the container element for the scene.
 * @property {{ x: number; y: number; z: number }} initialCameraPosition - The initial position of the camera.
 * @property {{ x: number; y: number; z: number }} initialCameraLookAt - The initial point the camera is looking at.
 * @property {(cameraState: CameraState) => void} onCameraChange - Callback function to be called when the camera changes.
 */
interface UseSceneSetupProps {
  mountRef: React.RefObject<HTMLDivElement>;
  initialCameraPosition: { x: number; y: number; z: number };
  initialCameraLookAt: { x: number; y: number; z: number };
  onCameraChange: (cameraState: CameraState) => void;
}

/**
 * Return value of the useSceneSetup hook.
 * @interface UseSceneSetupReturn
 * @property {React.RefObject<THREE.Scene | null>} sceneRef - Ref to the Three.js Scene.
 * @property {React.RefObject<THREE.PerspectiveCamera | null>} cameraRef - Ref to the Three.js Camera.
 * @property {React.RefObject<THREE.WebGLRenderer | null>} rendererRef - Ref to the WebGLRenderer.
 * @property {React.RefObject<CSS2DRenderer | null>} labelRendererRef - Ref to the CSS2DRenderer.
 * @property {React.RefObject<OrbitControlsType | null>} controlsRef - Ref to the OrbitControls.
 * @property {React.RefObject<EffectComposer | null>} composerRef - Ref to the EffectComposer.
 * @property {React.RefObject<OutlinePass | null>} outlinePassRef - Ref to the OutlinePass.
 * @property {React.RefObject<THREE.Mesh | null>} groundMeshRef - Ref to the ground plane mesh.
 * @property {boolean} isSceneReady - State indicating if the scene setup is complete.
 */
interface UseSceneSetupReturn {
  sceneRef: React.RefObject<THREE.Scene | null>;
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
  rendererRef: React.RefObject<THREE.WebGLRenderer | null>;
  labelRendererRef: React.RefObject<CSS2DRenderer | null>;
  controlsRef: React.RefObject<OrbitControlsType | null>;
  composerRef: React.RefObject<EffectComposer | null>;
  outlinePassRef: React.RefObject<OutlinePass | null>;
  groundMeshRef: React.RefObject<THREE.Mesh | null>;
  isSceneReady: boolean;
}

/**
 * A custom hook for handling the initial setup of a Three.js scene.
 * Encapsulates the creation of the scene, camera, renderers, controls, lighting, and ground plane.
 * Also manages the scene's readiness state and handles window resizing.
 *
 * @param {UseSceneSetupProps} props - The properties for the hook.
 * @returns {UseSceneSetupReturn} An object containing refs to the core scene elements and the readiness state.
 */
export const useSceneSetup = (props: UseSceneSetupProps): UseSceneSetupReturn => {
  const { mountRef, initialCameraPosition, initialCameraLookAt, onCameraChange } = props;

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  const controlsRef = useRef<OrbitControlsType | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const outlinePassRef = useRef<OutlinePass | null>(null);
  const groundMeshRef = useRef<THREE.Mesh | null>(null);

  const [isSceneReady, setIsSceneReady] = useState(false);

  // Ref for the onCameraChange callback to prevent stale closures
  const onCameraChangeRef = useRef(onCameraChange);
  useEffect(() => { onCameraChangeRef.current = onCameraChange; }, [onCameraChange]);


  /**
   * Handles the resizing of the container and updates the camera and renderers.
   */
  const handleResize = useCallback(() => {
    if (mountRef.current && cameraRef.current && rendererRef.current) {
      const width = Math.max(1, mountRef.current.clientWidth);
      const height = Math.max(1, mountRef.current.clientHeight);

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();

      rendererRef.current.setSize(width, height);
      labelRendererRef.current?.setSize(width, height);
      composerRef.current?.setSize(width, height);
      outlinePassRef.current?.resolution.set(width, height);
    }
  }, [mountRef]); // mountRef is a dependency because its current property is used inside the callback


  /**
   * Effect hook for the initial setup of the Three.js scene.
   * Runs only once on component mount.
   */
  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) {
      console.warn('[useSceneSetup] mountRef.current is null. Aborting setup.');
      return;
    }

    sceneRef.current = new THREE.Scene();
    cameraRef.current = new THREE.PerspectiveCamera(75, Math.max(1, currentMount.clientWidth) / Math.max(1, currentMount.clientHeight), 0.1, 2000);
    cameraRef.current.position.set(initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z);

    const pipeline = setupRenderPipeline(currentMount, sceneRef.current, cameraRef.current);
    if (!pipeline) {
      console.error("[useSceneSetup] Failed to setup render pipeline. Aborting setup.");
      // Consider setting an error state here if needed
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
        // Ensure camera and renderer are available before creating controls
        if (!cameraRef.current || !rendererRef.current?.domElement) {
          console.error("[useSceneSetup] Failed to initialize OrbitControls: Camera or Renderer domElement not ready.");
          return;
        }

        controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
        controlsRef.current.enableDamping = true;

        if (initialCameraLookAt) {
          controlsRef.current.target.set(initialCameraLookAt.x, initialCameraLookAt.y, initialCameraLookAt.z);
        } else {
          console.warn("[useSceneSetup] initialLookAt is undefined during OrbitControls setup. Using default target (0,0,0).");
          controlsRef.current.target.set(0, 0, 0); // Fallback
        }

        controlsRef.current.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN
        };
        controlsRef.current.update();

        // Attach listener for camera changes and store cleanup function
        const handleControlsChangeEnd = () => {
          // Use the ref for the callback
          if (cameraRef.current && controlsRef.current && onCameraChangeRef.current) {
            const newCameraState: CameraState = {
              position: cameraRef.current.position.clone(),
              lookAt: controlsRef.current.target.clone(),
            };
            onCameraChangeRef.current(newCameraState);
          }
        };

        // Check if controlsRef.current is available before adding event listener
        if (controlsRef.current) {
            controlsRef.current.addEventListener('end', handleControlsChangeEnd);
             if (!controlsRef.current.userData) {
                controlsRef.current.userData = {};
            }
             // Store cleanup in userData for easy access during hook cleanup
            controlsRef.current.userData.cleanupControls = () => {
                controlsRef.current?.removeEventListener('end', handleControlsChangeEnd);
            };
        }


      })
      .catch(err => console.error("[useSceneSetup] Failed to load OrbitControls", err));


    // Setup ResizeObserver
    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(currentMount);

    // Use a timeout to ensure the initial size is calculated after the element is in the DOM
    const initialSetupTimeoutId = setTimeout(() => {
      handleResize(); // Perform initial resize after a short delay
      setIsSceneReady(true);
      console.log('[useSceneSetup] Scene is now READY.');
    }, 150); // Small delay to allow DOM to settle


    /**
     * Cleanup function for the effect. Disposes of Three.js objects and removes event listeners.
     */
    return () => {
      console.log('[useSceneSetup] Setup useEffect CLEANUP running.');
      clearTimeout(initialSetupTimeoutId);

      // Disconnect ResizeObserver
      if (currentMount) {
        resizeObserver.unobserve(currentMount);
      }

      // Dispose OrbitControls and remove its event listener
      if (controlsRef.current) {
         if (controlsRef.current.userData?.cleanupControls && typeof controlsRef.current.userData.cleanupControls === 'function') {
            controlsRef.current.userData.cleanupControls();
         }
        controlsRef.current.dispose();
        controlsRef.current = null;
      }

      // Dispose Ground Mesh geometry and material
      if (groundMeshRef.current) {
        groundMeshRef.current.geometry?.dispose();
        if (groundMeshRef.current.material instanceof THREE.Material) {
           (groundMeshRef.current.material as THREE.Material).dispose();
        }
        // Remove from scene - although scene will be disposed, explicit removal is cleaner
        sceneRef.current?.remove(groundMeshRef.current);
        groundMeshRef.current = null;
      }

      // Dispose Composer passes and Composer itself
       composerRef.current?.passes.forEach(pass => {
            // Check if pass and its dispose method exist before calling
            if (pass && (pass as any).dispose && typeof (pass as any).dispose === 'function') {
                (pass as any).dispose();
            }
       });
       composerRef.current = null;
       outlinePassRef.current = null;

      // Dispose Renderers and remove their DOM elements
      if (rendererRef.current) {
         if (rendererRef.current.domElement.parentNode === currentMount) {
             currentMount.removeChild(rendererRef.current.domElement);
         }
         rendererRef.current.dispose();
         rendererRef.current = null;
      }

      if (labelRendererRef.current) {
         if (labelRendererRef.current.domElement.parentNode === currentMount) {
             currentMount.removeChild(labelRendererRef.current.domElement);
         }
         // CSS2DRenderer doesn't have a public dispose method, but removing from DOM is key
         labelRendererRef.current = null;
      }

      // Dispose Scene - this might dispose some objects twice if they weren't explicitly removed,
      // but is a safety measure. A more thorough cleanup would explicitly dispose all objects
      // before disposing the scene, but that can be complex.
      // For this context, relying on Garbage Collection for scene and camera refs after setting to null is common.
      // Dispose geometries/materials of equipment meshes should be handled elsewhere if not in scene.children

      sceneRef.current = null;
      cameraRef.current = null;

      setIsSceneReady(false);
      console.log('[useSceneSetup] Setup CLEANUP finished.');
    };

  // Empty dependency array ensures this effect runs only on mount and unmount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mountRef, initialCameraPosition.x, initialCameraPosition.y, initialCameraPosition.z, initialCameraLookAt.x, initialCameraLookAt.y, initialCameraLookAt.z]); // Added dependencies for initial camera state to ensure setup re-runs if these change

  return {
    sceneRef,
    cameraRef,
    rendererRef,
    labelRendererRef,
    controlsRef,
    composerRef,
    outlinePassRef,
    groundMeshRef,
    isSceneReady,
  };
};