
/**
 * @fileOverview Custom hook para gerenciar o efeito de contorno (OutlinePass) na cena 3D.
 * Este hook é responsável por observar mudanças nos equipamentos selecionados e em hover,
 * e atualizar o OutlinePass para destacar os objetos apropriados.
 */
"use client";

import type * as THREE from 'three';
import { useEffect } from 'react';
import type { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { updateOutlineEffect } from '@/core/three/postprocessing-utils';

/**
 * Props para o hook useSceneOutline.
 * @interface UseSceneOutlineProps
 * @property {React.RefObject<OutlinePass | null>} outlinePassRef - Ref para a instância do OutlinePass.
 * @property {React.RefObject<THREE.Object3D[]>} equipmentMeshesRef - Ref para o array de meshes de equipamentos na cena.
 * @property {string[] | undefined} selectedEquipmentTags - Array de tags dos equipamentos selecionados.
 * @property {string | null | undefined} hoveredEquipmentTag - Tag do equipamento atualmente em hover.
 * @property {boolean} isSceneReady - Flag indicando se a cena 3D está pronta.
 */
interface UseSceneOutlineProps {
  outlinePassRef: React.RefObject<OutlinePass | null>;
  equipmentMeshesRef: React.RefObject<THREE.Object3D[]>;
  selectedEquipmentTags: string[] | undefined;
  hoveredEquipmentTag: string | null | undefined;
  isSceneReady: boolean;
}

/**
 * Hook customizado para gerenciar e aplicar o efeito de contorno (OutlinePass)
 * aos equipamentos selecionados ou em hover na cena 3D.
 *
 * @param {UseSceneOutlineProps} props - As props para o hook.
 */
export function useSceneOutline({
  outlinePassRef,
  equipmentMeshesRef,
  selectedEquipmentTags,
  hoveredEquipmentTag,
  isSceneReady,
}: UseSceneOutlineProps): void {
  useEffect(() => {
    // console.log('[useSceneOutline] useEffect triggered. isSceneReady:', isSceneReady);
    // console.log('[useSceneOutline] Props: selectedTags=', selectedEquipmentTags, ', hoveredTag=', hoveredEquipmentTag);

    if (!isSceneReady || !outlinePassRef.current || !equipmentMeshesRef.current) {
      // console.log('[useSceneOutline] SKIPPING: Core refs not ready or scene not ready yet.');
      if(outlinePassRef.current) {
        // Ensure outline is off if we skip
        updateOutlineEffect(outlinePassRef.current, [], [], null);
      }
      return;
    }

    // Trata casos onde props podem ser undefined inicialmente
    const effectiveSelectedTags = selectedEquipmentTags ?? [];
    const effectiveHoveredTag = hoveredEquipmentTag === undefined ? null : hoveredEquipmentTag;

    // console.log(`[useSceneOutline] Effective Values: selected=${JSON.stringify(effectiveSelectedTags)}, hovered=${effectiveHoveredTag}`);
    // console.log(`[useSceneOutline] Meshes available: ${equipmentMeshesRef.current.map(m => m.userData.tag).join(', ')}`);

    updateOutlineEffect(
      outlinePassRef.current,
      equipmentMeshesRef.current,
      effectiveSelectedTags,
      effectiveHoveredTag
    );
  }, [
    isSceneReady,
    selectedEquipmentTags,
    hoveredEquipmentTag,
    equipmentMeshesRef, // Depende da ref em si, não do seu .current para a dependência do hook
    outlinePassRef,   // Similarmente
  ]);
}
