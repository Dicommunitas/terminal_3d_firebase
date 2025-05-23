// src/hooks/use-scene-annotations.ts
import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import type { Annotation, Equipment, Layer } from '@/lib/types';
import { updateAnnotationPins } from '../../core/three/label-renderer-utils'; // Adjust the path if necessary

/**
 * @interface UseSceneAnnotationsProps
 * @property {React.RefObject<THREE.Scene | null>} sceneRef - React ref to the Three.js Scene.
 * @property {React.RefObject<CSS2DRenderer | null>} labelRendererRef - React ref to the CSS2DRenderer.
 * @property {Annotation[]} annotations - List of annotations to be displayed.
 * @property {Equipment[]} equipment - List of equipment objects (used for annotation positioning).
 * @property {Layer[]} layers - List of layers to control annotation visibility.
 */
interface UseSceneAnnotationsProps {
  sceneRef: React.RefObject<THREE.Scene | null>;
  labelRendererRef: React.RefObject<CSS2DRenderer | null>;
  annotations: Annotation[];
  equipment: Equipment[];
  layers: Layer[];
  isSceneReady: boolean; // Added for sync with scene initialization
}

/**
 * Custom hook to manage the visual display of annotations (pins) in a Three.js scene.
 * It creates and updates CSS2DObjects based on annotation data and equipment positions.
 *
 * @param {UseSceneAnnotationsProps} props The properties for the hook.
 */
export function useSceneAnnotations({
  sceneRef,
  labelRendererRef,
  annotations,
  equipment,
  layers,
  isSceneReady, // Use the scene readiness state
}: UseSceneAnnotationsProps): void { // Hook does not return anything, it manages side effects

  // Ref to keep track of the current annotation pin objects in the scene
  const annotationPinObjectsRef = useRef<CSS2DObject[]>([]);

  /**
   * Effect hook to update the annotation pins in the scene whenever the
   * annotations, equipment data, layers, or scene readiness changes.
   * It delegates the actual update logic to a utility function.
   */
  useEffect(() => {
    // console.log(`[useSceneAnnotations] useEffect. isSceneReady: ${isSceneReady}, annotations: ${annotations?.length}`);
    // Ensure core refs and data are available and the scene is ready
    if (!isSceneReady || !sceneRef.current || !labelRendererRef.current || !Array.isArray(annotations) || !Array.isArray(equipment)) {
      // console.log('[useSceneAnnotations] SKIPPING update: Scene not ready, core refs not available, or data not valid.');
      return;
    }

    // Delegate the update logic to the utility function
    updateAnnotationPins({
      scene: sceneRef.current,
      labelRenderer: labelRendererRef.current,
      annotations: annotations,
      equipmentData: equipment,
      layers: layers,
      existingPinsRef: annotationPinObjectsRef, // Pass the internal ref
    });

    // Console log for debugging if needed
    // console.log(`[useSceneAnnotations] Annotation pins updated. Current pins in ref: ${annotationPinObjectsRef.current.length}`);

    // No cleanup needed for this specific update logic, as updateAnnotationPins handles removal
    // But we need cleanup for the mount phase to remove all pins on unmount
    // (The cleanup for the main setup effect in ThreeScene.tsx already handles this via annotationPinObjectsRef)

  // Dependencies include data, layers, refs and the scene readiness state
  }, [annotations, equipment, layers, isSceneReady, sceneRef, labelRendererRef]);

  // Although the useEffect cleanup in ThreeScene handles removing the DOM elements
  // and Three.js objects managed by annotationPinObjectsRef on component unmount,
  // adding a specific cleanup here for the hook's lifecycle is good practice
  // if this hook were to be used in a context where ThreeScene's cleanup wasn't guaranteed.
  // However, given the current architecture where this hook is used within ThreeScene,
  // the cleanup in ThreeScene's main useEffect is sufficient and more robust as it has access
  // to the scene instance during the unmount phase.
  // Keeping this comment here for architectural clarity.
}