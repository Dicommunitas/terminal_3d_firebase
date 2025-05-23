import { useRef, useEffect } from 'react';
import * as THREE from 'three';

/**
 * This hook manages mouse interactions (mousemove and click) with 3D objects in a Three.js scene.
 * It uses raycasting to detect object intersection.
 */


/**
 * A custom hook to handle mouse interactions (hover and click) with objects in a Three.js scene.
 *
 * @param scene - The Three.js scene.
 * @param camera - The Three.js camera.
 * @param interactiveObjects - An array of objects in the scene that should be interactive.
 * @param onObjectClick - Callback function to be called when an interactive object is clicked.
 * @param onObjectHover - Callback function to be called when the mouse hovers over an interactive object, or null when no object is hovered.
 * @param domElement - The DOM element (canvas) to attach event listeners to.
 */
export const useMouseInteraction = (
  scene: THREE.Scene | null,
  camera: THREE.Camera | null,
  interactiveObjects: THREE.Object3D[],
  onObjectClick: (object: THREE.Object3D) => void,
  onObjectHover: (object: THREE.Object3D | null) => void,
  domElement: HTMLElement | null // Accept the DOM element
) => {
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const intersectedObject = useRef<THREE.Object3D | null>(null);

  useEffect(() => {
    if (!domElement || !camera) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      // Calculate mouse position in normalized device coordinates (-1 to +1)
      const rect = domElement.getBoundingClientRect();
      mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      if (scene && camera) {
        raycaster.current.setFromCamera(mouse.current, camera);
        const intersects = raycaster.current.intersectObjects(interactiveObjects, true);

        if (intersects.length > 0) {
          // Find the first object in the intersects array that is one of the interactive objects
          const interactiveIntersect = intersects.find(intersect =>
            interactiveObjects.some(obj => obj.uuid === intersect.object.uuid || obj.children.some(child => child.uuid === intersect.object.uuid))
          );


          if (interactiveIntersect) {
            const currentIntersected = interactiveIntersect.object;

             // Traverse up the hierarchy to find the direct child of the equipment group if the intersected object is a child mesh
             let equipmentObject: THREE.Object3D | null = currentIntersected;
             while (equipmentObject && !interactiveObjects.some(obj => obj.uuid === equipmentObject?.uuid)) {
               equipmentObject = equipmentObject.parent;
             }


            if (equipmentObject && equipmentObject !== intersectedObject.current) {
              onObjectHover(equipmentObject);
              intersectedObject.current = equipmentObject;
              domElement.style.cursor = 'pointer'; // Change cursor on hover
            } else if (!equipmentObject && intersectedObject.current) {
                 // Case where we were hovering an object but the raycaster no longer intersects it
                 onObjectHover(null);
                 intersectedObject.current = null;
                 domElement.style.cursor = 'auto'; // Restore default cursor
            }

          } else {
            if (intersectedObject.current) {
              onObjectHover(null);
              intersectedObject.current = null;
              domElement.style.cursor = 'auto'; // Restore default cursor
            }
          }
        } else {
          if (intersectedObject.current) {
            onObjectHover(null);
            intersectedObject.current = null;
            domElement.style.cursor = 'auto'; // Restore default cursor
          }
        }
      }
    };

    const handleClick = (event: MouseEvent) => {
        if (!scene || !camera) {
            return;
        }

      const rect = domElement.getBoundingClientRect();
      mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;


      raycaster.current.setFromCamera(mouse.current, camera);
      const intersects = raycaster.current.intersectObjects(interactiveObjects, true);

      if (intersects.length > 0) {
         const interactiveIntersect = intersects.find(intersect =>
            interactiveObjects.some(obj => obj.uuid === intersect.object.uuid || obj.children.some(child => child.uuid === intersect.object.uuid))
         );

         if (interactiveIntersect) {
             let equipmentObject: THREE.Object3D | null = interactiveIntersect.object;
              while (equipmentObject && !interactiveObjects.some(obj => obj.uuid === equipmentObject?.uuid)) {
                equipmentObject = equipmentObject.parent;
              }
             if (equipmentObject) {
                 onObjectClick(equipmentObject);
             }
         }
      }
    };

    domElement.addEventListener('mousemove', handleMouseMove);
    domElement.addEventListener('click', handleClick);

    return () => {
      domElement.removeEventListener('mousemove', handleMouseMove);
      domElement.removeEventListener('click', handleClick);
    };
  }, [scene, camera, interactiveObjects, onObjectClick, onObjectHover, domElement]); // Re-run effect if these dependencies change
};