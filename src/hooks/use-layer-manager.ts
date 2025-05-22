
/**
 * @fileOverview Custom hook para gerenciar o estado das camadas (layers) e a lógica para alternar sua visibilidade.
 * Inclui integração com o sistema de histórico de comandos.
 */
"use client";

import { useState, useCallback } from 'react';
import type { Layer, Command } from '@/lib/types';
import { initialLayers } from '@/core/data/initial-data';

interface UseLayerManagerProps {
  executeCommand: (command: Command) => void;
}

interface UseLayerManagerReturn {
  layers: Layer[];
  handleToggleLayer: (layerId: string) => void;
}

export function useLayerManager({ executeCommand }: UseLayerManagerProps): UseLayerManagerReturn {
  const [layers, setLayers] = useState<Layer[]>(initialLayers);

  /**
   * Manipula a alternância de visibilidade de uma camada.
   * Esta operação é registrada no histórico de comandos.
   * @param layerId O ID da camada a ser alternada.
   */
  const handleToggleLayer = useCallback((layerId: string) => {
    const layerIndex = layers.findIndex(l => l.id === layerId);
    if (layerIndex === -1) return;

    const oldLayers = [...layers]; // Deep copy for a snapshot
    const newLayers = oldLayers.map(l => 
      l.id === layerId ? { ...l, isVisible: !l.isVisible } : l
    );

    const command: Command = {
      id: `toggle-layer-${layerId}-${Date.now()}`,
      type: 'LAYER_VISIBILITY',
      description: `Visibilidade da camada ${oldLayers[layerIndex].name} ${newLayers[layerIndex].isVisible ? 'ativada' : 'desativada'}`,
      execute: () => setLayers(newLayers),
      undo: () => setLayers(oldLayers),
    };
    executeCommand(command);
  }, [layers, executeCommand]);

  return { layers, handleToggleLayer };
}
