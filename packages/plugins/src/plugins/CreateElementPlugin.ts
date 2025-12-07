import { fabric } from '@hprint/core';
import type { IEditor, IPluginTempl } from '@hprint/core';
import { LengthConvert } from '@hprint/shared';

type IPlugin = Pick<
    CreateElementPlugin,
    | 'createRect'
    | 'createText'
    | 'createIText'
    | 'createLine'
    | 'createEllipse'
    | 'createPolygon'
    | 'createImageFromURL'
>;

declare module '@hprint/core' {
    interface IEditor extends IPlugin { }
}

class CreateElementPlugin implements IPluginTempl {
    static pluginName = 'CreateElementPlugin';
    static apis = [
        'createRect',
        'createText',
        'createLine',
        'createIText',
        'createEllipse',
        'createPolygon',
        'createImageFromURL',
    ];

    static lengthFieldConfigs: Array<{ field: string; dealMethod: 'single' | 'points' }> = [
        { field: 'left', dealMethod: 'single' },
        { field: 'top', dealMethod: 'single' },
        { field: 'width', dealMethod: 'single' },
        { field: 'height', dealMethod: 'single' },
        { field: 'fontSize', dealMethod: 'single' },
        { field: 'strokeWidth', dealMethod: 'single' },
        { field: 'rx', dealMethod: 'single' },
        { field: 'ry', dealMethod: 'single' },
        { field: 'points', dealMethod: 'points' },
    ];

    constructor(
        public canvas: fabric.Canvas,
        public editor: IEditor
    ) { }

    private _getUnit(): 'px' | 'mm' | 'inch' {
        return (this.editor as any).getUnit?.() ?? 'px';
    }

    private _convertSingle(value: number | string, dpi?: number): number {
        const unit = this._getUnit();
        if (unit === 'px') return typeof value === 'string' ? Number(value) : value;
        if (unit === 'mm') return LengthConvert.mmToPx(value as any, dpi, { direct: true });
        return LengthConvert.mmToPx(
            (typeof value === 'string' ? Number(value) : (value as number)) * LengthConvert.CONSTANTS.INCH_TO_MM,
            dpi,
            { direct: true }
        );
    }

    private _processOptions(opts: Record<string, any> = {}, dpi?: number): { processed: Record<string, number>; originByUnit: Record<string, Record<string, any>> } {
        const unit = this._getUnit();
        const fields = new Set(
            CreateElementPlugin.lengthFieldConfigs
                .filter((c) => c.dealMethod === 'single')
                .map((c) => c.field)
        );
        const processed: Record<string, number> = {};
        const originUnit: Record<string, any> = {};
        for (const key of Object.keys(opts)) {
            if (!fields.has(key)) continue;
            const val = opts[key];
            if (val === undefined) continue;
            originUnit[key] = val;
            processed[key] = this._convertSingle(val, dpi);
        }
        return { processed, originByUnit: { [unit]: originUnit } };
    }

    private _processPoints(points: Array<{ x: number; y: number }>, dpi?: number): { processed: Array<{ x: number; y: number }>; originByUnit: Record<string, Record<string, any>> } {
        const hasCfg = CreateElementPlugin.lengthFieldConfigs.some(
            (c) => c.field === 'points' && c.dealMethod === 'points'
        );
        const unit = this._getUnit();
        if (!hasCfg) {
            return { processed: points, originByUnit: { [unit]: {} } };
        }
        const processed = points.map((p) => ({ x: this._convertSingle(p.x, dpi), y: this._convertSingle(p.y, dpi) }));
        const originUnit = { points } as Record<string, any>;
        return { processed, originByUnit: { [unit]: originUnit } };
    }

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
        const { processed, originByUnit } = this._processOptions(opts, dpi);
        const rect = new fabric.Rect({ ...opts, ...processed });
        (rect as any)._originSize = originByUnit;
        return rect;
    }

    createText(
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
            splitByGrapheme?: boolean;
        },
        dpi?: number
    ): fabric.Textbox {
        const { processed, originByUnit } = this._processOptions(opts, dpi);
        const tb = new fabric.Textbox(text, { ...opts, ...processed });
        (tb as any)._originSize = originByUnit;
        return tb;
    }

    createIText(
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
        const { processed, originByUnit } = this._processOptions(opts, dpi);
        const tb = new fabric.IText(text, { ...opts, ...processed });
        (tb as any)._originSize = originByUnit;
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
        const toPx = (v: number) => this._convertSingle(v, dpi);
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
        const unit = this._getUnit();
        const originUnit: Record<string, any> = {};
        if (opts.strokeWidth !== undefined) originUnit.strokeWidth = opts.strokeWidth;
        (line as any)._originSize = { [unit]: originUnit };
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
        const { processed, originByUnit } = this._processOptions(opts, dpi);
        const ell = new fabric.Ellipse({ ...opts, ...processed });
        (ell as any)._originSize = originByUnit;
        return ell;
    }

    createPolygon(
        points: Array<{ x: number; y: number }>,
        opts?: { fill?: string; strokeWidth?: number },
        dpi?: number
    ): fabric.Polygon {
        const { processed: pts, originByUnit: originPoints } = this._processPoints(points, dpi);
        const { processed: optProcessed, originByUnit: originOpts } = this._processOptions(opts || {}, dpi);
        const unit = this._getUnit();
        const poly = new fabric.Polygon(pts, {
            fill: opts?.fill,
        });
        if (opts?.strokeWidth !== undefined) {
            const sw = this._convertSingle(opts.strokeWidth, dpi);
            poly.set('strokeWidth', sw!);
        }
        poly.set({ ...(opts || {}), ...optProcessed });
        const mergedOrigin = { [unit]: { ...(originOpts[unit] || {}), ...(originPoints[unit] || {}) } };
        (poly as any)._originSize = mergedOrigin;
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
                    if (opts) {
                        const { processed, originByUnit } = this._processOptions(opts, dpi);
                        img.set({ ...opts, ...processed });
                        (img as any)._originSize = originByUnit;
                    }
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
