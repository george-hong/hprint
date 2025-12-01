import { fabric } from 'fabric';
import type { IEditor, IPluginTempl } from '@hprint/core';
import { LengthConvert } from '@hprint/shared';

type IPlugin = Pick<
    UnitPlugin,
    'getUnit' | 'setUnit' | 'getSizeByUnit' | 'getCurrentSizeByPx'
>;

type TUnit = 'px' | 'mm';

declare module '@hprint/core' {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface IEditor extends IPlugin {}
}

class UnitPlugin implements IPluginTempl {
    static pluginName = 'UnitPlugin';
    //  static events = ['sizeChange'];
    static apis = ['getUnit', 'setUnit', 'getSizeByUnit', 'getCurrentSizeByPx'];
    unit: TUnit = 'px';
    constructor(
        public canvas: fabric.Canvas,
        public editor: IEditor
    ) {
        this.init();
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

    destroy() {
        console.log('pluginDestroy');
    }
}

export default UnitPlugin;
