import type { IEditor, IPluginTempl } from '@hprint/core';
import { LengthConvert } from '@hprint/shared';
import { applyMmToObject, syncMmFromObject, MmOptions } from '../utils/units';
import { fabric } from '@hprint/shared';

type IPlugin = Pick<
    UnitPlugin,
    'getUnit' | 'setUnit' | 'getSizeByUnit' | 'getCurrentSizeByPx'
>;

type TUnit = 'px' | 'mm';

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
        'getCurrentSizeByPx',
        'applyMmToObject',
        'setOriginSize',
        'getOriginSize',
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

    getSizeByUnit(px: number | string, unit?: TUnit) {
        const curUnit = unit || this.unit;
        if (curUnit === 'mm') {
            return LengthConvert.pxToMm(px);
        }
        return Number(px);
    }

    getCurrentSizeByPx(px: number | string) {
        switch (this.unit) {
            case 'mm':
                return LengthConvert.mmToPx(px);
            default:
                return px;
        }
    }

    applyMmToObject(obj: fabric.Object, mm: MmOptions, dpi?: number) {
        applyMmToObject(obj, mm, dpi);
    }

    setOriginSize(
        obj: fabric.Object,
        unit: 'px' | 'mm' | 'inch',
        size: {
            left?: number;
            top?: number;
            width?: number;
            height?: number;
            strokeWidth?: number;
            fontSize?: number;
        }
    ) {
        (obj as any)._originSize = {
            ...(obj as any)._originSize,
            [unit]: { ...size },
        };
    }

    getOriginSize(obj: fabric.Object) {
        return (obj as any)._originSize;
    }

    _bindEvents() {
        this.canvas.on('object:modified', (e: any) => {
            const target = e.target as fabric.Object | undefined;
            if (target) syncMmFromObject(target);
        });
    }

    destroy() {
        console.log('pluginDestroy');
    }
}

export default UnitPlugin;
