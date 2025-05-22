
/**
 * @fileOverview Custom hook para gerenciar o estado das camadas (layers) e a lógica para alternar sua visibilidade.
 * Inclui integração com o sistema de histórico de comandos.
 */
"use client";

import { useState, useCallback } from 'react';
import type { Layer, Command } from '@/lib/types';
import { initialLayers } from '@/core/data/initial-data'; // Certifique-se que initialLayers está exportado

interface UseLayerManagerProps {
  executeCommand: (command: Command) => void;
}

interface UseLayerManagerReturn {
  layers: Layer[];
  handleToggleLayer: (layerId: string) => void;
}

/**
 * Hook para gerenciar o estado das camadas e sua visibilidade.
 * @param {UseLayerManagerProps} props - Props para o hook.
 * @param {function} props.executeCommand - Função para executar comandos e adicioná-los ao histórico.
 * @returns {UseLayerManagerReturn} Um objeto contendo o estado das camadas e a função para alternar sua visibilidade.
 */
export function useLayerManager({ executeCommand }: UseLayerManagerProps): UseLayerManagerReturn {
  const [layers, setLayers] = useState<Layer[]>(initialLayers);

  /**
   * Manipula a alternância de visibilidade de uma camada.
   * Esta operação é registrada no histórico de comandos.
   * @param {string} layerId O ID da camada a ser alternada.
   */
  const handleToggleLayer = useCallback((layerId: string) => {
    const layerIndex = layers.findIndex(l => l.id === layerId);
    if (layerIndex === -1) return;

    // Criar cópias para o estado antigo e novo para o comando
    const oldLayersState = layers.map(l => ({ ...l })); // Snapshot do estado anterior
    const newLayersState = layers.map(l =>
      l.id === layerId ? { ...l, isVisible: !l.isVisible } : { ...l }
    );

    const command: Command = {
      id: `toggle-layer-${layerId}-${Date.now()}`,
      type: 'LAYER_VISIBILITY',
      description: `Visibilidade da camada ${oldLayersState[layerIndex].name} ${newLayersState[layerIndex].isVisible ? 'ativada' : 'desativada'}`,
      execute: () => setLayers(newLayersState),
      undo: () => setLayers(oldLayersState),
    };
    executeCommand(command);
  }, [layers, executeCommand]);

  return { layers, handleToggleLayer };
}
