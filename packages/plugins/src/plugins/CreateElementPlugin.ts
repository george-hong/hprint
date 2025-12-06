import { fabric } from '@hprint/core';
import type { IEditor, IPluginTempl } from '@hprint/core';
import { LengthConvert } from '@hprint/shared';

type IPlugin = Pick<
    CreateElementPlugin,
    'createRect' | 'createTextbox' | 'createLine' | 'createEllipse' | 'createPolygon' | 'createImageFromURL'
>;


declare module '@hprint/core' {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface IEditor extends IPlugin { }
}

class CreateElementPlugin implements IPluginTempl {
    static pluginName = 'CreateElementPlugin';
    static apis = [
        'createRect',
        'createTextbox',
        'createLine',
        'createEllipse',
        'createPolygon',
        'createImageFromURL',
    ];
    constructor(
        public canvas: fabric.Canvas,
        public editor: IEditor
    ) {
        this.editor = editor;
        this.canvas = canvas;
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

    // Object creation wrappers using current unit
    createRect(
        opts: {
            left?: number;
            top?: number;
            width?: number;
            height?: number;
            strokeWidth?: number;
            fill?: string;
        },
        dpi?: number
    ): fabric.Rect {
        const rect = new fabric.Rect({
            fill: opts.fill,
        });
        this.editor.applyObjectByUnit(rect, opts, dpi);
        return rect;
    }

    createTextbox(
        text: string,
        opts: {
            left?: number;
            top?: number;
            width?: number;
            height?: number;
            fontSize?: number;
            strokeWidth?: number;
            fill?: string;
            fontFamily?: string;
        },
        dpi?: number
    ): fabric.IText {
        const tb = new fabric.IText(text, {
            fill: opts.fill,
            fontFamily: opts.fontFamily,
        });
        this.editor.applyObjectByUnit(tb, opts, dpi);
        return tb;
    }

    createLine(
        opts: {
            x1: number;
            y1: number;
            x2: number;
            y2: number;
            strokeWidth?: number;
            stroke?: string;
        },
        dpi?: number
    ): fabric.Line {
        const toPx = (v: number) =>
            this.editor.getUnit() === 'px'
                ? v
                : this.editor.getUnit() === 'mm'
                    ? LengthConvert.mmToPx(v, dpi, { direct: true })
                    : LengthConvert.mmToPx(
                        v * LengthConvert.CONSTANTS.INCH_TO_MM,
                        dpi,
                        { direct: true }
                    );
        const line = new fabric.Line(
            [toPx(opts.x1), toPx(opts.y1), toPx(opts.x2), toPx(opts.y2)],
            {
                strokeWidth:
                    opts.strokeWidth !== undefined
                        ? toPx(opts.strokeWidth)
                        : undefined,
                stroke: opts.stroke,
            }
        );
        return line;
    }

    createEllipse(
        opts: {
            left?: number;
            top?: number;
            rx?: number;
            ry?: number;
            fill?: string;
            strokeWidth?: number;
        },
        dpi?: number
    ): fabric.Ellipse {
        const ell = new fabric.Ellipse({ fill: opts.fill });
        const unitOpts: any = {
            left: opts.left,
            top: opts.top,
            width: opts.rx !== undefined ? opts.rx * 2 : undefined,
            height: opts.ry !== undefined ? opts.ry * 2 : undefined,
            strokeWidth: opts.strokeWidth,
        };
        this.editor.applyObjectByUnit(ell, unitOpts, dpi);
        if (ell.width && ell.height) {
            ell.rx = ell.width / 2;
            ell.ry = ell.height / 2;
        }
        return ell;
    }

    createPolygon(
        points: Array<{ x: number; y: number }>,
        opts?: { fill?: string; strokeWidth?: number },
        dpi?: number
    ): fabric.Polygon {
        const toPx = (v: number) =>
            this.editor.getUnit() === 'px'
                ? v
                : this.editor.getUnit() === 'mm'
                    ? LengthConvert.mmToPx(v, dpi, { direct: true })
                    : LengthConvert.mmToPx(
                        v * LengthConvert.CONSTANTS.INCH_TO_MM,
                        dpi,
                        { direct: true }
                    );
        const pts = points.map((p) => ({ x: toPx(p.x), y: toPx(p.y) }));
        const poly = new fabric.Polygon(pts, {
            fill: opts?.fill,
        });
        if (opts?.strokeWidth !== undefined) {
            const sw =
                this.editor.getUnit() === 'px'
                    ? opts.strokeWidth
                    : this.editor.getUnit() === 'mm'
                        ? LengthConvert.mmToPx(opts.strokeWidth, dpi, {
                            direct: true,
                        })
                        : LengthConvert.mmToPx(
                            opts.strokeWidth *
                            LengthConvert.CONSTANTS.INCH_TO_MM,
                            dpi,
                            { direct: true }
                        );
            poly.set('strokeWidth', sw!);
        }
        return poly;
    }

    async createImageFromURL(
        url: string,
        opts?: {
            left?: number;
            top?: number;
            width?: number;
            height?: number;
        },
        dpi?: number
    ): Promise<fabric.Image> {
        return new Promise((resolve) => {
            fabric.Image.fromURL(
                url,
                (img) => {
                    if (opts) this.editor.applyObjectByUnit(img, opts, dpi);
                    resolve(img);
                },
                { crossOrigin: 'anonymous' }
            );
        });
    }

    destroy() {
        console.log('pluginDestroy');
    }
}

export default CreateElementPlugin;
