"use client";

import { Button } from '@/components/ui/button';
import { Undo2Icon, Redo2Icon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CommandHistoryPanelProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export function CommandHistoryPanel({ canUndo, canRedo, onUndo, onRedo }: CommandHistoryPanelProps) {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M12 20v-6M6 20V10M18 20V4"/><path d="m18 4-4 4h4Z"/><path d="m6 10-4 4h4Z"/></svg>
          History
        </CardTitle>
      </CardHeader>
      <CardContent className="flex space-x-2">
        <Button variant="outline" onClick={onUndo} disabled={!canUndo} className="flex-1">
          <Undo2Icon className="mr-2 h-4 w-4" /> Undo
        </Button>
        <Button variant="outline" onClick={onRedo} disabled={!canRedo} className="flex-1">
          <Redo2Icon className="mr-2 h-4 w-4" /> Redo
        </Button>
      </CardContent>
    </Card>
  );
}
