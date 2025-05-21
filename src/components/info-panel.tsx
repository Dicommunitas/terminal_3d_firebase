
"use client";

import type { Equipment } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XIcon, InfoIcon, TagIcon, LocateIcon, ActivityIcon, FileTextIcon, Settings2Icon, MessageSquarePlusIcon } from 'lucide-react';

interface InfoPanelProps {
  equipment: Equipment | null;
  onClose: () => void;
  onOpenAddAnnotationDialog: () => void;
}

export function InfoPanel({ equipment, onClose, onOpenAddAnnotationDialog }: InfoPanelProps) {
  if (!equipment) return null;

  return (
    <Card className="absolute top-4 right-4 w-80 shadow-xl z-10 bg-card/90 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center">
          <InfoIcon className="mr-2 h-5 w-5 text-primary" />
          Detalhes
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close info panel">
          <XIcon className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-1 pb-3">
        <h3 className="text-md font-semibold">{equipment.name}</h3>
        <p className="text-sm">
          ID: <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{equipment.id}</span>
        </p>
        <p className="text-sm">Tipo: {equipment.type}</p>
        {equipment.sistema && (
          <p className="text-sm flex items-center">
            <Settings2Icon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
            Sistema: {equipment.sistema}
          </p>
        )}
        {equipment.area && (
          <p className="text-sm flex items-center">
            <LocateIcon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
            Área: {equipment.area}
          </p>
        )}
        {equipment.operationalState && (
           <p className="text-sm flex items-center">
           <ActivityIcon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
           Estado Operacional: {equipment.operationalState}
         </p>
        )}
        {equipment.details && (
          <div className="text-sm pt-1">
            <div className="flex items-center">
              <FileTextIcon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
              <span>Detalhes:</span>
            </div>
            <p className="italic pl-5">{equipment.details}</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="p-3 pt-0">
        <Button onClick={onOpenAddAnnotationDialog} size="sm" className="w-full">
          <MessageSquarePlusIcon className="mr-2 h-4 w-4" /> Adicionar Anotação
        </Button>
      </CardFooter>
    </Card>
  );
}
