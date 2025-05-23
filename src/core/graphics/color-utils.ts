
/**
 * @fileoverview Utilitários para determinar a cor dos equipamentos na cena 3D
 * com base no modo de colorização selecionado e nos atributos do equipamento.
 *
 * Responsabilidades:
 * - Fornecer uma função `getEquipmentColor` que calcula a cor final de um equipamento.
 * - Implementar a lógica de coloração para os modos:
 *   - 'Equipamento': Usa a cor base definida nos dados do equipamento.
 *   - 'Estado Operacional': Mapeia estados operacionais específicos para cores predefinidas.
 *   - 'Produto': Gera uma cor proceduralmente a partir dos três primeiros caracteres do código do produto.
 * - Incluir uma função auxiliar `getCharNumericValue` para a coloração por produto.
 */
import * as THREE from 'three';
import type { Equipment, ColorMode } from '@/lib/types';

/**
 * Converte um caractere ('0'-'9' ou 'A'-'Z') para um valor numérico.
 * '0'-'9' mapeiam para 0-9.
 * 'A'-'Z' (case-insensitive) mapeiam para 10-35.
 * Esta função é usada para gerar cores com base em códigos de produto.
 * @param {string} char O caractere a ser convertido.
 * @returns {number} O valor numérico correspondente (0-35), ou 0 para caracteres inválidos/não mapeados.
 */
function getCharNumericValue(char: string): number {
  const upperChar = char.toUpperCase();
  if (char >= '0' && char <= '9') {
    return parseInt(char, 10);
  } else if (upperChar >= 'A' && upperChar <= 'Z') {
    return upperChar.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
  }
  return 0; // Retorna 0 para caracteres não mapeados para evitar erros
}

/**
 * Determina a cor final de um equipamento com base no modo de colorização e seus atributos.
 * @param {Equipment} item O equipamento para o qual a cor será determinada.
 * @param {ColorMode} colorMode O modo de colorização selecionado ('Equipamento', 'Estado Operacional', 'Produto').
 * @returns {THREE.Color} A cor calculada para o equipamento.
 */
export function getEquipmentColor(item: Equipment, colorMode: ColorMode): THREE.Color {
  const baseColor = new THREE.Color(item.color);
  let finalColor = new THREE.Color();

  switch (colorMode) {
    case 'Produto':
      if (item.product && item.product !== "Não aplicável" && item.product.length >= 3) {
        const rVal = getCharNumericValue(item.product.charAt(0));
        const gVal = getCharNumericValue(item.product.charAt(1));
        const bVal = getCharNumericValue(item.product.charAt(2));
        // Normaliza baseado no range 0-35 para cada componente de cor (0.0 a 1.0)
        finalColor.setRGB(rVal / 35.0, gVal / 35.0, bVal / 35.0);
      } else {
        finalColor.copy(baseColor); // Cor base se o produto não for aplicável ou inválido
      }
      break;
    case 'Estado Operacional':
      // Mapeamento de cores para estados operacionais
      switch (item.operationalState) {
        case 'operando': finalColor.setHex(0xFF0000); break;       // Vermelho
        case 'não operando': finalColor.setHex(0x00FF00); break; // Verde
        case 'manutenção': finalColor.setHex(0xFFFF00); break;   // Amarelo
        case 'em falha': finalColor.setHex(0xDA70D6); break;       // Roxo Orchid (quase rosa)
        case 'Não aplicável':                                     // Cor base para "Não aplicável"
        default:
          finalColor.copy(baseColor); 
          break;
      }
      break;
    case 'Equipamento':
    default:
      finalColor.copy(baseColor); // Cor base padrão do equipamento
      break;
  }
  return finalColor;
}
