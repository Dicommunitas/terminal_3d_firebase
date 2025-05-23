
/**
 * Custom hook that provides functionality for managing a history of commands, allowing for undo and redo operations.
 *
 */

import type { Command } from '@/lib/types';
import { useState, useCallback } from 'react';

/**
 * Interface para o estado do histórico de comandos.
 * @interface CommandHistoryState
 * @property {Command[]} history - Array de comandos executados.
 * @property {number} currentIndex - Índice do último comando executado no array `history`.
 *                                  Um valor de -1 indica que o histórico está vazio ou todos os comandos foram desfeitos.
 */
interface CommandHistoryState {
  history: Command[];
  currentIndex: number;
}

/**
 * Retorno do hook useCommandHistory.
 * @interface UseCommandHistoryReturn
 * @property {(command: Command) => void} executeCommand - Executa um comando e o adiciona ao histórico, limpando o histórico de "redo" futuro.
 * @property {() => void} undo - Desfaz o último comando executado, se houver.
 * @property {() => void} redo - Refaz o último comando desfeito, se houver.
 * @property {boolean} canUndo - Indica se há comandos para desfazer.
 * @property {boolean} canRedo - Indica se há comandos para refazer.
 * @property {Command[]} commandHistory - O array completo do histórico de comandos (para fins de depuração ou logging).
 */
interface UseCommandHistoryReturn {
  executeCommand: (command: Command) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  commandHistory: Command[];
}

/**
 * Hook customizado para gerenciar um histórico de comandos, permitindo Undo e Redo.
 * Armazena uma lista de comandos e o índice atual, permitindo navegar para frente e para trás
 * através das ações do usuário.
 * @param {CommandHistoryState} [initialState] - Estado inicial opcional para o histórico.
 *                                             Padrão: histórico vazio e currentIndex -1.
 * @returns {UseCommandHistoryReturn} Um objeto com funções para executar, desfazer, refazer comandos,
 * e flags indicando se undo/redo são possíveis.
 */
export function useCommandHistory(initialState?: CommandHistoryState): UseCommandHistoryReturn {
  const [state, setState] = useState<CommandHistoryState>(
    initialState || { history: [], currentIndex: -1 }
  );

  /**
   * Executa um comando e o adiciona ao histórico.
   * Qualquer comando refeito após este ponto (comandos "futuros" que foram desfeitos) é descartado do histórico.
   * @param {Command} command O comando a ser executado.
   */
  const executeCommand = useCallback((command: Command) => {
    command.execute();
    setState((prevState) => {
      const newHistory = prevState.history.slice(0, prevState.currentIndex + 1);
      newHistory.push(command);
      return {
        history: newHistory,
        currentIndex: newHistory.length - 1,
      };
    });
  }, []);

  /**
   * Desfaz o último comando executado.
   * Se não houver comandos para desfazer, não faz nada.
   */
  const undo = useCallback(() => {
    setState((prevState) => {
      if (prevState.currentIndex < 0) {
        return prevState;
      }
      const commandToUndo = prevState.history[prevState.currentIndex];
      commandToUndo.undo();
      return {
        ...prevState,
        currentIndex: prevState.currentIndex - 1,
      };
    });
  }, []);

  /**
   * Refaz o último comando desfeito.
   * Se não houver comandos para refazer, não faz nada.
   */
  const redo = useCallback(() => {
    setState((prevState) => {
      if (prevState.currentIndex >= prevState.history.length - 1) {
        return prevState;
      }
      const commandToRedo = prevState.history[prevState.currentIndex + 1];
      commandToRedo.execute();
      return {
        ...prevState,
        currentIndex: prevState.currentIndex + 1,
      };
    });
  }, []);

  const canUndo = state.currentIndex >= 0;
  const canRedo = state.currentIndex < state.history.length - 1;
  const commandHistory = state.history;

  return { executeCommand, undo, redo, canUndo, canRedo, commandHistory };
}

    