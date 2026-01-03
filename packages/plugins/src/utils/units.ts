import { fabric, IEditor } from '@hprint/core';
import { LengthConvert } from '@hprint/shared';

export type MmOptions = {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  strokeWidth?: number;
  fontSize?: number;
};

export function applyMmToObject(
  obj: fabric.Object,
  mm: MmOptions,
  dpi?: number
) {
  const toPx = (v: number | undefined) =>
    v === undefined ? undefined : LengthConvert.mmToPx(v, dpi, { direct: true });
  const leftPx = toPx(mm.left);
  const topPx = toPx(mm.top);
  const widthPx = toPx(mm.width);
  const heightPx = toPx(mm.height);
  const strokeWidthPx = toPx(mm.strokeWidth);
  const fontSizePx = toPx(mm.fontSize);

  if (leftPx !== undefined) obj.set('left', leftPx);
  if (topPx !== undefined) obj.set('top', topPx);
  if (widthPx !== undefined) obj.set('width', widthPx);
  if (heightPx !== undefined) obj.set('height', heightPx);
  if (strokeWidthPx !== undefined) obj.set('strokeWidth', strokeWidthPx);
  if (fontSizePx !== undefined) (obj as any).fontSize = fontSizePx;

  // Preserve the existing extension property from _originSize.mm
  const existingMm = (obj as any)._originSize?.mm || {};
  const extension = existingMm.extension;

  (obj as any)._originSize = {
    ...(obj as any)._originSize,
    mm: {
      left: mm.left,
      top: mm.top,
      width: mm.width,
      height: mm.height,
      strokeWidth: mm.strokeWidth,
      fontSize: mm.fontSize,
      // Preserve extension if it exists
      ...(extension !== undefined ? { extension } : {}),
    },
  };
}

export function syncMmFromObject(obj: fabric.Object, dpi?: number, precision?: number) {
  const isImage = obj.type === 'image';
  const toMm = (v: number | undefined) =>
    v === undefined ? undefined : applyPrecision(LengthConvert.pxToMm(v, dpi), precision);
  const left = obj.left as number | undefined;
  const top = obj.top as number | undefined;
  // 图片的width是图片的实际宽度，应取在画布中绘制用的宽度obj.getScaledWidth()
  const width = isImage ? obj.getScaledWidth() : obj.width as number | undefined;
  const height = isImage ? obj.getScaledHeight() : obj.height as number | undefined;
  const strokeWidth = obj.strokeWidth as number | undefined;
  const fontSize = (obj as any).fontSize as number | undefined;

  // Preserve the existing extension property from _originSize.mm
  const existingMm = (obj as any)._originSize?.mm || {};
  const extension = existingMm.extension;

  (obj as any)._originSize = {
    ...(obj as any)._originSize,
    mm: {
      left: toMm(left),
      top: toMm(top),
      width: toMm(width),
      height: toMm(height),
      strokeWidth: toMm(strokeWidth),
      fontSize: toMm(fontSize),
      // Preserve extension if it exists
      ...(extension !== undefined ? { extension } : {}),
    },
  };
}

export type UnitType = 'px' | 'mm' | 'inch';

export function getUnit(editor: IEditor): UnitType {
  return (editor as any).getUnit?.() ?? 'px';
}

export function convertSingle(
  value: number | string,
  unit: UnitType,
  dpi?: number
): number {
  if (unit === 'px') return typeof value === 'string' ? Number(value) : value;
  if (unit === 'mm') return LengthConvert.mmToPx(value as any, dpi, { direct: true });
  const num = typeof value === 'string' ? Number(value) : (value as number);
  return LengthConvert.mmToPx(num * LengthConvert.CONSTANTS.INCH_TO_MM, dpi, { direct: true });
}

export function processOptions(
  opts: Record<string, any> = {},
  unit: UnitType,
  dpi?: number,
  fields: string[] = ['left', 'top', 'width', 'height', 'fontSize', 'boxWidth']
): { processed: Record<string, number>; originByUnit: Record<string, Record<string, any>> } {
  const fieldSet = new Set(fields);
  const processed: Record<string, number> = {};
  const originUnit: Record<string, any> = {};
  for (const key of Object.keys(opts)) {
    if (!fieldSet.has(key)) continue;
    const val = opts[key];
    if (val === undefined) continue;
    originUnit[key] = val;
    processed[key] = convertSingle(val, unit, dpi);
  }
  return { processed, originByUnit: { [unit]: originUnit } };
}

export function applyPrecision(value: number, precision?: number) {
  if (precision === undefined) return value;
  const factor = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
}

function applyPrecisionDeep(value: any, precision?: number): any {
  if (typeof value === 'number') return applyPrecision(value, precision);
  if (Array.isArray(value)) return value.map((item) => applyPrecisionDeep(item, precision));
  if (value && typeof value === 'object') {
    const result: Record<string, any> = {};
    Object.keys(value).forEach((key) => {
      result[key] = applyPrecisionDeep(value[key], precision);
    });
    return result;
  }
  return value;
}

export function formatOriginValues(origin: Record<string, any>, precision?: number): Record<string, any> {
  return applyPrecisionDeep(origin, precision);
}

export function formatFixedString(num: number, precision = 2): string {
  const s = Number(num).toFixed(precision);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

