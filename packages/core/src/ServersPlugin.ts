import { v4 as uuid } from 'uuid';
import { selectFiles, clipboardText, downFile } from './utils/utils';
import { fabric } from 'fabric';
import type { IEditor, IPluginTempl } from '@hprint/core';
import { SelectEvent, SelectMode } from '../../plugins/src/types/eventType';

export type PrintRotation = 0 | 90 | 180 | 270;

export interface PrintExportOptions {
    rotation?: PrintRotation | number;
}

export interface PrintSVGExportOptions extends PrintExportOptions {
    width?: string;
    height?: string;
}

export interface PrintExportResult {
    content: string;
    width: number;
    height: number;
    rotation: PrintRotation;
}

type IPlugin = Pick<
    ServersPlugin,
    | 'insert'
    | 'loadJSON'
    | 'getJson'
    | 'dragAddItem'
    | 'clipboard'
    | 'clipboardBase64'
    | 'saveJson'
    | 'saveSvg'
    | 'getBase64'
    | 'getBase64Result'
    | 'getSVG'
    | 'getSVGResult'
    | 'saveImg'
    | 'clear'
    | 'preview'
    | 'staticPreview'
    | 'getSelectMode'
    | 'getExtensionKey'
>;

declare module '@hprint/core' {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface IEditor extends IPlugin {}
}

function transformText(objects: any) {
    if (!objects) return;
    objects.forEach((item: any) => {
        if (item.objects) {
            transformText(item.objects);
        } else {
            item.type === 'text' && (item.type = 'textbox');
        }
    });
}

class ServersPlugin implements IPluginTempl {
    public selectedMode: SelectMode;
    static pluginName = 'ServersPlugin';
    static apis = [
        'insert',
        'loadJSON',
        'getJson',
        'dragAddItem',
        'clipboard',
        'clipboardBase64',
        'saveJson',
        'saveSvg',
        'saveImg',
        'getBase64',
        'getBase64Result',
        'getSVG',
        'getSVGResult',
        'clear',
        'preview',
        'staticPreview',
        'getSelectMode',
        'getExtensionKey',
    ];
    static events = [SelectMode.ONE, SelectMode.MULTI, SelectEvent.CANCEL];
    // public hotkeys: string[] = ['left', 'right', 'down', 'up'];
    constructor(
        public canvas: fabric.Canvas,
        public editor: IEditor
    ) {
        this.selectedMode = SelectMode.EMPTY;
        this._initSelectEvent();
    }

    private _initSelectEvent() {
        this.canvas.on('selection:created', () => this._emitSelectEvent());
        this.canvas.on('selection:updated', () => this._emitSelectEvent());
        this.canvas.on('selection:cleared', () => this._emitSelectEvent());
    }

    private _emitSelectEvent() {
        if (!this.canvas) {
            throw TypeError('还未初始化');
        }

        const actives = this.canvas
            .getActiveObjects()
            .filter((item) => !(item instanceof fabric.GuideLine)); // 过滤掉辅助线
        if (actives && actives.length === 1) {
            this.selectedMode = SelectMode.ONE;
            this.editor.emit(SelectEvent.ONE, actives);
        } else if (actives && actives.length > 1) {
            this.selectedMode = SelectMode.MULTI;
            this.editor.emit(SelectEvent.MULTI, actives);
        } else {
            this.editor.emit(SelectEvent.CANCEL);
        }
    }

    getSelectMode() {
        return String(this.selectedMode);
    }

    insert(callback?: () => void) {
        selectFiles({ accept: '.json' }).then((files) => {
            if (files && files.length > 0) {
                const file = files[0];
                const reader = new FileReader();
                reader.readAsText(file, 'UTF-8');
                reader.onload = () => {
                    this.loadJSON(reader.result as string, callback);
                };
            }
        });
    }

    // 设置path属性
    renderITextPath(textPaths: Record<'id' | 'path', any>[]) {
        textPaths.forEach((item) => {
            const object = this.canvas
                .getObjects()
                .find((o) => o.id === item.id);
            if (object) {
                fabric.Path.fromObject(item.path, (e) => {
                    object.set('path', e);
                });
            }
        });
    }

    async loadJSON(jsonFile: string | object, callback?: () => void) {
        // 确保元素存在id
        const temp =
            typeof jsonFile === 'string' ? JSON.parse(jsonFile) : jsonFile;
        const textPaths: Record<'id' | 'path', any>[] = [];
        temp.objects.forEach((item: any) => {
            !item.id && (item.id = uuid());
            // 收集所有路径文本元素i-text，并设置path为null
            if (item.type === 'i-text' && item.path) {
                textPaths.push({ id: item.id, path: item.path });
                item.path = null;
            }
        });

        // hookTransform遍历
        const tempTransform = await this._transform(temp);

        jsonFile = JSON.stringify(tempTransform);
        // 加载前钩子
        this.editor.hooksEntity.hookImportBefore.callAsync(jsonFile, () => {
            this.canvas.loadFromJSON(
                jsonFile,
                () => {
                    // 把i-text对应的path加上
                    this.renderITextPath(textPaths);
                    this.canvas.renderAll();
                    // 加载后钩子
                    this.editor.hooksEntity.hookImportAfter.callAsync(
                        jsonFile,
                        () => {
                            // 修复导入带水印的json无法清除问题 #359
                            this.editor?.updateDrawStatus &&
                                typeof this.editor.updateDrawStatus ===
                                    'function' &&
                                this.editor.updateDrawStatus(
                                    !!temp['overlayImage']
                                );
                            this.canvas.renderAll();
                            callback && callback();
                            this.editor.emit('loadJson');
                        }
                    );
                },
                (originObject: any, fabricObject: fabric.Object) => {
                    this.editor.hooksEntity.hookTransformObjectEnd.callAsync(
                        { originObject, fabricObject },
                        () => {
                            this.canvas.renderAll();
                        }
                    );
                }
            );
        });
    }

    async _transform(json: any) {
        await this.promiseCallAsync(json);
        if (json.objects) {
            const all = json.objects.map((item: any) => {
                return this._transform(item);
            });
            await Promise.all(all);
        }
        return json;
    }

    promiseCallAsync(item: any) {
        return new Promise((resolve) => {
            this.editor.hooksEntity.hookTransform.callAsync(item, () => {
                resolve(item);
            });
        });
    }

    getJson(options?: { clearSrc?: boolean }) {
        const keys = this.getExtensionKey();
        const jsonObject = this.canvas.toJSON(keys);
        if (options?.clearSrc) {
            jsonObject.objects.forEach((item: any) => {
                if (
                    ['qrcode', 'barcode', 'imageTextList'].includes(
                        item.extensionType
                    )
                ) {
                    item.src = '';
                }
            });
        }
        return jsonObject;
    }

    getExtensionKey() {
        return [
            'id',
            'gradientAngle',
            'selectable',
            'hasControls',
            'linkData',
            'editable',
            'extensionType',
            'extension',
            'verticalAlign',
            'roundValue',
            'getBase64',
            'lockScalingX',
            'lockScalingY',
            '_originSize',
        ];
    }

    /**
     * @description: 拖拽添加到画布
     * @param {Event} event
     * @param {Object} item
     */
    dragAddItem(item: fabric.Object, event?: DragEvent) {
        if (event) {
            const { left, top } = this.canvas
                .getSelectionElement()
                .getBoundingClientRect();
            if (event.x < left || event.y < top || item.width === undefined)
                return;

            const point = {
                x: event.x - left,
                y: event.y - top,
            };
            const pointerVpt = this.canvas.restorePointerVpt(point);
            item.left = pointerVpt.x - item.width / 2;
            item.top = pointerVpt.y;
        }
        const { width } = this._getSaveOption();
        width && item.scaleToWidth(width / 2);
        this.canvas.add(item);
        this.canvas.setActiveObject(item);

        !event && this.editor.position('center');
        this.canvas.requestRenderAll();
    }

    clipboard() {
        const jsonStr = this.getJson();
        return clipboardText(JSON.stringify(jsonStr, null, '\t'));
    }

    async clipboardBase64() {
        const dataUrl = await this.preview();
        return clipboardText(dataUrl);
    }

    async saveJson() {
        const dataUrl = this.getJson();
        // 把文本text转为textgroup，让导入可以编辑
        await transformText(dataUrl.objects);
        const fileStr = `data:text/json;charset=utf-8,${encodeURIComponent(
            JSON.stringify(dataUrl, null, '\t')
        )}`;
        downFile(fileStr, 'json');
    }

    saveSvg() {
        this.editor.hooksEntity.hookSaveBefore.callAsync('', () => {
            const { fontOption, svgOption } = this._getSaveSvgOption();
            fabric.fontPaths = {
                ...fontOption,
            };
            const dataUrl = this.canvas.toSVG(svgOption);
            const fileStr = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(dataUrl)}`;
            this.editor.hooksEntity.hookSaveAfter.callAsync(fileStr, () => {
                downFile(fileStr, 'svg');
            });
        });
    }

    saveImg() {
        this.editor.hooksEntity.hookSaveBefore.callAsync('', () => {
            const option = this._getSaveOption();
            this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
            const dataUrl = this.canvas.toDataURL(option);
            this.editor.hooksEntity.hookSaveAfter.callAsync(dataUrl, () => {
                downFile(dataUrl, 'png');
            });
        });
    }

    getBase64(options?: PrintExportOptions) {
        return new Promise<string>((resolve) => {
            this.editor.hooksEntity.hookSaveBefore.callAsync('', () => {
                const option = this._getSaveOption();
                this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
                const dataUrl = this.canvas.toDataURL(option);
                void this.rotateBase64(dataUrl, options?.rotation).then(
                    (content) => {
                        this.editor.hooksEntity.hookSaveAfter.callAsync(
                            content,
                            () => resolve(content)
                        );
                    },
                    () => {
                        this.editor.hooksEntity.hookSaveAfter.callAsync(
                            dataUrl,
                            () => resolve(dataUrl)
                        );
                    }
                );
            });
        });
    }

    async getBase64Result(
        options?: PrintExportOptions
    ): Promise<PrintExportResult> {
        const rotation = this.normalizePrintRotation(options?.rotation);
        return {
            content: await this.getBase64({ rotation }),
            ...this.getPrintExportSize(rotation),
            rotation,
        };
    }

    getSVG(options?: PrintSVGExportOptions) {
        return new Promise<string>((resolve) => {
            this.editor.hooksEntity.hookSaveBefore.callAsync('', () => {
                this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
                const { fontOption, svgOption } = this._getSaveSvgOption({
                    ignoreFont: true,
                    width: options?.width,
                    height: options?.height,
                });
                fabric.fontPaths = {
                    ...fontOption,
                };
                const svg = this.rotateSVG(
                    this.canvas.toSVG(svgOption),
                    options?.rotation
                );
                // this._printSvgString(svg);
                this.editor.hooksEntity.hookSaveAfter.callAsync(svg, () =>
                    resolve(svg)
                );
            });
        });
    }

    async getSVGResult(
        options?: PrintSVGExportOptions
    ): Promise<PrintExportResult> {
        const rotation = this.normalizePrintRotation(options?.rotation);
        return {
            content: await this.getSVG({ ...options, rotation }),
            ...this.getPrintExportSize(rotation),
            rotation,
        };
    }

    preview() {
        return new Promise<string>((resolve) => {
            this.editor.hooksEntity.hookSaveBefore.callAsync('', () => {
                const option = this._getSaveOption();
                this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
                this.canvas.renderAll();
                const dataUrl = this.canvas.toDataURL(option);
                this.editor.hooksEntity.hookSaveAfter.callAsync(dataUrl, () => {
                    resolve(dataUrl);
                });
            });
        });
    }

    staticPreview() {
        return new Promise<string>((resolve) => {});
    }

    _getSaveSvgOption(options?: {
        ignoreFont?: boolean;
        width?: string;
        height?: string;
    }) {
        const workspace = this.canvas
            .getObjects()
            .find((item) => item.id === 'workspace');
        let fontFamilyArry = this.canvas
            .getObjects()
            .filter((item) => item.type == 'textbox')
            .map((item) => item.fontFamily);
        fontFamilyArry = Array.from(new Set(fontFamilyArry));

        const fontList = this.editor.getPlugin('FontPlugin').cacheList;

        const fontEntry = {};
        if (!options?.ignoreFont) {
            for (const font of fontFamilyArry) {
                const item = fontList.find((item) => item.name === font);
                fontEntry[font] = item.file;
            }
        }

        console.log('_getSaveSvgOption', fontEntry);
        const { left, top, width, height } = workspace as fabric.Object;
        return {
            fontOption: fontEntry,
            svgOption: {
                width: options?.width ?? width,
                height: options?.height ?? height,
                viewBox: {
                    x: left,
                    y: top,
                    width,
                    height,
                },
            },
        };
    }

    _getSaveOption() {
        const workspace = this.canvas
            .getObjects()
            .find((item: fabric.Object) => item.id === 'workspace');
        const { left, top, width, height } = workspace as fabric.Object;
        const option = {
            name: 'New Image',
            format: 'jpeg',
            quality: 1,
            multiplier: 5,
            width,
            height,
            left,
            top,
        };
        return option;
    }

    private normalizePrintRotation(rotation?: number): PrintRotation {
        return [0, 90, 180, 270].includes(Number(rotation))
            ? (Number(rotation) as PrintRotation)
            : 0;
    }

    private getPrintExportSize(rotation: PrintRotation) {
        const workspace = this.canvas
            .getObjects()
            .find((item: fabric.Object) => item.id === 'workspace') as
            | fabric.Object
            | undefined;
        const getSizeByUnit = (this.editor as any).getSizeByUnit;
        const width = workspace
            ? getSizeByUnit
                ? getSizeByUnit.call(this.editor, workspace.width || 0)
                : workspace.width || 0
            : 0;
        const height = workspace
            ? getSizeByUnit
                ? getSizeByUnit.call(this.editor, workspace.height || 0)
                : workspace.height || 0
            : 0;
        return rotation === 90 || rotation === 270
            ? { width: height, height: width }
            : { width, height };
    }

    private rotateBase64(dataUrl: string, rotation?: number) {
        const normalizedRotation = this.normalizePrintRotation(rotation);
        if (!normalizedRotation || typeof Image === 'undefined') {
            return Promise.resolve(dataUrl);
        }
        return new Promise<string>((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
                const canvas = document.createElement('canvas');
                const swapSize =
                    normalizedRotation === 90 || normalizedRotation === 270;
                canvas.width = swapSize ? image.height : image.width;
                canvas.height = swapSize ? image.width : image.height;
                const context = canvas.getContext('2d');
                if (!context) {
                    reject(new Error('无法创建旋转画布'));
                    return;
                }
                if (normalizedRotation === 90) {
                    context.translate(canvas.width, 0);
                } else if (normalizedRotation === 180) {
                    context.translate(canvas.width, canvas.height);
                } else if (normalizedRotation === 270) {
                    context.translate(0, canvas.height);
                }
                context.rotate((normalizedRotation * Math.PI) / 180);
                context.drawImage(image, 0, 0);
                const mimeType = /^data:([^;,]+)/i.exec(dataUrl)?.[1];
                resolve(canvas.toDataURL(mimeType || 'image/jpeg', 1));
            };
            image.onerror = () => reject(new Error('无法读取导出图片'));
            image.src = dataUrl;
        });
    }

    private rotateSVG(svg: string, rotation?: number) {
        const normalizedRotation = this.normalizePrintRotation(rotation);
        if (!normalizedRotation || typeof DOMParser === 'undefined') return svg;
        const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
        const root = document.documentElement;
        if (!root || root.nodeName === 'parsererror') return svg;
        const values = String(root.getAttribute('viewBox') || '')
            .trim()
            .split(/[\s,]+/)
            .map(Number);
        if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
            return svg;
        }
        const [x, y, width, height] = values;
        const originalWidth = root.getAttribute('width');
        const originalHeight = root.getAttribute('height');
        const transforms: Record<Exclude<PrintRotation, 0>, string> = {
            90: `translate(${height} 0) rotate(90) translate(${-x} ${-y})`,
            180: `translate(${width} ${height}) rotate(180) translate(${-x} ${-y})`,
            270: `translate(0 ${width}) rotate(270) translate(${-x} ${-y})`,
        };
        const transform = transforms[
            normalizedRotation as Exclude<PrintRotation, 0>
        ];
        const content = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'g'
        );
        content.setAttribute(
            'transform',
            transform
        );

        Array.from(root.childNodes).forEach((node) => {
            if (
                node.nodeType === 1 &&
                ['defs', 'style', 'desc', 'title', 'metadata'].includes(
                    (node as Element).localName
                )
            ) {
                return;
            }
            content.appendChild(node);
        });
        root.appendChild(content);
        if (normalizedRotation === 90 || normalizedRotation === 270) {
            root.setAttribute('viewBox', `0 0 ${height} ${width}`);
            if (originalHeight) root.setAttribute('width', originalHeight);
            if (originalWidth) root.setAttribute('height', originalWidth);
        } else {
            root.setAttribute('viewBox', `0 0 ${width} ${height}`);
        }
        return new XMLSerializer().serializeToString(root);
    }

    clear() {
        this.canvas.getObjects().forEach((obj) => {
            if (obj.id !== 'workspace') {
                this.canvas.remove(obj);
            }
        });
        this.editor?.setWorkspaseBg('#fff');
        this.canvas.discardActiveObject();
        this.canvas.renderAll();
    }

    destroy() {
        console.log('pluginDestroy');
    }
}

export default ServersPlugin;
