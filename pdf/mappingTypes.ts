// pdf/mappingTypes.ts
import type { PrsFormData } from '../types/prs';

export interface TextField {
  type?: 'text';
  key: string;          // PrsFormData 键，支持点路径如 'nominees.0.name'
  page: number;         // 0-based
  x: number;            // pt，pdf-lib 坐标系原点在左下角
  y: number;
  size?: number;        // 默认 9
  maxWidth?: number;    // 超出则缩字号
  uppercase?: boolean;  // 默认 true（表格要求 BLOCK LETTERS）
}

export interface CombField {
  type: 'comb';
  key: string;
  page: number;
  x: number;            // 第一格中心
  y: number;
  cellWidth: number;    // 格距
  cells: number;        // 格数（超出截断并警告）
  size?: number;
  strip?: RegExp;       // 如 /[\s-]/g 清洗 NRIC
}

export interface CheckboxField {
  type: 'checkbox';
  key: string;          // 仅作标识/校验用
  page: number;
  x: number;
  y: number;
  size?: number;        // 默认 10
  when: (d: PrsFormData) => boolean;
}

export interface DateSplitField {
  type: 'date-split';   // DD MM YYYY 8 格
  key: string;
  page: number;
  x: number;
  y: number;
  cellWidth: number;
  size?: number;
}

export type MappedField = TextField | CombField | CheckboxField | DateSplitField;

export interface FormMapping {
  id: 'acc-opening' | 'isa-individual' | 'ppa-nomination' | 'declaration' | 'top-up';
  templateFile: string;       // 'declaration.pdf'
  labelEn: string;
  labelZh: string;
  /** 模板版本字符串，与 PDF 页脚一致；公司改版时据此提醒重校准 */
  version: string;
  fields: MappedField[];
  /** 生成前缺失警告用：建议填写的 PrsFormData 键 */
  recommendedKeys: string[];
}
