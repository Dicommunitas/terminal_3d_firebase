
/**
 * @fileoverview Componente de diálogo modal para adicionar ou editar anotações textuais
 * associadas a um equipamento. Utiliza um Textarea para permitir anotações de texto longo.
 */
"use client";

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Annotation } from '@/lib/types';

/**
 * Props para o componente AnnotationDialog.
 * @interface AnnotationDialogProps
 * @property {boolean} isOpen - Controla se o diálogo está aberto ou fechado.
 * @property {(isOpen: boolean) => void} onOpenChange - Callback para quando o estado de abertura do diálogo muda.
 * @property {(text: string) => void} onConfirm - Callback para confirmar e salvar a anotação, passando o texto inserido.
 * @property {Annotation | null} currentAnnotation - A anotação atual sendo editada, ou null se for uma nova anotação.
 * @property {string} equipmentName - O nome do equipamento ao qual a anotação se refere, para exibição no diálogo.
 */
interface AnnotationDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (text: string) => void;
  currentAnnotation: Annotation | null;
  equipmentName: string;
}

/**
 * Renderiza um diálogo modal para o usuário inserir ou editar o texto de uma anotação.
 * Exibe o nome do equipamento associado e um Textarea para o texto da anotação.
 * @param {AnnotationDialogProps} props As props do componente.
 * @returns {JSX.Element} O componente AnnotationDialog.
 */
export function AnnotationDialog({ isOpen, onOpenChange, onConfirm, currentAnnotation, equipmentName }: AnnotationDialogProps): JSX.Element {
  const [annotationText, setAnnotationText] = useState('');

  /**
   * Efeito para popular o campo de texto quando o diálogo é aberto ou a anotação atual muda.
   */
  useEffect(() => {
    if (isOpen) {
      setAnnotationText(currentAnnotation?.text || '');
    }
  }, [isOpen, currentAnnotation]);

  /**
   * Manipula a confirmação do diálogo, chamando o callback `onConfirm` com o texto atual
   * e fechando o diálogo.
   */
  const handleConfirm = () => {
    onConfirm(annotationText);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{currentAnnotation ? 'Editar Anotação' : 'Adicionar Anotação'}</DialogTitle>
          <DialogDescription>
            {currentAnnotation ? `Editando anotação para` : `Adicionar uma anotação para`} {equipmentName ? `"${equipmentName}"` : "o equipamento selecionado"}.
            A data de criação/modificação será registrada automaticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 items-start gap-2">
            <Label htmlFor="annotation-text" className="text-left">
              Texto da Anotação
            </Label>
            <Textarea
              id="annotation-text"
              value={annotationText}
              onChange={(e) => setAnnotationText(e.target.value)}
              placeholder="Digite sua anotação aqui..."
              rows={5}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleConfirm}>
            Salvar Anotação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    