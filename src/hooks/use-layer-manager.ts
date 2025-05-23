
/**
 * @fileOverview Custom hook para gerenciar o estado das camadas (layers) e a lógica para alternar sua visibilidade.
 *
 * Responsabilidades:
 * - Manter o estado da lista de camadas (`layers`), incluindo o nome, tipo de equipamento que controla e visibilidade.
 * - Fornecer uma função (`handleToggleLayer`) para alternar a visibilidade de uma camada específica.
 * - Integrar a alternância de visibilidade com o sistema de histórico de comandos (`useCommandHistory`)
 *   para permitir undo/redo.
 */
"use client";

import { useState, useCallback } from 'react';
import type { Layer, Command } from '@/lib/types';
import { initialLayers } from '@/core/data/initial-data';

/**
 * Props para o hook useLayerManager.
 * @interface UseLayerManagerProps
 * @property {(command: Command) => void} executeCommand - Função para executar comandos e adicioná-los ao histórico.
 */
interface UseLayerManagerProps {
  executeCommand: (command: Command) => void;
}

/**
 * Retorno do hook useLayerManager.
 * @interface UseLayerManagerReturn
 * @property {Layer[]} layers - A lista atual de camadas e seus estados de visibilidade.
 * @property {(layerId: string) => void} handleToggleLayer - Alterna a visibilidade de uma camada específica, registrando a ação no histórico.
 */
export interface UseLayerManagerReturn {
  layers: Layer[];
  handleToggleLayer: (layerId: string) => void;
}

/**
 * Hook customizado para gerenciar o estado das camadas de visibilidade e sua manipulação.
 * Inicializa as camadas com `initialLayers` e permite alternar sua visibilidade,
 * registrando a ação no histórico de comandos.
 * @param {UseLayerManagerProps} props As props do hook, incluindo `executeCommand`.
 * @returns {UseLayerManagerReturn} Um objeto contendo o estado das camadas e a função para alternar sua visibilidade.
 */
export function useLayerManager({ executeCommand }: UseLayerManagerProps): UseLayerManagerReturn {
  const [layers, setLayers] = useState<Layer[]>(initialLayers);

  /**
   * Manipula a alternância de visibilidade de uma camada.
   * Cria um comando para o histórico de Undo/Redo e o executa.
   * @param {string} layerId O ID da camada a ser alternada.
   */
  const handleToggleLayer = useCallback((layerId: string) => {
    const layerIndex = layers.findIndex(l => l.id === layerId);
    if (layerIndex === -1) {
      return;
    }

    const oldLayersState = layers.map(l => ({ ...l }));
    const newLayersState = layers.map(l =>
      l.id === layerId ? { ...l, isVisible: !l.isVisible } : { ...l }
    );

    const commandDescription = `Visibilidade da camada "${oldLayersState[layerIndex].name}" ${newLayersState[layerIndex].isVisible ? 'ativada' : 'desativada'}`;

    const command: Command = {
      id: `toggle-layer-${layerId}-${Date.now()}`,
      type: 'LAYER_VISIBILITY',
      description: commandDescription,
      execute: () => {
        setLayers(newLayersState);
      },
      undo: () => {
        setLayers(oldLayersState);
      },
    };
    executeCommand(command);
  }, [layers, executeCommand]);

  return { layers, handleToggleLayer };
}

    