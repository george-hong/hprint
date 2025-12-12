import { fabric, IEditor, IPluginTempl } from '@hprint/core';
import { v4 as uuid } from 'uuid';
import { getUnit, syncMmFromObject } from '../utils/units';
import { LengthConvert } from '@hprint/shared';

type IPlugin = Pick<AddBaseTypePlugin, 'addObject' | 'createImgByElement'>;

declare module '@hprint/core' {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface IEditor extends IPlugin { }
}

export default class AddBaseTypePlugin implements IPluginTempl {
    static pluginName = 'AddBaseTypePlugin';
    static apis = ['addObject', 'createImgByElement'];
    constructor(
        public canvas: fabric.Canvas,
        public editor: IEditor
    ) {
        this.editor = editor;
        this.canvas = canvas;
    }

    addObject(
        item: fabric.Object,
        optons?: {
            event: DragEvent;
            scale: boolean;
            center: boolean;
        }
    ) {
        const { event = false, scale = false, center = true } = optons || {};
        item.set({
            id: uuid(),
        });
        scale && this._toScale(item);
        event && this._toEvent(item, event);
        this.canvas.add(item);
        if (!event && center) {
            this._toCenter(item);
        }
        this.canvas.setActiveObject(item);
        this.canvas.renderAll();
        this.editor.saveState();
    }

    _toEvent(item: fabric.Object, event: DragEvent) {
        const { left, top } = this.canvas
            .getSelectionElement()
            .getBoundingClientRect();
        if (event.x < left || event.y < top || item.width === undefined) return;
        const point = {
            x: event.x - left,
            y: event.y - top,
        };
        const pointerVpt = this.canvas.restorePointerVpt(point);
        const leftUnit = this.editor.getSizeByUnit?.(pointerVpt.x, undefined, 96);
        const topUnit = this.editor.getSizeByUnit?.(pointerVpt.y, undefined, 96);
        item.set('left', leftUnit);
        item.set('top', topUnit);
    }

    _toCenter(item: fabric.Object) {
        this.canvas.setActiveObject(item);
        this.editor.position('center');
        const leftPx = item.left ?? 0;
        const topPx = item.top ?? 0;
        const leftUnit = this.editor.getSizeByUnit?.(leftPx, undefined, 96) ?? leftPx;
        const topUnit = this.editor.getSizeByUnit?.(topPx, undefined, 96) ?? topPx;
        item.set('left', leftUnit);
        item.set('top', topUnit);
    }

    _toScale(item: fabric.Object) {
        const { width } = this.editor.getWorkspase();
        if (width === undefined) return;
        item.scaleToWidth(width / 2);
    }

    private _syncOriginPosition(item: fabric.Object, dpi?: number) {
        const unit = getUnit(this.editor);
        const prev = (item as any)._originSize || {};
        if (unit === 'px') {
            const originPx = {
                left: item.left,
                top: item.top,
            };
            (item as any)._originSize = { ...prev, px: { ...(prev.px || {}), ...originPx } };
            return;
        }
        if (unit === 'mm') {
            syncMmFromObject(item, dpi);
            return;
        }
        const leftPx = item.left as number | undefined;
        const topPx = item.top as number | undefined;
        const toInch = (v: number | undefined) => {
            if (v === undefined) return undefined;
            const mm = LengthConvert.pxToMm(v, dpi);
            return mm / LengthConvert.CONSTANTS.INCH_TO_MM;
        };
        const originInch = {
            left: toInch(leftPx),
            top: toInch(topPx),
        };
        (item as any)._originSize = { ...prev, inch: { ...(prev.inch || {}), ...originInch } };
    }

    createImgByElement(target: HTMLImageElement) {
        return new Promise((resolve) => {
            const imgType = this.getImageExtension(target.src);
            if (imgType === 'svg') {
                fabric.loadSVGFromURL(target.src, (objects) => {
                    const item = fabric.util.groupSVGElements(objects, {
                        shadow: '',
                        fontFamily: 'arial',
                        name: 'svg元素',
                    });
                    resolve(item);
                });
            } else {
                fabric.Image.fromURL(
                    target.src,
                    (imgEl) => {
                        resolve(imgEl);
                    },
                    { crossOrigin: 'anonymous' }
                );
            }
        });
    }

    getImageExtension(imageUrl: string) {
        const pathParts = imageUrl.split('/');
        const filename = pathParts[pathParts.length - 1];
        const fileParts = filename.split('.');
        return fileParts[fileParts.length - 1];
    }

    destroy() {
        console.log('pluginDestroy');
    }
}
