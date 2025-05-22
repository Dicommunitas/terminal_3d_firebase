
"use client";

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VideoIcon } from 'lucide-react';

interface CameraControlsPanelProps {
  systems: string[]; // Changed from PresetCameraView[]
  onSetView: (systemName: string) => void; // Changed from (view: PresetCameraView)
}

export function CameraControlsPanel({ systems, onSetView }: CameraControlsPanelProps) {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <VideoIcon className="mr-2 h-5 w-5" />
          Focus on System
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        {systems.map((systemName) => (
          <Button
            key={systemName}
            variant="outline"
            size="sm"
            onClick={() => onSetView(systemName)}
            className="w-full"
          >
            {systemName}
          </Button>
        ))}
        {systems.length === 0 && (
          <p className="col-span-2 text-sm text-muted-foreground text-center">
            No systems available to focus on.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
