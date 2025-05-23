// src/hooks/use-annotation-pins.ts
import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Annotation, Equipment, Layer } from '@/lib/types';

interface UseAnnotationPinsProps {
  scene: THREE.Scene | null;
  labelRenderer: CSS2DRenderer | null;
  annotations: Annotation[];
  equipmentData: Equipment[];
  layers: Layer[];
}

/**
 * React hook to manage the visual representation of annotations as CSS2DObject pins in a Three.js scene.
 * Adds, updates, and removes annotation pins based on changes in annotation data, equipment positions, and layer visibility.
 *
 * @param {UseAnnotationPinsProps} props The hook properties.
 */
export function useAnnotationPins({
  scene,
  labelRenderer,
  annotations,
  equipmentData,
  layers,
}: UseAnnotationPinsProps) {
  const existingPinsRef = useRef<Map<string, CSS2DObject>>(new Map());

  useEffect(() => {
    if (!scene || !labelRenderer || !Array.isArray(annotations) || !Array.isArray(equipmentData)) {
      // console.log('[useAnnotationPins] SKIPPING update: Core refs or data not ready.');
      return;
    }

    // console.log(`[useAnnotationPins] Updating annotation pins. Annotations count: ${annotations.length}`);

    const currentAnnotationIds = new Set(annotations.map(anno => anno.id));
    const equipmentPositionMap = new Map<string, THREE.Vector3>();
    equipmentData.forEach(eq => {
      equipmentPositionMap.set(eq.tag, new THREE.Vector3(eq.position.x, eq.position.y, eq.position.z));
    });

    // Process annotations: add new, update existing
    annotations.forEach(annotation => {
      const equipment = equipmentData.find(eq => eq.tag === annotation.equipmentTag);
      const layer = layers.find(l => l.id === equipment?.layerId);

      // Check if equipment exists and is on a visible layer
      const isEquipmentVisible = equipment && layer?.visible !== false; // Default to visible if layer not found

      if (!isEquipmentVisible) {
         // If equipment is not visible or doesn't exist, remove pin if present
         if (existingPinsRef.current.has(annotation.id)) {
             const pin = existingPinsRef.current.get(annotation.id)!;
             scene.remove(pin);
             if (pin.element.parentNode) {
                 pin.element.parentNode.removeChild(pin.element);
             }
             existingPinsRef.current.delete(annotation.id);
             // console.log(`[useAnnotationPins] Removed pin for hidden equipment/layer: ${annotation.id}`);
         }
         return; // Skip processing this annotation further if equipment is hidden
      }


      const equipmentPosition = equipmentPositionMap.get(annotation.equipmentTag);

      if (!equipmentPosition) {
        // console.warn(`[useAnnotationPins] Equipment position not found for tag: ${annotation.equipmentTag}`);
        // Remove pin if equipment position is missing but pin exists
         if (existingPinsRef.current.has(annotation.id)) {
             const pin = existingPinsRef.current.get(annotation.id)!;
             scene.remove(pin);
             if (pin.element.parentNode) {
                 pin.element.parentNode.removeChild(pin.element);
             }
             existingPinsRef.current.delete(annotation.id);
             // console.log(`[useAnnotationPins] Removed pin for missing equipment position: ${annotation.id}`);
         }
        return;
      }

      let pin = existingPinsRef.current.get(annotation.id);

      if (!pin) {
        // Create new pin
        const pinElement = document.createElement('div');
        pinElement.className = 'annotation-pin'; // Use a CSS class for styling
        pinElement.textContent = annotation.code; // Display annotation code

        pin = new CSS2DObject(pinElement);
        pin.userData = { annotationId: annotation.id };
        scene.add(pin);
        existingPinsRef.current.set(annotation.id, pin);
        // console.log(`[useAnnotationPins] Created new pin for annotation: ${annotation.id}`);
      }

      // Update pin position
      // Pin position might be slightly offset from equipment position if needed
      // For simplicity, let's position it directly at equipment for now.
      pin.position.copy(equipmentPosition);
      pin.visible = true; // Ensure pin is visible if equipment is visible
    });

    // Remove pins for annotations that no longer exist
    existingPinsRef.current.forEach((pin, pinId) => {
      if (!currentAnnotationIds.has(pinId)) {
        // console.log(`[useAnnotationPins] Removing pin for removed annotation: ${pinId}`);
        scene.remove(pin);
         if (pin.element.parentNode) {
            pin.element.parentNode.removeChild(pin.element);
         }
        existingPinsRef.current.delete(pinId);
      }
    });

     // console.log(`[useAnnotationPins] Finished pin update. Total pins: ${existingPinsRef.current.size}`);

    // The CSS2DRenderer updates its positions during the animation loop.
    // No manual update needed here.

    // Cleanup function to remove all pins when the component unmounts or dependencies change significantly
    return () => {
        // console.log('[useAnnotationPins] CLEANUP running. Removing all pins.');
        existingPinsRef.current.forEach(pin => {
            scene?.remove(pin); // Use optional chaining just in case scene is already null
            if (pin.element.parentNode) { // Ensure parentNode exists before removal
                pin.element.parentNode.removeChild(pin.element);
            }
        });
        existingPinsRef.current.clear();
        // console.log('[useAnnotationPins] CLEANUP finished. Pins cleared.');
    };

  }, [scene, labelRenderer, annotations, equipmentData, layers]); // Dependencies

  // The hook doesn't need to return anything as it directly modifies the scene
}