import { fabric } from '@hprint/core';
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

  (obj as any)._originSize = {
    ...(obj as any)._originSize,
    mm: {
      left: mm.left,
      top: mm.top,
      width: mm.width,
      height: mm.height,
      strokeWidth: mm.strokeWidth,
      fontSize: mm.fontSize,
    },
  };
}

export function syncMmFromObject(obj: fabric.Object, dpi?: number) {
  const toMm = (v: number | undefined) =>
    v === undefined ? undefined : LengthConvert.pxToMm(v, dpi);
  const left = obj.left as number | undefined;
  const top = obj.top as number | undefined;
  const width = obj.width as number | undefined;
  const height = obj.height as number | undefined;
  const strokeWidth = obj.strokeWidth as number | undefined;
  const fontSize = (obj as any).fontSize as number | undefined;

  (obj as any)._originSize = {
    ...(obj as any)._originSize,
    mm: {
      left: toMm(left),
      top: toMm(top),
      width: toMm(width),
      height: toMm(height),
      strokeWidth: toMm(strokeWidth),
      fontSize: toMm(fontSize),
    },
  };
}

