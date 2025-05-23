
/**
 * @fileoverview Custom hook para gerenciar o histórico de comandos (Undo/Redo).
 *
 * Responsabilidades:
 * - Manter um histórico dos comandos executados que modificam o estado da aplicação.
 * - Fornecer funcionalidades para desfazer (undo) e refazer (redo) esses comandos.
 * - Cada comando deve implementar métodos `execute` e `undo` e ter uma descrição.
 * - Gerencia comandos para movimentação de câmera, visibilidade de camadas e seleção de equipamentos.
 * - Não gerencia o histórico de operações de anotação ou mudanças diretas nos dados dos equipamentos (estado operacional, produto).
 */
"use client";

import type { Command } from '@/lib/types';
import { useState, useCallback } from 'react';

/**
 * Interface para o estado do histórico de comandos.
 * @interface CommandHistoryState
 * @property {Command[]} history - Array de comandos executados.
 * @property {number} currentIndex - Índice do último comando executado no array `history`. Um valor de -1 indica que o histórico está vazio ou todos os comandos foram desfeitos.
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
 * @property {Command[]} commandHistory - O array completo do histórico de comandos (para fins de depuração ou logging, se necessário).
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
 * @param {CommandHistoryState} [initialState] - Estado inicial opcional para o histórico.
 *                                             Padrão: histórico vazio e currentIndex -1.
 * @returns {UseCommandHistoryReturn} Um objeto com funções para executar, desfazer, refazer comandos,
 * e flags indicando se undo/redo são possíveis, além do próprio histórico.
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
    // console.log(`[CommandHistory] Executing command: ${command.description}`);
    command.execute();
    setState((prevState) => {
      // Remove any "future" commands that were undone
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
        // console.log("[CommandHistory] Nothing to undo.");
        return prevState;
      }
      const commandToUndo = prevState.history[prevState.currentIndex];
      // console.log(`[CommandHistory] Undoing command: ${commandToUndo.description}`);
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
        // console.log("[CommandHistory] Nothing to redo.");
        return prevState;
      }
      const commandToRedo = prevState.history[prevState.currentIndex + 1];
      // console.log(`[CommandHistory] Redoing command: ${commandToRedo.description}`);
      commandToRedo.execute();
      return {
        ...prevState,
        currentIndex: prevState.currentIndex + 1,
      };
    });
  }, []);

  const canUndo = state.currentIndex >= 0;
  const canRedo = state.currentIndex < state.history.length - 1;
  const commandHistory = state.history; // Para possível inspeção/depuração

  return { executeCommand, undo, redo, canUndo, canRedo, commandHistory };
}
