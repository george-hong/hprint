import type { IEditor, IPluginTempl } from '@hprint/core';
import { LengthConvert } from '@hprint/shared';
import { syncMmFromObject } from '../utils/units';
import { fabric } from '@hprint/core';
import { throttle } from 'lodash-es';

type IPlugin = Pick<
    UnitPlugin,
    | 'getUnit'
    | 'setUnit'
    | 'getSizeByUnit'
    | 'applyObjectPx'
    | 'applyObjectMm'
    | 'applyObjectInch'
    | 'applyObjectByUnit'
>;

type TUnit = 'px' | 'mm' | 'inch';

declare module '@hprint/core' {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface IEditor extends IPlugin { }
}

class UnitPlugin implements IPluginTempl {
    static pluginName = 'UnitPlugin';
    //  static events = ['sizeChange'];
    static apis = [
        'getUnit',
        'setUnit',
        'getSizeByUnit',
        'applyObjectPx',
        'applyObjectMm',
        'applyObjectInch',
        'applyObjectByUnit',
    ];
    unit: TUnit = 'px';
    constructor(
        public canvas: fabric.Canvas,
        public editor: IEditor
    ) {
        this.init();
        this._bindEvents();
    }

    hookSaveBefore() {
        return new Promise((resolve) => {
            resolve(true);
        });
    }

    hookSaveAfter() {
        return new Promise((resolve) => {
            resolve(true);
        });
    }

    init(unit?: TUnit) {
        if (unit) this.unit = unit;
    }

    setUnit(unit: TUnit) {
        if (this.unit === unit) return;
        this.unit = unit;
        this.editor.emit('unitChange', unit);
    }

    getUnit() {
        return this.unit;
    }

    getSizeByUnit(pxValue: number, unit?: TUnit, dpi?: number) {
        const targetUnit = unit ?? this.editor.getUnit();
        if (targetUnit === 'px') return pxValue;
        if (targetUnit === 'mm') return LengthConvert.pxToMm(pxValue, dpi, { direct: true });
    }

    applyObjectPx(
        obj: fabric.Object,
        opts: {
            left?: number;
            top?: number;
            width?: number;
            height?: number;
            strokeWidth?: number;
            fontSize?: number;
        }
    ) {
        const { left, top, width, height, strokeWidth, fontSize } = opts;
        if (fontSize !== undefined) obj.set('fontSize', fontSize);
        if (strokeWidth !== undefined) obj.set('strokeWidth', strokeWidth);
        if (width !== undefined) obj.set('width', width);
        if (height !== undefined) obj.set('height', height);
        if (left !== undefined) obj.set('left', left);
        if (top !== undefined) obj.set('top', top);
    }

    applyObjectMm(
        obj: fabric.Object,
        mm: {
            left?: number;
            top?: number;
            width?: number;
            height?: number;
            strokeWidth?: number;
            fontSize?: number;
        },
        dpi?: number
    ) {
        const toPx = (v: number | undefined) =>
            v === undefined ? undefined : LengthConvert.mmToPx(v, dpi, { direct: true });
        this.applyObjectPx(obj, {
            left: toPx(mm.left),
            top: toPx(mm.top),
            width: toPx(mm.width),
            height: toPx(mm.height),
            strokeWidth: toPx(mm.strokeWidth),
            fontSize: toPx(mm.fontSize),
        });
        (obj as any)._originSize = { ...(obj as any)._originSize, mm: { ...mm } };
    }

    applyObjectInch(
        obj: fabric.Object,
        inch: {
            left?: number;
            top?: number;
            width?: number;
            height?: number;
            strokeWidth?: number;
            fontSize?: number;
        },
        dpi?: number
    ) {
        const toMm = (v: number | undefined) =>
            v === undefined ? undefined : v * LengthConvert.CONSTANTS.INCH_TO_MM;
        this.applyObjectMm(
            obj,
            {
                left: toMm(inch.left),
                top: toMm(inch.top),
                width: toMm(inch.width),
                height: toMm(inch.height),
                strokeWidth: toMm(inch.strokeWidth),
                fontSize: toMm(inch.fontSize),
            },
            dpi
        );
        (obj as any)._originSize = { ...(obj as any)._originSize, inch: { ...inch } };
    }

    applyObjectByUnit(
        obj: fabric.Object,
        opts: {
            left?: number;
            top?: number;
            width?: number;
            height?: number;
            strokeWidth?: number;
            fontSize?: number;
        },
        dpi?: number
    ) {
        const unit = this.getUnit();
        if (unit === 'mm') return this.applyObjectMm(obj, opts, dpi);
        if (unit === 'inch') return this.applyObjectInch(obj, opts, dpi);
        return this.applyObjectPx(obj, opts);
    }

    _bindEvents() {
        const throttledSync = throttle((obj: fabric.Object) => {
            syncMmFromObject(obj);
        }, 30);

        this.canvas.on('object:modified', (e: any) => {
            const target = e.target as fabric.Object | undefined;
            if (target) syncMmFromObject(target);
        });

        this.canvas.on('object:moving', (e: any) => {
            const target = e.target as fabric.Object | undefined;
            if (target) throttledSync(target);
        });

        this.canvas.on('object:scaling', (e: any) => {
            const target = e.target as fabric.Object | undefined;
            if (target) throttledSync(target);
        });

        this.canvas.on('object:rotating', (e: any) => {
            const target = e.target as fabric.Object | undefined;
            if (target) throttledSync(target);
        });
    }

    destroy() {
        console.log('pluginDestroy');
    }
}

export default UnitPlugin;
