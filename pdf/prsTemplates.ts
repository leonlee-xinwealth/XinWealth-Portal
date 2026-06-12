// pdf/prsTemplates.ts
import type { FormMapping } from './mappingTypes';

/** Browser-side template fetch (vite public directory) */
export async function fetchTemplate(mapping: FormMapping): Promise<ArrayBuffer> {
  const res = await fetch(`/forms/prs/${mapping.templateFile}`);
  if (!res.ok) throw new Error(`模板加载失败: ${mapping.templateFile} (${res.status})`);
  return res.arrayBuffer();
}
