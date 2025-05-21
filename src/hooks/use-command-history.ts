"use client";

import type { Command } from '@/lib/types';
import { useState, useCallback } from 'react';

interface CommandHistoryState {
  history: Command[];
  currentIndex: number; // Points to the last executed command
}

export function useCommandHistory(initialState?: CommandHistoryState) {
  const [state, setState] = useState<CommandHistoryState>(
    initialState || { history: [], currentIndex: -1 }
  );

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

  const undo = useCallback(() => {
    setState((prevState) => {
      if (prevState.currentIndex < 0) return prevState;
      const commandToUndo = prevState.history[prevState.currentIndex];
      commandToUndo.undo();
      return {
        ...prevState,
        currentIndex: prevState.currentIndex - 1,
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((prevState) => {
      if (prevState.currentIndex >= prevState.history.length - 1) return prevState;
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
