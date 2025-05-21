"use client";

import type { PresetCameraView } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VideoIcon } from 'lucide-react';

interface CameraControlsPanelProps {
  presets: PresetCameraView[];
  onSetView: (view: PresetCameraView) => void;
}

export function CameraControlsPanel({ presets, onSetView }: CameraControlsPanelProps) {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <VideoIcon className="mr-2 h-5 w-5" />
          Camera Views
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.name}
            variant="outline"
            size="sm"
            onClick={() => onSetView(preset)}
            className="w-full"
          >
            {preset.name}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
