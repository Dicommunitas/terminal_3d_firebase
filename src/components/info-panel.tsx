
"use client";

import type { Equipment, Annotation } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { XIcon, InfoIcon, TagIcon, LocateIcon, ActivityIcon, FileTextIcon, Settings2Icon, MessageSquarePlusIcon, Edit3Icon, Trash2Icon, CalendarDays, PackageIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface InfoPanelProps {
  equipment: Equipment | null;
  annotation: Annotation | null;
  onClose: () => void;
  onOpenAnnotationDialog: () => void;
  onDeleteAnnotation: (equipmentId: string) => void;
  onOperationalStateChange: (equipmentId: string, newState: string) => void;
  availableOperationalStatesList: string[];
}

export function InfoPanel({ 
  equipment, 
  annotation, 
  onClose, 
  onOpenAnnotationDialog, 
  onDeleteAnnotation,
  onOperationalStateChange,
  availableOperationalStatesList 
}: InfoPanelProps) {
  if (!equipment) return null;

  const handleDeleteClick = () => {
    if (equipment) {
      onDeleteAnnotation(equipment.id);
    }
  };
  
  const formattedDate = annotation?.createdAt ? format(parseISO(annotation.createdAt), "dd/MM/yyyy HH:mm") : null;

  return (
    <Card className="absolute top-4 right-4 w-80 shadow-xl z-20 bg-card/90 backdrop-blur-sm max-h-[calc(100vh-2rem)] flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center">
          <InfoIcon className="mr-2 h-5 w-5 text-primary" />
          Detalhes
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close info panel">
          <XIcon className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-1.5 pb-3 overflow-y-auto flex-grow">
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
         {equipment.product && (
          <p className="text-sm flex items-center">
            <PackageIcon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
            Produto: {equipment.product}
          </p>
        )}
        {equipment.operationalState && (
          <div className="space-y-1 text-sm">
            <Label htmlFor={`op-state-select-${equipment.id}`} className="flex items-center text-xs font-normal text-muted-foreground">
              <ActivityIcon className="mr-1.5 h-3.5 w-3.5" />
              Estado Operacional:
            </Label>
            <Select
              value={equipment.operationalState}
              onValueChange={(newState) => onOperationalStateChange(equipment.id, newState)}
              disabled={equipment.operationalState === "Não aplicável"}
            >
              <SelectTrigger id={`op-state-select-${equipment.id}`} className="h-8 text-xs">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {availableOperationalStatesList.map(state => (
                  <SelectItem key={state} value={state} className="text-xs">
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {equipment.details && (
          <div className="text-sm pt-2">
            <div className="flex items-center text-muted-foreground">
              <FileTextIcon className="mr-1.5 h-3.5 w-3.5" />
              <span>Detalhes:</span>
            </div>
            <p className="italic pl-5 text-xs">{equipment.details}</p>
          </div>
        )}
        <Separator className="my-3"/>
        {annotation ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center"><Edit3Icon className="mr-2 h-4 w-4 text-primary"/>Anotação</h4>
                {formattedDate && (
                    <span className="text-xs text-muted-foreground flex items-center">
                        <CalendarDays className="mr-1 h-3 w-3" /> {formattedDate}
                    </span>
                )}
            </div>
            <p className="text-xs bg-muted/50 p-2 rounded whitespace-pre-wrap break-words">{annotation.text}</p>
            <div className="flex space-x-2 pt-1">
              <Button onClick={onOpenAnnotationDialog} size="sm" variant="outline" className="flex-1">
                <Edit3Icon className="mr-2 h-4 w-4" /> Editar
              </Button>
              <Button onClick={handleDeleteClick} size="sm" variant="destructive" className="flex-1">
                <Trash2Icon className="mr-2 h-4 w-4" /> Excluir
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={onOpenAnnotationDialog} size="sm" className="w-full">
            <MessageSquarePlusIcon className="mr-2 h-4 w-4" /> Adicionar Anotação
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
