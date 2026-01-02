import { fabric, IEditor, IPluginTempl } from '@hprint/core';
import JsBarcode from 'jsbarcode';
import { getUnit, processOptions, formatOriginValues } from '../utils/units';

type IPlugin = Pick<
    BarCodePlugin,
    'addBarcode' | 'setBarcode' | 'getBarcodeTypes'
>;

declare module '@hprint/core' {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface IEditor extends IPlugin { }
}

// 条形码生成参数
// https://github.com/lindell/JsBarcode/wiki/Options

enum CodeType {
    CODE128 = 'CODE128',
    EAN8 = 'EAN8',
    EAN13 = 'EAN13',
    ITF14 = 'ITF14',
    codabar = 'codabar',
    pharmacode = 'pharmacode',
}

class BarCodePlugin implements IPluginTempl {
    static pluginName = 'BarCodePlugin';
    static apis = ['addBarcode', 'setBarcode', 'getBarcodeTypes'];
    constructor(
        public canvas: fabric.Canvas,
        public editor: IEditor
    ) { }

    async hookTransform(object: any) {
        if (object.extensionType === 'barcode') {
            const extension = object.extension || {};

            // 恢复保存的宽高信息，如果存在则使用，否则使用默认值
            const options = this._mergeBarcodeOptions(extension);

            const url = await this._getBase64Str(options);
            object.src = url;

            // 更新 extension 以确保宽高信息被保存
            object.extension = options;
        }
    }

    async hookTransformObjectEnd({ originObject, fabricObject }: { originObject: any, fabricObject: any }) {
        if (originObject.extensionType === 'barcode') {
            this._bindBarcodeEvents(fabricObject);
        }
    }

    // 绑定条形码对象的事件监听器
    private _bindBarcodeEvents(imgEl: fabric.Image) {
        (imgEl as any).setExtension = async (fields: Record<string, any>) => {
            const currentExt = (imgEl.get('extension') as any) || {};
            const merged = { ...currentExt, ...(fields || {}) };
            imgEl.set('extension', merged);
            await this._updateBarcodeImage(imgEl, true);
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
            await this._updateBarcodeImage(imgEl, true);
        };

        // 移除旧的事件监听器（如果存在）
        imgEl.off('modified');
        imgEl.off('scaled');

        // 移除旧的 zoom 处理器（如果存在）
        if ((imgEl as any)._barcodeZoomHandler) {
            this.canvas.off('mouse:wheel', (imgEl as any)._barcodeZoomHandler);
        }

        // 监听对象修改事件（大小变化）- 立即更新
        imgEl.on('modified', async (event: any) => {
            const target = (event.target as fabric.Image) || imgEl;
            await this._updateBarcodeImage(target, true);
        });

        // 监听缩放结束事件（立即更新）
        imgEl.on('scaled', async () => {
            await this._updateBarcodeImage(imgEl, true);
        });

        // 监听 canvas zoom 变化（防抖更新）
        const zoomHandler = () => {
            this._updateBarcodeImage(imgEl, false);
        };
        this.canvas.on('mouse:wheel', zoomHandler);

        // 保存事件处理器，以便在销毁时移除
        (imgEl as any)._barcodeZoomHandler = zoomHandler;
    }

    // 加载 JSON 后恢复事件监听器
    hookImportAfter() {
        return new Promise<void>(async (resolve) => {
            // 遍历所有对象，找到条形码对象并重新绑定事件
            const barcodeObjects: fabric.Image[] = [];
            this.canvas.getObjects().forEach((obj) => {
                if (
                    obj.type === 'image' &&
                    (obj as any).extensionType === 'barcode'
                ) {
                    barcodeObjects.push(obj as fabric.Image);
                    this._bindBarcodeEvents(obj as fabric.Image);
                }
            });

            // 重新生成所有条形码的 src，因为 canvas zoom 可能在 hookImportAfter 中被改变了
            // 使用保存的 extension 中的 boxWidth 和 height（原始值），但使用当前的 canvas zoom 重新生成
            await Promise.all(
                barcodeObjects.map(async (imgEl) => {
                    const extension = imgEl.get('extension');
                    if (!extension) return;

                    // 使用保存的宽高信息，保持原始值不变
                    const options = this._mergeBarcodeOptions(extension);

                    try {
                        // 使用当前的 canvas zoom 重新生成条形码图片
                        const url = await this._getBase64Str(options);

                        // 获取当前的缩放比例，用于计算正确的 scaleX 和 scaleY
                        const currentWidth = imgEl.getScaledWidth();
                        const currentHeight = imgEl.getScaledHeight();

                        await new Promise<void>((resolve) => {
                            imgEl.setSrc(url, () => {
                                // 设置缩放比例，使图片显示为期望的尺寸
                                this._setImageScale(
                                    imgEl,
                                    currentWidth,
                                    currentHeight
                                );

                                // 保持 extension 不变，不更新 boxWidth 和 height
                                resolve();
                            });
                        });
                    } catch (error) {
                        console.error('重新生成条形码失败:', error);
                    }
                })
            );

            this.canvas.renderAll();
            resolve();
        });
    }

    // 保存前处理：确保保存宽高信息到 extension
    // 注意：src 不会被导出，因为 toJSON(keys) 只会保存 keys 中指定的属性，而 src 不在 getExtensionKey() 中
    // 保存的是 extension 中已有的 boxWidth 和 height（缩放前的原始值），而不是渲染后的尺寸
    hookSaveBefore() {
        return new Promise<void>((resolve) => {
            // 遍历所有对象，找到条形码对象
            this.canvas.getObjects().forEach((obj) => {
                if (
                    obj.type === 'image' &&
                    (obj as any).extensionType === 'barcode'
                ) {
                    const imgEl = obj as fabric.Image;
                    const extension = imgEl.get('extension');

                    if (extension) {
                        // 确保 extension 中包含 boxWidth 和 height
                        // 这些值已经在 _updateBarcodeImage 中被更新，是缩放前的原始值
                        // 如果不存在，使用默认值
                        const defaultOption = this._defaultBarcodeOption();
                        const finalExtension = {
                            ...extension,
                            boxWidth:
                                extension.boxWidth !== undefined
                                    ? extension.boxWidth
                                    : defaultOption.boxWidth,
                            height:
                                extension.height !== undefined
                                    ? extension.height
                                    : defaultOption.height,
                        };

                        // 更新 extension，确保保存时包含这些信息
                        imgEl.set('extension', finalExtension);
                    }
                }
            });
            resolve();
        });
    }
    async _getBase64Str(option: any): Promise<string> {
        // 获取 canvas 的缩放比例，用于提高绘制分辨率
        const zoom = this.canvas.getZoom() || 1;
        const devicePixelRatio = window.devicePixelRatio || 1;
        // 使用 zoom 和 devicePixelRatio 的乘积作为基础缩放因子
        let scale = zoom * devicePixelRatio;

        // 计算条形码的最小尺寸，用于优化清晰度
        const minDimension = Math.min(
            option.boxWidth || 60,
            option.height || 30
        );

        // 对于小尺寸的条形码，使用更高的 scale 来保证清晰度
        // 当条形码宽度或高度小于 100px 时，增加 scale
        if (minDimension < 100) {
            // 小尺寸时，使用更高的 scale（至少 3 倍）
            const minScale = 3;
            scale = Math.max(scale, minScale);
        } else if (minDimension < 200) {
            // 中等尺寸时，使用适中的 scale（至少 2 倍）
            const minScale = 2;
            scale = Math.max(scale, minScale);
        }

        // 设置最大 scale 限制，避免生成过大的图片
        const maxScale = 5;
        scale = Math.min(scale, maxScale);

        // 必须使用命名空间的svg元素才能正确生成barcode string
        const svg = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'svg'
        );

        // 排除文本相关参数，只传递条形码生成所需的参数
        const {
            fontSize,
            textAlign,
            textPosition,
            displayValue,
            charSpacing,
            lineHeight,
            fontFamily,
            fontWeight,
            fontStyle,
            underline,
            linethrough,
            ...barcodeOptions
        } = option;

        // 生成不包含文本的条形码 SVG
        // 对于小尺寸，增加 width 参数以提高分辨率（JsBarcode 的 width 是线条宽度）
        const barcodeWidth = barcodeOptions.width || 1;
        // 如果条形码尺寸很小，增加线条宽度以提高清晰度
        const adjustedWidth =
            minDimension < 100 ? Math.max(barcodeWidth, 2) : barcodeWidth;

        JsBarcode(svg, option.value, {
            ...barcodeOptions,
            width: adjustedWidth,
            displayValue: false, // 明确禁用 JsBarcode 的文本显示
        });

        const svgStr = new XMLSerializer().serializeToString(svg);
        const svgUrl = `data:image/svg+xml;base64,` + btoa(svgStr);

        // 如果不需要显示文本，直接返回 SVG URL
        if (!displayValue) {
            return svgUrl;
        }

        // 将 SVG 转换为图片，使用高分辨率
        // 先加载原始 SVG 获取尺寸
        const tempImg = await this._loadImage(svgUrl);
        const originalBarcodeWidth = tempImg.naturalWidth || tempImg.width;
        const originalBarcodeHeight = tempImg.naturalHeight || tempImg.height;

        // 创建高分辨率 canvas 渲染 SVG
        const svgImage = await this._loadImageToCanvas(svgUrl, scale);

        // 文本应该匹配 boxWidth（期望的显示宽度），而不是条形码的原始宽度
        // 这样当条形码被拉伸到 boxWidth 时，文本宽度也能匹配
        const textCanvas = this._drawText(option.value, {
            fontSize: fontSize || 12,
            textAlign: textAlign || 'center',
            boxWidth: option.boxWidth || originalBarcodeWidth, // 使用 boxWidth 而不是 originalBarcodeWidth
            scale: scale,
            textPosition: textPosition || 'bottom', // 传递文本位置，用于决定间距
            charSpacing:
                typeof charSpacing === 'number'
                    ? charSpacing
                    : (option as any).textSpacing ?? 0,
            lineHeight: lineHeight || 1, // 传递行高
            fontFamily: fontFamily || 'Arial', // 传递字体
            fontWeight: fontWeight || 'normal', // 传递字体粗细
            fontStyle: fontStyle || 'normal', // 传递字体样式
            underline: underline || false, // 传递下划线参数
            linethrough: linethrough || false, // 传递删除线参数
        });

        // 合并条形码和文本，使用高分辨率
        const mergedCanvas = this._mergeBarcodeAndText(
            svgImage,
            textCanvas,
            textPosition || 'bottom',
            scale,
            option.height, // 传入目标高度
            option.boxWidth // 传入目标宽度，确保条形码和文本宽度一致
        );

        // 返回合并后的 base64
        return mergedCanvas.toDataURL('image/png');
    }

    // 加载图片的辅助方法
    private _loadImage(url: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }

    // 将 SVG 加载到高分辨率 canvas
    private _loadImageToCanvas(
        url: string,
        scale: number
    ): Promise<HTMLCanvasElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('无法创建 canvas 上下文'));
                    return;
                }

                // 设置高分辨率尺寸
                const originalWidth = img.naturalWidth || img.width;
                const originalHeight = img.naturalHeight || img.height;

                canvas.width = originalWidth * scale;
                canvas.height = originalHeight * scale;

                // 使用高质量缩放（对于小尺寸图片，禁用平滑以获得更清晰的线条）
                // 条形码需要清晰的线条，所以对于小尺寸使用 nearest-neighbor 缩放
                const isSmallImage = canvas.width < 300 || canvas.height < 300;
                if (isSmallImage) {
                    ctx.imageSmoothingEnabled = false; // 禁用平滑，获得更清晰的像素边界
                } else {
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                }

                // 绘制图片到高分辨率 canvas
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                resolve(canvas);
            };
            img.onerror = reject;
            img.src = url;
        });
    }

    // 在 canvas 上绘制文本
    private _drawText(
        text: string,
        options: {
            fontSize: number;
            textAlign: string;
            boxWidth: number;
            scale: number;
            textPosition?: string;
            fontFamily?: string;
            charSpacing?: number; // 字符间距
            lineHeight?: number; // 行高
            fontWeight?: string;
            fontStyle?: string;
            underline?: boolean;
            linethrough?: boolean;
        }
    ): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('无法创建 canvas 上下文');
        }
        // 根据缩放比例设置 canvas 的实际尺寸
        const scaledWidth = options.boxWidth * options.scale;
        const scaledFontSize = options.fontSize * options.scale;
        const charSpacing = (options.charSpacing ?? 0) * options.scale;
        const lineHeight = options.lineHeight ?? 1;
        const lines = String(text).split('\n');
        const scaledLineHeight = scaledFontSize * lineHeight;
        const totalTextHeight = scaledLineHeight * lines.length;

        const hasUnderline = options.underline;
        const hasLineThrough = options.linethrough;

        // 计算需要的额外高度（如下划线）
        let extraHeight = 0;
        if (hasUnderline) {
            const lineWidth = Math.max(1, options.fontSize / 15);
            // 确保有足够的空间绘制下划线
            extraHeight = lineWidth * options.scale * 1.5;
        }

        const canvasHeight = totalTextHeight + extraHeight;

        // 设置 canvas 的实际尺寸（高分辨率）
        canvas.width = scaledWidth;
        canvas.height = canvasHeight;

        // 设置 canvas 的显示尺寸（CSS 尺寸）
        canvas.style.width = `${options.boxWidth}px`;
        canvas.style.height = `${canvasHeight / options.scale}px`;

        // 缩放上下文以匹配高分辨率
        ctx.scale(options.scale, options.scale);

        // 设置字体（使用原始尺寸，因为已经通过 scale 缩放）
        const fontWeight = options.fontWeight || 'normal';
        const fontStyle = options.fontStyle || 'normal';
        ctx.font = `${fontStyle} ${fontWeight} ${options.fontSize}px ${options.fontFamily || 'Arial'}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#000';

        const leadingScaled = Math.max(0, scaledLineHeight - scaledFontSize);
        const baseY = leadingScaled / 2 / options.scale;

        const measureLineWidth = (line: string) => {
            if (charSpacing <= 0) {
                return ctx.measureText(line).width;
            }
            let sum = 0;
            for (let i = 0; i < line.length; i++) {
                sum += ctx.measureText(line[i]).width;
                if (i > 0) sum += charSpacing / options.scale;
            }
            return sum;
        };

        lines.forEach((line, idx) => {
            const rawLineWidth = measureLineWidth(line);
            let lineX = 0;
            if (options.textAlign === 'center') {
                lineX = (options.boxWidth - rawLineWidth) / 2;
            } else if (options.textAlign === 'right') {
                lineX = options.boxWidth - rawLineWidth;
            } else {
                lineX = 0;
            }
            const lineY = baseY + idx * (scaledLineHeight / options.scale);

            if (charSpacing <= 0) {
                ctx.fillText(line, lineX, lineY);
            } else {
                let cursorX = lineX;
                for (let i = 0; i < line.length; i++) {
                    const ch = line[i];
                    ctx.fillText(ch, cursorX, lineY);
                    const w = ctx.measureText(ch).width;
                    cursorX += w + charSpacing / options.scale;
                }
            }

            // 绘制装饰线
            if (hasUnderline || hasLineThrough) {
                ctx.beginPath();
                // 线的宽度
                const lineWidth = Math.max(1, options.fontSize / 15);
                ctx.lineWidth = lineWidth;
                ctx.strokeStyle = '#000';

                // 绘制下划线
                if (hasUnderline) {
                    // 通常下划线在 baseline 之下，但这里是 top baseline
                    // 简单估算：lineY + fontSize + offset
                    const underlineY = lineY + options.fontSize + lineWidth;
                    ctx.moveTo(lineX, underlineY);
                    ctx.lineTo(lineX + rawLineWidth, underlineY);
                }

                // 绘制删除线
                if (hasLineThrough) {
                    // 删除线在中间
                    const lineThroughY = lineY + options.fontSize / 2;
                    ctx.moveTo(lineX, lineThroughY);
                    ctx.lineTo(lineX + rawLineWidth, lineThroughY);
                }
                ctx.stroke();
            }
        });

        return canvas;
    }

    // 合并条形码图片和文本 canvas
    private _mergeBarcodeAndText(
        barcodeImage: HTMLCanvasElement,
        textCanvas: HTMLCanvasElement,
        textPosition: string,
        scale: number,
        targetHeight?: number,
        targetWidth?: number
    ): HTMLCanvasElement {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('无法创建 canvas 上下文');
        }

        // 计算合并后的尺寸（使用高分辨率）
        const barcodeWidth = barcodeImage.width;
        const barcodeHeight = barcodeImage.height;

        // 文本 canvas 的实际尺寸（已经是高分辨率，包含间距）
        const textCanvasHeight = textCanvas.height; // 包含文本和间距的总高度
        const textWidth = textCanvas.width;

        // 纯文本高度（不包含间距，由 lineHeight 控制）
        const actualTextHeight = textCanvasHeight;

        // 如果提供了目标宽度，使用目标宽度（确保条形码和文本宽度一致，避免拉伸）
        // 否则使用较大的宽度作为最终宽度（高分辨率）
        const finalWidth =
            targetWidth !== undefined && targetWidth > 0
                ? targetWidth * scale
                : Math.max(barcodeWidth, textWidth);

        // 计算目标高度（如果提供了 targetHeight）
        let finalHeight: number;
        let barcodeDrawHeight: number; // SVG 的实际绘制高度（可能被拉伸或裁剪）

        if (targetHeight !== undefined && targetHeight > 0) {
            // 根据传入的 height 和 scale 计算高分辨率目标高度
            const targetHeightScaled = targetHeight * scale;

            // 规则1: 如果文本 canvas 高度（包含间距）大于目标高度，以文本 canvas 高度为准（保证文本完整展示）
            if (textCanvasHeight > targetHeightScaled) {
                finalHeight = textCanvasHeight;
                // 如果文本在上方，条形码高度为0；如果文本在下方，条形码高度也为0（因为文本占满全部高度）
                barcodeDrawHeight = 0;
            } else {
                // 规则2: 如果 SVG + textCanvas 的高度小于目标高度，需要拉伸 SVG
                const availableHeightForBarcode =
                    targetHeightScaled - textCanvasHeight;
                if (barcodeHeight + textCanvasHeight < targetHeightScaled) {
                    finalHeight = targetHeightScaled;
                    barcodeDrawHeight = availableHeightForBarcode; // 拉伸 SVG
                } else {
                    // 规则3: 如果 SVG 高度大于可用高度，裁剪 SVG
                    finalHeight = targetHeightScaled;
                    barcodeDrawHeight = Math.min(
                        barcodeHeight,
                        availableHeightForBarcode
                    ); // 裁剪 SVG
                }
            }
        } else {
            // 如果没有提供目标高度，使用实际合并后的高度
            finalHeight = barcodeHeight + textCanvasHeight;
            barcodeDrawHeight = barcodeHeight;
        }

        // 设置 canvas 的实际尺寸（高分辨率）
        canvas.width = finalWidth;
        canvas.height = finalHeight;

        // 设置 canvas 的显示尺寸（CSS 尺寸）
        canvas.style.width = `${finalWidth / scale}px`;
        canvas.style.height = `${finalHeight / scale}px`;

        // 设置背景色（如果需要）
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 根据 textPosition 决定文本位置
        const textX = (finalWidth - textWidth) / 2;
        // 如果提供了目标宽度，条形码会被拉伸到目标宽度，所以使用目标宽度计算居中位置
        const barcodeDrawWidth =
            targetWidth !== undefined && targetWidth > 0
                ? targetWidth * scale
                : barcodeWidth;
        const barcodeX = (finalWidth - barcodeDrawWidth) / 2;

        if (textPosition === 'top') {
            // 文本在上方：只需要保留下方间距
            let currentY = 0;

            // 绘制文本（始终完整显示）
            // 文本 canvas 已经包含了下方间距，直接绘制整个 canvas
            ctx.drawImage(
                textCanvas,
                0,
                0,
                textWidth,
                textCanvas.height,
                textX,
                currentY,
                textWidth,
                textCanvas.height
            );
            currentY += textCanvas.height; // 包含文本和下方间距

            // 绘制条形码（可能被拉伸或裁剪）
            // 如果提供了目标宽度，条形码应该被拉伸/压缩到目标宽度，避免文本被拉伸
            const barcodeDrawWidth =
                targetWidth !== undefined && targetWidth > 0
                    ? targetWidth * scale
                    : barcodeWidth;
            if (barcodeDrawHeight > 0 && currentY < finalHeight) {
                ctx.drawImage(
                    barcodeImage,
                    0,
                    0,
                    barcodeWidth,
                    barcodeHeight,
                    barcodeX,
                    currentY,
                    barcodeDrawWidth,
                    barcodeDrawHeight
                );
            }
        } else {
            // 文本在下方（默认）：只需要保留上方间距
            let currentY = 0;

            // 绘制条形码（可能被拉伸或裁剪）
            // 如果提供了目标宽度，条形码应该被拉伸/压缩到目标宽度，避免文本被拉伸
            const barcodeDrawWidth =
                targetWidth !== undefined && targetWidth > 0
                    ? targetWidth * scale
                    : barcodeWidth;
            if (barcodeDrawHeight > 0) {
                ctx.drawImage(
                    barcodeImage,
                    0,
                    0,
                    barcodeWidth,
                    barcodeHeight,
                    barcodeX,
                    currentY,
                    barcodeDrawWidth,
                    barcodeDrawHeight
                );
                currentY += barcodeDrawHeight;
            }

            // 绘制文本（始终完整显示）
            // 文本 canvas 已经包含了上方间距，直接绘制整个 canvas
            ctx.drawImage(
                textCanvas,
                0,
                0,
                textWidth,
                textCanvas.height,
                textX,
                currentY,
                textWidth,
                textCanvas.height
            );
        }

        return canvas;
    }

    _defaultBarcodeOption() {
        return {
            value: '123456',
            format: CodeType.CODE128,
            textAlign: 'center',
            textPosition: 'bottom',
            fontSize: 12,
            background: '#fff',
            lineColor: '#000',
            displayValue: true,
            margin: 0,
            width: 1,
            height: 30,
            boxWidth: 60,
            fontWeight: 'normal',
            fontStyle: 'normal',
            underline: false,
            linethrough: false,
        };
    }

    // 合并条形码选项，确保 boxWidth 和 height 存在
    private _mergeBarcodeOptions(extension: any) {
        const defaultOption = this._defaultBarcodeOption();
        return {
            ...defaultOption,
            ...extension,
            boxWidth:
                extension.boxWidth !== undefined
                    ? extension.boxWidth
                    : defaultOption.boxWidth,
            height:
                extension.height !== undefined
                    ? extension.height
                    : defaultOption.height,
        };
    }

    // 设置图片的缩放比例，使图片显示为指定的尺寸
    private _setImageScale(
        imgEl: fabric.Image,
        targetWidth: number,
        targetHeight: number
    ) {
        const imgWidth = imgEl.width || 0;
        const imgHeight = imgEl.height || 0;

        if (imgWidth > 0 && imgHeight > 0) {
            // 计算缩放比例，使图片在 canvas 坐标系中显示为 targetWidth x targetHeight
            const scaleX = targetWidth / imgWidth;
            const scaleY = targetHeight / imgHeight;

            // 设置缩放，使图片显示为期望的尺寸
            imgEl.set({
                scaleX: scaleX,
                scaleY: scaleY,
            });
        }
    }

    // 更新条形码图片的辅助方法（带防抖）
    private _updateBarcodeImageDebounced: Map<fabric.Image, NodeJS.Timeout> =
        new Map();

    private async _updateBarcodeImage(imgEl: fabric.Image, immediate = false) {
        const extension = imgEl.get('extension');
        if (!extension) return;

        // 如果已经有待执行的更新，清除它
        const existingTimeout = this._updateBarcodeImageDebounced.get(imgEl);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        const updateFn = async () => {
            const target = imgEl;

            // 使用 getScaledWidth/getScaledHeight 获取 canvas 坐标系中的实际显示尺寸
            // 这些方法已经考虑了 scaleX/scaleY，返回的是 canvas 坐标系中的尺寸（不考虑 zoom）
            // 生成的图片应该匹配这个尺寸，这样当图片被加载后，scaleX/scaleY 为 1 时就能正确显示
            const currentWidth = target.getScaledWidth();
            const currentHeight = target.getScaledHeight();

            // 保持 fontSize 不变，只更新宽度和高度
            const options = {
                ...extension,
                boxWidth: currentWidth,
                height: currentHeight,
                // fontSize 保持不变，不随尺寸变化
            };

            try {
                const url = await this._getBase64Str(options);
                // setSrc 是异步的，需要在回调中等待图片加载完成后再渲染
                imgEl.setSrc(url, () => {
                    // 设置缩放比例，使图片显示为期望的尺寸
                    this._setImageScale(imgEl, currentWidth, currentHeight);

                    imgEl.set('extension', options);
                    this.canvas.renderAll();
                    // 更新完成后清理防抖记录
                    this._updateBarcodeImageDebounced.delete(imgEl);
                });
            } catch (error) {
                console.error('更新条形码失败:', error);
                // 发生错误时也要清理防抖记录
                this._updateBarcodeImageDebounced.delete(imgEl);
            }
        };

        if (immediate) {
            await updateFn();
        } else {
            // 防抖：300ms 后执行
            const timeout = setTimeout(updateFn, 300);
            this._updateBarcodeImageDebounced.set(imgEl, timeout);
        }
    }



    async addBarcode(
        value?: string,
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
            fontWeight?: string;
            fontStyle?: string;
            underline?: boolean;
            linethrough?: boolean;
        },
        dpi?: number
    ): Promise<fabric.Image> {
        const option = {
            ...this._defaultBarcodeOption(),
            ...(opts || {}),
            ...(value ? { value } : {}),
        };
        if ((option as any).type && !option.format) {
            (option as any).format = (option as any).type;
        }
        const unit = getUnit(this.editor);
        const { processed, originByUnit } = processOptions(option, unit, dpi);
        const finalOption = { ...option, ...processed };
        const url = await this._getBase64Str(JSON.parse(JSON.stringify(finalOption)));
        return new Promise<fabric.Image>((resolve) => {
            fabric.Image.fromURL(
                url,
                (imgEl) => {
                    const safeLeft = (
                        typeof processed.left === 'number'
                            ? processed.left
                            : typeof opts?.left === 'number'
                                ? opts!.left!
                                : 0
                    );
                    const safeTop = (
                        typeof processed.top === 'number'
                            ? processed.top
                            : typeof opts?.top === 'number'
                                ? opts!.top!
                                : 0
                    );
                    imgEl.set({ left: safeLeft, top: safeTop });
                    (imgEl as any).extensionType = 'barcode';
                    (imgEl as any).extension = finalOption;

                    const targetWidth =
                        typeof finalOption.boxWidth === 'number'
                            ? finalOption.boxWidth
                            : (imgEl.width ?? 0);
                    const targetHeight =
                        typeof finalOption.height === 'number'
                            ? finalOption.height
                            : (imgEl.height ?? 0);
                    this._setImageScale(imgEl, targetWidth, targetHeight);

                    const unit = getUnit(this.editor);
                    const origin = originByUnit[unit] || {};
                    const originMapped: Record<string, any> = { ...origin };
                    if (originMapped.boxWidth !== undefined) {
                        originMapped.width = originMapped.boxWidth;
                        delete originMapped.boxWidth;
                    }
                    (imgEl as any)._originSize = { [unit]: originMapped };

                    this._bindBarcodeEvents(imgEl);
                    resolve(imgEl);
                },
                { crossOrigin: 'anonymous' }
            );
        });
    }

    async setBarcode(option: any) {
        try {
            const url = await this._getBase64Str(option);
            const activeObject = this.canvas.getActiveObjects()[0];
            fabric.Image.fromURL(
                url,
                (imgEl) => {
                    imgEl.set({
                        left: activeObject.left,
                        top: activeObject.top,
                        extensionType: 'barcode',
                        extension: { ...option },
                    });
                    imgEl.scaleToWidth(activeObject.getScaledWidth());

                    // 绑定事件监听器
                    this._bindBarcodeEvents(imgEl);

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

    getBarcodeTypes() {
        return Object.values(CodeType);
    }

    destroy() {
        console.log('pluginDestroy');
    }
}

export default BarCodePlugin;
