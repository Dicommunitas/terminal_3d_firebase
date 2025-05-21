"use client";

import type { Equipment } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XIcon, InfoIcon } from 'lucide-react';

interface InfoPanelProps {
  equipment: Equipment | null;
  onClose: () => void;
}

export function InfoPanel({ equipment, onClose }: InfoPanelProps) {
  if (!equipment) return null;

  return (
    <Card className="absolute top-4 right-4 w-80 shadow-xl z-10 bg-card/90 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center">
          <InfoIcon className="mr-2 h-5 w-5 text-primary" />
          Details
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close info panel">
          <XIcon className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <h3 className="text-md font-semibold mb-1">{equipment.name}</h3>
        <CardDescription className="text-xs mb-2">Type: {equipment.type}</CardDescription>
        <p className="text-sm mb-1">ID: <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{equipment.id}</span></p>
        <p className="text-sm mb-1">
          Position: (
            {equipment.position.x.toFixed(1)}, 
            {equipment.position.y.toFixed(1)}, 
            {equipment.position.z.toFixed(1)}
          )
        </p>
        <p className="text-sm italic">{equipment.details}</p>
      </CardContent>
    </Card>
  );
}
