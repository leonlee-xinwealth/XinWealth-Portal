// pdf/fillEngine.ts
import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { FormMapping, CheckboxField, CombField, DateSplitField, TextField } from './mappingTypes';
import type { PrsFormData } from '../types/prs';
import { fitTextSize, combChars, splitDateDDMMYYYY, MIN_FONT_SIZE } from './textFit';

export interface FillResult {
  bytes: Uint8Array;
  warnings: string[];
}

/** 按点路径取值，任何缺段返回 '' */
export function resolveValue(data: PrsFormData, path: string): string {
  let cur: unknown = data;
  for (const part of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return '';
    cur = (cur as Record<string, unknown>)[part];
  }
  if (cur == null || cur === false) return '';
  if (cur === true) return 'true';
  return String(cur);
}

export async function fillForm(
  templateBytes: Uint8Array | ArrayBuffer,
  mapping: FormMapping,
  data: PrsFormData
): Promise<FillResult> {
  // top-up.pdf 模板带加密标记，需 ignoreEncryption 才能加载
  const doc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const warnings: string[] = [];

  for (const f of mapping.fields) {
    const page = pages[f.page];
    if (!page) {
      warnings.push(`[${mapping.id}] ${f.key}: 页码 ${f.page} 不存在（共 ${pages.length} 页）`);
      continue;
    }
    const type = f.type ?? 'text';

    if (type === 'checkbox') {
      const cf = f as CheckboxField;
      if (cf.when(data)) {
        page.drawText('X', { x: cf.x, y: cf.y, size: cf.size ?? 10, font });
      }
      continue;
    }

    const raw = resolveValue(data, f.key);
    if (!raw) continue; // 缺失字段留空，照样生成

    if (type === 'text') {
      const tf = f as TextField;
      const value = (tf.uppercase ?? true) ? raw.toUpperCase() : raw;
      let size = tf.size ?? 9;
      if (tf.maxWidth) {
        const fitted = fitTextSize(s => font.widthOfTextAtSize(value, s), size, tf.maxWidth);
        if (fitted == null) {
          warnings.push(`[${mapping.id}] ${tf.key}: 文字超长，已用最小字号仍可能溢出`);
          size = MIN_FONT_SIZE;
        } else {
          size = fitted;
        }
      }
      page.drawText(value, { x: tf.x, y: tf.y, size, font });
    } else if (type === 'comb') {
      const cf = f as CombField;
      const chars = combChars(raw.toUpperCase(), cf.strip);
      if (chars.length > cf.cells) {
        warnings.push(`[${mapping.id}] ${cf.key}: 内容 ${chars.length} 字超出 ${cf.cells} 格，已截断`);
      }
      chars.slice(0, cf.cells).forEach((ch, i) => {
        page.drawText(ch, { x: cf.x + i * cf.cellWidth, y: cf.y, size: cf.size ?? 9, font });
      });
    } else if (type === 'date-split') {
      const df = f as DateSplitField;
      const digits = splitDateDDMMYYYY(raw);
      if (!digits) {
        warnings.push(`[${mapping.id}] ${df.key}: 日期格式无效（${raw}）`);
        continue;
      }
      [...digits].forEach((ch, i) => {
        page.drawText(ch, { x: df.x + i * df.cellWidth, y: df.y, size: df.size ?? 9, font });
      });
    }
  }

  return { bytes: await doc.save(), warnings };
}
