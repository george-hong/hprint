// 由于这个文件使用了较多其他插件的方法，所以这个插件应当最后加载
import { fabric } from '@hprint/core';
import type { IEditor, IPluginTempl } from '@hprint/core';
import { getUnit, convertSingle, processOptions, formatOriginValues } from '../utils/units';

type IPlugin = Pick<
    CreateElementPlugin,
    | 'createRect'
    | 'createText'
    | 'createIText'
    | 'createLine'
    | 'createEllipse'
    | 'createPolygon'
    | 'createImageFromURL'
    | 'createBarcode'
    | 'createQrcode'
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
        'createBarcode',
        'createQrcode',
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
        { field: 'boxWidth', dealMethod: 'single' },
        { field: 'points', dealMethod: 'points' },
    ];

    constructor(
        public canvas: fabric.Canvas,
        public editor: IEditor
    ) { }



    private _processPoints(points: Array<{ x: number; y: number }>, dpi?: number): { processed: Array<{ x: number; y: number }>; originByUnit: Record<string, Record<string, any>> } {
        const hasCfg = CreateElementPlugin.lengthFieldConfigs.some(
            (c) => c.field === 'points' && c.dealMethod === 'points'
        );
        const unit = getUnit(this.editor);
        if (!hasCfg) {
            return { processed: points, originByUnit: { [unit]: {} } };
        }
        const processed = points.map((p) => ({ x: convertSingle(p.x, unit, dpi), y: convertSingle(p.y, unit, dpi) }));
        const originUnit = { points } as Record<string, any>;
        return { processed, originByUnit: { [unit]: originUnit } };
    }

    /**
     * 覆盖指定对象实例的 set 方法，仅在本插件创建的元素上生效
     */
    private addSetAndSyncByUnit(obj: fabric.Object) {
        const originalSet = obj.set.bind(obj);
        const editorRef = this.editor;
        const singleFields = CreateElementPlugin.lengthFieldConfigs
            .filter((c) => c.dealMethod === 'single')
            .map((c) => c.field);
        const hasPointsField = CreateElementPlugin.lengthFieldConfigs.some(
            (c) => c.field === 'points' && c.dealMethod === 'points'
        );
        const mergeOrigin = (target: any, unit: string, origin: Record<string, any>) => {
            const prev = target._originSize || {};
            const precision = (editorRef as any).getPrecision?.();
            const formatted = formatOriginValues(origin, precision);
            const mergedUnit = { ...(prev[unit] || {}), ...formatted };
            target._originSize = { ...prev, [unit]: mergedUnit };
        };
        (obj as any).setByUnit = function (key: any, value?: any) {
            const unit = getUnit(editorRef);
            const dpi = 96;
            const isTransforming = !!(this.canvas && (this.canvas as any)._currentTransform);
            if (typeof key === 'string') {
                const field = key as keyof fabric.Object;
                if (singleFields.includes(field)) {
                    if (isTransforming) {
                        return originalSet(field, value);
                    }
                    if (value !== undefined) {
                        const processedVal = convertSingle(value, unit, dpi);
                        mergeOrigin(this, unit, { [field]: value });
                        return originalSet(field, processedVal);
                    }
                }
                if (field === 'points' && hasPointsField && Array.isArray(value)) {
                    if (isTransforming) {
                        return originalSet(field, value);
                    }
                    const pts = (value as Array<{ x: number; y: number }>).map((p) => ({
                        x: convertSingle(p.x, unit, dpi),
                        y: convertSingle(p.y, unit, dpi),
                    }));
                    mergeOrigin(this, unit, { points: value });
                    return originalSet(field, pts);
                }
                return originalSet(key, value);
            }
            if (key && typeof key === 'object') {
                const opts = { ...key } as Record<string, any>;
                if (hasPointsField && Array.isArray(opts.points)) {
                    if (isTransforming) {
                        return originalSet(opts);
                    }
                    const pts = (opts.points as Array<{ x: number; y: number }>).map((p) => ({
                        x: convertSingle(p.x, unit, dpi),
                        y: convertSingle(p.y, unit, dpi),
                    }));
                    mergeOrigin(this, unit, { points: opts.points });
                    opts.points = pts;
                }
                if (isTransforming) {
                    return originalSet(opts);
                }
                const { processed, originByUnit } = processOptions(opts, unit, dpi, singleFields);
                const originUnit = originByUnit[unit] || {};
                if (Object.keys(originUnit).length) mergeOrigin(this, unit, originUnit);
                return originalSet({ ...opts, ...processed });
            }
            return originalSet(key, value);
        };
        (obj as any).syncOriginSizeByUnit = function (fieldsOrDpi?: any, dpi?: number) {
            const unit = getUnit(editorRef);
            if (unit === 'px') return;
            const hasFieldsArray = Array.isArray(fieldsOrDpi);
            const dpiVal = hasFieldsArray ? (dpi ?? 96) : (fieldsOrDpi ?? 96);
            const ratio = convertSingle(1, unit, dpiVal) || 1;
            const origin: Record<string, any> = {};
            const targetFields: string[] =
                hasFieldsArray && (fieldsOrDpi as string[])?.length ? (fieldsOrDpi as string[]) : singleFields;
            targetFields.forEach((field) => {
                if (field === 'points') return;
                const currentVal = (this as any).get ? (this as any).get(field) : (this as any)[field];
                if (typeof currentVal === 'number' && !isNaN(currentVal)) {
                    origin[field] = editorRef.getSizeByUnit(currentVal);
                }
            });
            const shouldSyncPoints =
                hasPointsField &&
                Array.isArray((this as any).points) &&
                ((hasFieldsArray && (fieldsOrDpi as string[]).includes('points')) || !hasFieldsArray);
            if (shouldSyncPoints) {
                const pts = ((this as any).points as Array<{ x: number; y: number }>).map((p) => ({
                    x: p.x / ratio,
                    y: p.y / ratio,
                }));
                origin.points = pts;
            }
            if (Object.keys(origin).length) {
                mergeOrigin(this, unit, origin);
            }
        };
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
        const unit = getUnit(this.editor);
        const singleFields = CreateElementPlugin.lengthFieldConfigs.filter((c) => c.dealMethod === 'single').map((c) => c.field);
        const { processed, originByUnit } = processOptions(opts, unit, dpi, singleFields);
        const precision = (this.editor as any).getPrecision?.();
        const formattedOrigin = { [unit]: formatOriginValues(originByUnit[unit] || {}, precision) };
        const rect = new fabric.Rect({ ...opts, ...processed });
        (rect as any)._originSize = formattedOrigin;
        this.addSetAndSyncByUnit(rect);
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
        const unit = getUnit(this.editor);
        const singleFields = CreateElementPlugin.lengthFieldConfigs.filter((c) => c.dealMethod === 'single').map((c) => c.field);
        const { processed, originByUnit } = processOptions(opts, unit, dpi, singleFields);
        const precision = (this.editor as any).getPrecision?.();
        const formattedOrigin = { [unit]: formatOriginValues(originByUnit[unit] || {}, precision) };
        const tb = new fabric.Textbox(text, { ...opts, ...processed });
        (tb as any)._originSize = formattedOrigin;
        this.addSetAndSyncByUnit(tb);
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
        const unit = getUnit(this.editor);
        const singleFields = CreateElementPlugin.lengthFieldConfigs.filter((c) => c.dealMethod === 'single').map((c) => c.field);
        const { processed, originByUnit } = processOptions(opts, unit, dpi, singleFields);
        const precision = (this.editor as any).getPrecision?.();
        const formattedOrigin = { [unit]: formatOriginValues(originByUnit[unit] || {}, precision) };
        const tb = new fabric.IText(text, { ...opts, ...processed });
        (tb as any)._originSize = formattedOrigin;
        this.addSetAndSyncByUnit(tb);
        return tb;
    }

    createLine(
        points: Array<{ x: number; y: number }>,
        opts?: { strokeWidth?: number; stroke?: string },
        dpi?: number
    ): fabric.Line {
        const unit = getUnit(this.editor);
        const { processed: pts, originByUnit: originPoints } = this._processPoints(
            points,
            dpi
        );
        const singleFields = CreateElementPlugin.lengthFieldConfigs.filter((c) => c.dealMethod === 'single').map((c) => c.field);
        const { processed: optProcessed, originByUnit: originOpts } =
            processOptions(opts || {}, unit, dpi, singleFields);

        const line = new fabric.Line(
            [pts[0].x, pts[0].y, pts[1].x, pts[1].y],
            {
                strokeWidth:
                    optProcessed.strokeWidth !== undefined
                        ? optProcessed.strokeWidth
                        : undefined,
                stroke: opts?.stroke,
            }
        );

        const precision = (this.editor as any).getPrecision?.();
        const mergedOrigin = {
            [unit]: {
                ...formatOriginValues(originOpts[unit] || {}, precision),
                ...formatOriginValues(originPoints[unit] || {}, precision),
            },
        } as Record<string, any>;
        (line as any)._originSize = mergedOrigin;
        this.addSetAndSyncByUnit(line);
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
        const unit = getUnit(this.editor);
        const singleFields = CreateElementPlugin.lengthFieldConfigs.filter((c) => c.dealMethod === 'single').map((c) => c.field);
        const { processed, originByUnit } = processOptions(opts, unit, dpi, singleFields);
        const precision = (this.editor as any).getPrecision?.();
        const formattedOrigin = { [unit]: formatOriginValues(originByUnit[unit] || {}, precision) };
        const ell = new fabric.Ellipse({ ...opts, ...processed });
        (ell as any)._originSize = formattedOrigin;
        this.addSetAndSyncByUnit(ell);
        return ell;
    }

    createPolygon(
        points: Array<{ x: number; y: number }>,
        opts?: { fill?: string; strokeWidth?: number },
        dpi?: number
    ): fabric.Polygon {
        const unit = getUnit(this.editor);
        const { processed: pts, originByUnit: originPoints } = this._processPoints(points, dpi);
        const singleFields = CreateElementPlugin.lengthFieldConfigs.filter((c) => c.dealMethod === 'single').map((c) => c.field);
        const { processed: optProcessed, originByUnit: originOpts } = processOptions(opts || {}, unit, dpi, singleFields);
        const poly = new fabric.Polygon(pts, {
            fill: opts?.fill,
        });
        if (opts?.strokeWidth !== undefined) {
            const sw = convertSingle(opts.strokeWidth, unit, dpi);
            poly.set('strokeWidth', sw!);
        }
        poly.set({ ...(opts || {}), ...optProcessed });
        const precision = (this.editor as any).getPrecision?.();
        const mergedOrigin = {
            [unit]: {
                ...formatOriginValues(originOpts[unit] || {}, precision),
                ...formatOriginValues(originPoints[unit] || {}, precision),
            }
        };
        (poly as any)._originSize = mergedOrigin;
        this.addSetAndSyncByUnit(poly);
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
                        const unit = getUnit(this.editor);
                        const singleFields = CreateElementPlugin.lengthFieldConfigs.filter((c) => c.dealMethod === 'single').map((c) => c.field);
                        const { originByUnit } = processOptions(opts, unit, dpi, singleFields);
                        const precision = (this.editor as any).getPrecision?.();
                        this.addSetAndSyncByUnit(img);
                        img.set({ ...opts });
                        const formattedOrigin = { [unit]: formatOriginValues(originByUnit[unit] || {}, precision) };
                        (img as any)._originSize = formattedOrigin;
                    }
                    resolve(img);
                },
                { crossOrigin: 'anonymous' }
            );
        });
    }


    async createBarcode(
        barcodeValue: string,
        opts?: {
            left?: number;
            top?: number;
            height?: number;
            boxWidth?: number;
            fontSize?: number;
            format?: string;
            textAlign?: string;
            textPosition?: string;
            background?: string;
            lineColor?: string;
            displayValue?: boolean;
            margin?: number;
            width?: number;
        },
        dpi?: number
    ): Promise<fabric.Image> {
        return (this.editor as any).addBarcode?.(barcodeValue, opts, dpi);
    }

    /**
     * 创建二维码元素，委托调用编辑器的 addQrCode，并支持单位转换与原始尺寸存储
     */
    async createQrcode(
        codeValue: string,
        opts?: {
            left?: number;
            top?: number;
            width?: number;
            height?: number;
            margin?: number;
            errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
            dotsColor?: string;
            dotsType?: string;
            cornersSquareColor?: string;
            cornersSquareType?: string;
            cornersDotColor?: string;
            cornersDotType?: string;
            background?: string;
        },
        dpi?: number
    ): Promise<fabric.Image> {
        return (this.editor as any).addQrCode?.(codeValue, opts, dpi);
    }

    destroy() {
        console.log('pluginDestroy');
    }
}

export default CreateElementPlugin;
