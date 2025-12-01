import { fabric } from 'fabric';
import type { IEditor, IPluginTempl } from '@hprint/core';

type IPlugin = Pick<
    RulerPlugin,
    'hideGuideline' | 'showGuideline' | 'rulerEnable' | 'rulerDisable'
>;

declare module '@hprint/core' {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface IEditor extends IPlugin {}
}

import initRuler from '../ruler';

class RulerPlugin implements IPluginTempl {
    static pluginName = 'RulerPlugin';
    //  static events = ['sizeChange'];
    static apis = [
        'hideGuideline',
        'showGuideline',
        'rulerEnable',
        'rulerDisable',
    ];
    ruler: any;
    constructor(
        public canvas: fabric.Canvas,
        public editor: IEditor
    ) {
        this.init();
    }

    hookSaveBefore() {
        return new Promise((resolve) => {
            this.hideGuideline();
            resolve(true);
        });
    }

    hookSaveAfter() {
        return new Promise((resolve) => {
            this.showGuideline();
            resolve(true);
        });
    }

    init() {
        this.ruler = initRuler(this.canvas, this.editor, {
            unit: this.editor.getUnit?.() || 'px',
        });
        // 监听全局单位变化，更新标尺展示
        this.editor.on?.('unitChange', (unit: 'px' | 'mm') => {
            this.ruler?.setUnit?.(unit);
        });
    }

    hideGuideline() {
        this.ruler.hideGuideline();
    }

    showGuideline() {
        this.ruler.showGuideline();
    }

    rulerEnable() {
        this.ruler.enable();
    }

    rulerDisable() {
        this.ruler.disable();
    }

    destroy() {
        console.log('pluginDestroy');
    }
}

export default RulerPlugin;
