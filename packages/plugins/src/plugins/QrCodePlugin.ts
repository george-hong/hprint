import { fabric } from '@hprint/core';
import bwipjs from 'bwip-js';
import { utils } from '@hprint/shared';
import { getUnit, processOptions, formatOriginValues } from '../utils/units';
import type { IEditor, IPluginTempl } from '@hprint/core';

type IPlugin = Pick<QrCodePlugin, 'addQrCode' | 'setQrCode' | 'initQrcodeEvents'>;

declare module '@hprint/core' {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface IEditor extends IPlugin { }
}

class QrCodePlugin implements IPluginTempl {
    static pluginName = 'QrCodePlugin';
    static apis = ['addQrCode', 'setQrCode', 'initQrcodeEvents'];
    constructor(
        public canvas: fabric.Canvas,
        public editor: IEditor
    ) { }

    async hookTransform(object: any) {
        if (object.extensionType === 'qrcode') {
            const paramsOption = this._paramsToOption(object.extension);
            const { url, width, height } = await this._getQrCodeResult(paramsOption);
            object.src = url;

            // 修复 base64 生成后，没有拉伸到容器大小的问题
            if (width > 0 && height > 0) {
                const oldWidth = object.width || 0;
                const oldHeight = object.height || 0;
                const oldScaleX = object.scaleX || 1;
                const oldScaleY = object.scaleY || 1;

                const displayWidth = oldWidth * oldScaleX;
                const displayHeight = oldHeight * oldScaleY;

                if (displayWidth > 0 && displayHeight > 0) {
                    object.width = width;
                    object.height = height;
                    object.scaleX = displayWidth / width;
                    object.scaleY = displayHeight / height;
                }
            }
        }
    }

    async hookTransformObjectEnd({ originObject, fabricObject }: { originObject: any, fabricObject: any }) {
        if (originObject.extensionType === 'qrcode') {
            this.initQrcodeEvents(fabricObject);
        }
    }

    async _getQrCodeResult(options: any): Promise<{ url: string; width: number; height: number }> {
        const zoom = this.canvas.getZoom() || 1;
        const dpr = (window && (window as any).devicePixelRatio) || 1;

        const targetWidth = (options.width || 300) * zoom * dpr;
        // 估算 module 数量，QR Code 通常在 21-177 之间，取一个中间值作为估算基础
        const estimatedModules = 35;
        // 计算需要的缩放比例，确保生成的图片足够大
        let bwipScale = Math.ceil(targetWidth / estimatedModules);
        // 保证最小缩放比例，避免过小
        if (bwipScale < 2) bwipScale = 2;

        const canvas = document.createElement('canvas');

        const barColor = options.color?.replace('#', '') || '000000';
        const bgColor = options.bgColor?.replace('#', '') || 'ffffff';
        const ecLevel = options.ecLevel || 'M';

        try {
            bwipjs.toCanvas(canvas, {
                bcid: 'qrcode',
                text: options.data || ' ',
                scale: bwipScale,
                eclevel: ecLevel,
                barcolor: barColor,
                backgroundcolor: bgColor,
            } as any);
            return {
                url: canvas.toDataURL('image/png'),
                width: canvas.width,
                height: canvas.height
            };
        } catch (error) {
            console.error('QR Code generation failed:', error);
            return { url: '', width: 0, height: 0 };
        }
    }

    async _getBase64Str(options: any): Promise<string> {
        const { url } = await this._getQrCodeResult(options);
        return url;
    }

    _defaultBarcodeOption() {
        return {
            value: '@hprint/print',
            width: 300,
            margin: 10,
            ecLevel: 'M',
        };
    }

    /**
     * 将内部参数转换为二维码库需要的参数
     */
    _paramsToOption(option: any) {
        const hasW = Number.isFinite(option.width);
        const hasH = Number.isFinite(option.height);
        const size = hasW && hasH
            ? Math.max(option.width, option.height)
            : (hasW ? option.width : (hasH ? option.height : undefined));
        const options = {
            ...option,
            width: size,
            height: size ?? option.width,
            type: 'canvas',
            data: option.value != null ? String(option.value) : undefined,
            margin: option.margin,
        };
        return options;
    }

    private async _updateQrCodeImage(imgEl: fabric.Image, immediate = false) {
        const extension = imgEl.get('extension');
        if (!extension) return;
        const updateFn = async () => {
            const currentWidth = imgEl.getScaledWidth();
            const currentHeight = imgEl.getScaledHeight();
            const size = Math.max(currentWidth, currentHeight);
            const options = {
                ...extension,
                width: size,
                height: size,
            };
            const paramsOption = this._paramsToOption(options);
            try {
                const url = await this._getBase64Str(paramsOption);
                await new Promise<void>((resolve) => {
                    imgEl.setSrc(url, () => {
                        this._setImageScale(imgEl, currentWidth, currentHeight);
                        imgEl.set('extension', options);
                        this.canvas.renderAll();
                        resolve();
                    });
                });
            } catch (error) {
                console.error(error);
            }
        };
        if (immediate) {
            await updateFn();
        } else {
            setTimeout(updateFn, 300);
        }
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
     * 绑定二维码相关事件与方法
     */
    initQrcodeEvents(imgEl: fabric.Image) {
        (imgEl as any).setExtension = async (fields: Record<string, any>) => {
            const currentExt = (imgEl.get('extension') as any) || {};
            const merged = { ...currentExt, ...(fields || {}) };
            imgEl.set('extension', merged);
            await this._updateQrCodeImage(imgEl, true);
        };
        (imgEl as any).setExtensionByUnit = async (
            fields: Record<string, any>,
            dpi?: number
        ) => {
            const curUnit = getUnit(this.editor);
            const { processed, originByUnit } = processOptions(fields || {}, curUnit, dpi);
            const precision = (this.editor as any).getPrecision?.();
            const formattedOrigin = formatOriginValues(originByUnit[curUnit] || {}, precision);
            const originSize = (imgEl as any)._originSize || {};
            const unitOrigin = originSize[curUnit] || {};
            unitOrigin.extension = { ...(unitOrigin.extension || {}), ...formattedOrigin };
            (imgEl as any)._originSize = { ...originSize, [curUnit]: unitOrigin };
            const currentExt = (imgEl.get('extension') as any) || {};
            const merged = { ...currentExt, ...processed };
            imgEl.set('extension', merged);
            await this._updateQrCodeImage(imgEl, true);
        };
        (imgEl as any).off?.('modified');
        (imgEl as any).off?.('scaled');
        imgEl.on('modified', async (event: any) => {
            const target = (event?.target as fabric.Image) || imgEl;
            await this._updateQrCodeImage(target, true);
        });
        imgEl.on('scaled', async () => {
            await this._updateQrCodeImage(imgEl, true);
        });

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
            ecLevel?: 'L' | 'M' | 'Q' | 'H';
            color: string;
            bgColor: string;
        },
        dpi?: number
    ): Promise<fabric.Image> {
        const option = {
            ...this._defaultBarcodeOption(),
            ...(opts || {}),
            ...(data ? { value: data } : {}),
        };
        const unit = getUnit(this.editor);
        const { processed, originByUnit } = processOptions(option, unit, dpi, ['left', 'top', 'width', 'height', 'margin']);
        const finalOption = { ...option, ...processed };
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
                    this.initQrcodeEvents(imgEl);
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
                    this.initQrcodeEvents(imgEl);
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

    destroy() {
        console.log('pluginDestroy');
    }
}

export default QrCodePlugin;
