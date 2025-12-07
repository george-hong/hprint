import { fabric } from '@hprint/core';
import QRCodeStyling from 'qr-code-styling';
import { utils } from '@hprint/shared';
import { getUnit, processOptions } from '../utils/units';
import type { IEditor, IPluginTempl } from '@hprint/core';

type IPlugin = Pick<QrCodePlugin, 'addQrCode' | 'setQrCode' | 'getQrCodeTypes'>;

declare module '@hprint/core' {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface IEditor extends IPlugin { }
}

// 二维码生成参数

enum DotsType {
    rounded = 'rounded',
    dots = 'dots',
    classy = 'classy',
    classy_rounded = 'classy-rounded',
    square = 'square',
    extra_rounded = 'extra-rounded',
}

enum CornersType {
    dot = 'dot',
    square = 'square',
    extra_rounded = 'extra-rounded',
}

enum cornersDotType {
    dot = 'dot',
    square = 'square',
}

enum errorCorrectionLevelType {
    L = 'L',
    M = 'M',
    Q = 'Q',
    H = 'H',
}

class QrParamsDefaults {
    width = 300;
    height = 300;
    type = 'canvas' as const;
    data = ' ';
    margin = 10;
    qrOptions = {
        errorCorrectionLevel: 'M' as const,
    };
    dotsOptions = {
        color: '#000000',
        type: 'square' as const,
    };
    cornersSquareOptions = {
        color: '#000000',
        type: 'square' as const,
    };
    cornersDotOptions = {
        color: '#000000',
        type: 'square' as const,
    };
    backgroundOptions = {
        color: '#ffffff',
    };
}

class QrCodePlugin implements IPluginTempl {
    static pluginName = 'QrCodePlugin';
    static apis = ['addQrCode', 'setQrCode', 'getQrCodeTypes'];
    constructor(
        public canvas: fabric.Canvas,
        public editor: IEditor
    ) { }

    async hookTransform(object: any) {
        if (object.extensionType === 'qrcode') {
            const paramsOption = this._paramsToOption(object.extension);
            const url = await this._getBase64Str(paramsOption);
            object.src = url;
        }
    }

    async _getBase64Str(options: any): Promise<string> {
        const zoom = this.canvas.getZoom() || 1;
        const dpr = (window && (window as any).devicePixelRatio) || 1;
        let scale = zoom * dpr;
        const maxScale = 4;
        if (!Number.isFinite(scale) || scale <= 0) scale = 1;
        scale = Math.min(scale, maxScale);

        const scaledOptions = {
            ...options,
            width: Math.round((options.width || 300) * scale),
            height: Math.round((options.height || options.width || 300) * scale),
            margin: Math.round((options.margin || 0) * scale),
        };
        const qrCode = new QRCodeStyling(scaledOptions);
        const blob = await qrCode.getRawData('png');
        if (!blob) return '';
        const base64Str = (await utils.blobToBase64(blob)) as string;
        return base64Str || '';
    }

    _defaultBarcodeOption() {
        return {
            data: 'https://kuaitu.cc',
            width: 300,
            margin: 10,
            errorCorrectionLevel: 'M',
            dotsColor: '#000000',
            dotsType: 'square',
            cornersSquareColor: '#000000',
            cornersSquareType: 'square',
            cornersDotColor: '#000000',
            cornersDotType: 'square',
            background: '#ffffff',
        };
    }

    /**
     * 将内部参数转换为二维码库需要的参数
     */
    _paramsToOption(option: any) {
        const base = {
            width: option.width,
            height: option.height ?? option.width,
            type: 'canvas',
            data: option.data != null ? String(option.data) : undefined,
            margin: option.margin,
            qrOptions: {
                errorCorrectionLevel: option.errorCorrectionLevel,
            },
            dotsOptions: {
                color: option.dotsColor,
                type: option.dotsType,
            },
            cornersSquareOptions: {
                color: option.cornersSquareColor,
                type: option.cornersSquareType,
            },
            cornersDotOptions: {
                color: option.cornersDotColor,
                type: option.cornersDotType,
            },
            backgroundOptions: {
                color: option.background,
            },
        };
        const defaultParams = new QrParamsDefaults();
        const merged = Object.assign({}, defaultParams, base);
        merged.qrOptions = Object.assign({}, defaultParams.qrOptions, base.qrOptions);
        merged.dotsOptions = Object.assign({}, defaultParams.dotsOptions, base.dotsOptions);
        merged.cornersSquareOptions = Object.assign({}, defaultParams.cornersSquareOptions, base.cornersSquareOptions);
        merged.cornersDotOptions = Object.assign({}, defaultParams.cornersDotOptions, base.cornersDotOptions);
        merged.backgroundOptions = Object.assign({}, defaultParams.backgroundOptions, base.backgroundOptions);

        if (!merged.data || (typeof merged.data === 'string' && merged.data.trim() === '')) {
            merged.data = defaultParams.data;
        }
        return merged;
    }

    /**
     * 设置图片缩放到目标宽高
     */
    private _setImageScale(
        imgEl: fabric.Image,
        targetWidth: number,
        targetHeight: number
    ) {
        const imgWidth = imgEl.width || 0;
        const imgHeight = imgEl.height || 0;
        if (imgWidth > 0 && imgHeight > 0) {
            const scaleX = targetWidth / imgWidth;
            const scaleY = targetHeight / imgHeight;
            imgEl.set({
                scaleX,
                scaleY,
            });
        }
    }

    /**
     * 创建二维码，支持传入内容与样式，进行单位转换并存储原始尺寸
     */
    async addQrCode(
        data?: string,
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
        const option = {
            ...this._defaultBarcodeOption(),
            ...(opts || {}),
            ...(data ? { data } : {}),
        };
        const unit = getUnit(this.editor);
        const { processed, originByUnit } = processOptions(option, unit, dpi, ['left', 'top', 'width', 'height', 'margin']);
        const finalOptionBase = { ...option, ...processed };
        const finalOption = {
            ...finalOptionBase,
            width: Number.isFinite(finalOptionBase.width) && finalOptionBase.width > 0
                ? finalOptionBase.width
                : this._defaultBarcodeOption().width,
            height: Number.isFinite(finalOptionBase.height) && finalOptionBase.height > 0
                ? finalOptionBase.height
                : finalOptionBase.width,
            margin: Number.isFinite(finalOptionBase.margin) && finalOptionBase.margin >= 0
                ? finalOptionBase.margin
                : this._defaultBarcodeOption().margin,
        };
        const paramsOption = this._paramsToOption(finalOption);
        const url = await this._getBase64Str(paramsOption);
        return new Promise<fabric.Image>((resolve) => {
            fabric.Image.fromURL(
                url,
                (imgEl) => {
                    const safeLeft = Number.isFinite(processed.left)
                        ? processed.left
                        : 0;
                    const safeTop = Number.isFinite(processed.top)
                        ? processed.top
                        : 0;
                    imgEl.set({
                        left: safeLeft,
                        top: safeTop,
                        extensionType: 'qrcode',
                        extension: finalOption,
                        imageSmoothing: false,
                    });

                    const targetWidth =
                        typeof finalOption.width === 'number'
                            ? finalOption.width
                            : imgEl.width ?? 0;
                    const targetHeight =
                        typeof finalOption.height === 'number'
                            ? finalOption.height
                            : targetWidth;
                    this._setImageScale(imgEl, targetWidth, targetHeight);

                    const origin = originByUnit[unit] || {};
                    const originMapped: Record<string, any> = { ...origin };
                    if (
                        originMapped.height === undefined &&
                        originMapped.width !== undefined
                    ) {
                        originMapped.height = originMapped.width;
                    }
                    (imgEl as any)._originSize = { [unit]: originMapped };
                    resolve(imgEl);
                },
                { crossOrigin: 'anonymous' }
            );
        });
    }

    async setQrCode(option: any) {
        try {
            const paramsOption = this._paramsToOption(option);
            const url = await this._getBase64Str(paramsOption);
            const activeObject = this.canvas.getActiveObjects()[0];
            fabric.Image.fromURL(
                url,
                (imgEl) => {
                    imgEl.set({
                        left: activeObject.left,
                        top: activeObject.top,
                        extensionType: 'qrcode',
                        extension: { ...option },
                    });
                    imgEl.scaleToWidth(activeObject.getScaledWidth());
                    this.editor.del();
                    this.canvas.add(imgEl);
                    this.canvas.setActiveObject(imgEl);
                },
                { crossOrigin: 'anonymous' }
            );
        } catch (error) {
            console.log(error);
        }
    }

    getQrCodeTypes() {
        return {
            DotsType: Object.values(DotsType),
            CornersType: Object.values(CornersType),
            cornersDotType: Object.values(cornersDotType),
            errorCorrectionLevelType: Object.values(errorCorrectionLevelType),
        };
    }

    destroy() {
        console.log('pluginDestroy');
    }
}

export default QrCodePlugin;
