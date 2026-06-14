import { fabric } from '@hprint/core';
import type { IEditor, IPluginTempl } from '@hprint/core';
import { getUnit, convertSingle, formatOriginValues } from '../utils/units';

export type ImageTextListLayout =
    | 'item-vertical'
    | 'icon-text-split'
    | 'icon-only'
    | 'text-only';

export interface ImageTextListItem {
    src: string;
    name: string;
}

export interface ImageTextListOptions {
    items?: ImageTextListItem[];
    _renderItems?: ImageTextListItem[];
    _clipContent?: boolean;
    layout?: ImageTextListLayout;
    width?: number;
    height?: number;
    iconSize?: number;
    horizontalGap?: number;
    verticalGap?: number;
    itemGap?: number;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string;
    fontStyle?: string;
    underline?: boolean | string;
    linethrough?: boolean | string;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    textWrap?: boolean;
    lineHeight?: number;
    charSpacing?: number;
    color?: string;
    [key: string]: any;
}

type ImageTextListGroup = fabric.Group & {
    extensionType?: string;
    extension?: ImageTextListOptions;
    _originSize?: Record<string, any>;
    setExtension?: (fields: Record<string, any>) => Promise<void>;
    setExtensionByUnit?: (fields: Record<string, any>) => Promise<void>;
    setByUnit?: (field: string, value: any) => Promise<any>;
    __imageTextListModified?: () => void;
};

type IPlugin = Pick<
    ImageTextListPlugin,
    'createImageTextList' | 'initImageTextListEvents' | 'refreshImageTextList'
>;

declare module '@hprint/core' {
    interface IEditor extends IPlugin {}
}

const DEFAULT_OPTIONS: Required<
    Pick<
        ImageTextListOptions,
        | 'layout'
        | 'width'
        | 'iconSize'
        | 'horizontalGap'
        | 'verticalGap'
        | 'itemGap'
        | 'fontFamily'
        | 'fontSize'
        | 'fontWeight'
        | 'fontStyle'
        | 'underline'
        | 'linethrough'
        | 'textAlign'
        | 'textWrap'
        | 'lineHeight'
        | 'charSpacing'
        | 'color'
    >
> = {
    layout: 'item-vertical',
    width: 30,
    iconSize: 5,
    horizontalGap: 1.5,
    verticalGap: 1.5,
    itemGap: 1.5,
    fontFamily: 'Microsoft YaHei',
    fontSize: 3,
    fontWeight: 'normal',
    fontStyle: 'normal',
    underline: false,
    linethrough: false,
    textAlign: 'left',
    textWrap: true,
    lineHeight: 1.5,
    charSpacing: 0,
    color: '#000000',
};

class ImageTextListPlugin implements IPluginTempl {
    static pluginName = 'ImageTextListPlugin';
    static apis = [
        'createImageTextList',
        'initImageTextListEvents',
        'refreshImageTextList',
    ];

    constructor(
        public canvas: fabric.Canvas,
        public editor: IEditor
    ) {}

    async hookTransform(object: any) {
        if (object.extensionType !== 'imageTextList') return;
        const left = object.left;
        const top = object.top;
        const group = await this.buildGroup(object.extension || {});
        const transformed = group.toObject(this.editor.getExtensionKey?.() || []);
        Object.assign(object, transformed, {
            left,
            top,
            extensionType: 'imageTextList',
            extension: this.normalizeOptions(object.extension || {}),
        });
    }

    async hookTransformObjectEnd(...args: unknown[]) {
        const { originObject, fabricObject } = args[0] as {
            originObject: any;
            fabricObject: ImageTextListGroup;
        };
        if (originObject.extensionType === 'imageTextList') {
            this.initImageTextListEvents(fabricObject);
        }
    }

    async createImageTextList(
        items: ImageTextListItem[],
        options: ImageTextListOptions = {}
    ): Promise<ImageTextListGroup> {
        const extension = this.normalizeOptions({ ...options, items });
        const group = await this.buildGroup(extension);
        group.set({
            extensionType: 'imageTextList',
            extension,
        } as any);
        this.updateOriginSize(group, extension);
        this.initImageTextListEvents(group);
        return group;
    }

    initImageTextListEvents(group: ImageTextListGroup) {
        group.setExtension = async (fields: Record<string, any>) => {
            const extension = this.normalizeOptions({
                ...(group.get('extension') || {}),
                ...(fields || {}),
            });
            group.set('extension', extension);
            await this.refreshImageTextList(group);
        };
        group.setExtensionByUnit = group.setExtension;

        this.editor.addSetAndSyncByUnit?.(group);
        const originalSetByUnit = group.setByUnit?.bind(group);
        if (originalSetByUnit) {
            group.setByUnit = async (field: string, value: any) => {
                if (field === 'width' || field === 'height') {
                    const extension = this.normalizeOptions({
                        ...(group.get('extension') || {}),
                        [field]: Number(value),
                    });
                    group.set('extension', extension);
                    await this.refreshImageTextList(group);
                    return group;
                }
                return originalSetByUnit(field, value);
            };
        }

        if (group.__imageTextListModified) {
            group.off('modified', group.__imageTextListModified);
        }
        group.__imageTextListModified = () => {
            const scaleX = group.scaleX || 1;
            const scaleY = group.scaleY || 1;
            if (scaleX === 1 && scaleY === 1) return;
            const extension = this.normalizeOptions(group.get('extension') || {});
            const widthPx = Math.max(1, (group.width || 1) * scaleX);
            const heightPx = Math.max(1, (group.height || 1) * scaleY);
            group.set({ scaleX: 1, scaleY: 1 });
            group.set('extension', {
                ...extension,
                width:
                    getUnit(this.editor) === 'px'
                        ? widthPx
                        : this.editor.getSizeByUnit(widthPx),
                height:
                    getUnit(this.editor) === 'px'
                        ? heightPx
                        : this.editor.getSizeByUnit(heightPx),
            });
            void this.refreshImageTextList(group);
        };
        group.on('modified', group.__imageTextListModified);
    }

    async refreshImageTextList(group: ImageTextListGroup) {
        const extension = this.normalizeOptions(group.get('extension') || {});
        const left = group.left;
        const top = group.top;
        const replacement = await this.buildGroup(extension);
        const children = replacement.getObjects();

        (group as any)._objects = children;
        children.forEach((child) => {
            child.group = group;
        });
        (replacement as any)._objects = [];

        group.set({
            left,
            top,
            width: replacement.width,
            height: replacement.height,
            scaleX: 1,
            scaleY: 1,
            visible: replacement.visible,
            clipPath: replacement.clipPath,
            objectCaching: Boolean(replacement.clipPath),
            dirty: true,
        });
        this.updateOriginSize(group, extension);
        group.setCoords();
        this.canvas.requestRenderAll();
    }

    private normalizeOptions(options: ImageTextListOptions) {
        return {
            ...DEFAULT_OPTIONS,
            ...options,
            items: Array.isArray(options.items) ? options.items : [],
        } as ImageTextListOptions;
    }

    private toPx(value: number | undefined) {
        return convertSingle(Number(value) || 0, getUnit(this.editor));
    }

    private getItems(options: ImageTextListOptions) {
        return (
            options._renderItems?.length
                ? options._renderItems
                : options.items || []
        ).filter((item) => item && (item.src || item.name));
    }

    private createText(
        text: string,
        options: ImageTextListOptions,
        width?: number
    ) {
        const fontSize = Math.max(1, this.toPx(options.fontSize));
        const charSpacingPx = Math.max(0, this.toPx(options.charSpacing));
        const common = {
            fontFamily: options.fontFamily,
            fontSize,
            fontWeight: options.fontWeight as any,
            fontStyle: options.fontStyle as any,
            underline: Boolean(options.underline),
            linethrough: Boolean(options.linethrough),
            fill: options.color,
            textAlign: options.textAlign,
            lineHeight: Number(options.lineHeight) || 1,
            charSpacing: (charSpacingPx / fontSize) * 1000,
            splitByGrapheme: true,
            selectable: false,
            evented: false,
            objectCaching: false,
        };
        const textObject = width && options.textWrap !== false
            ? new fabric.Textbox(text || '', { ...common, width })
            : new fabric.Text(text || '', common);
        textObject.initDimensions();
        textObject.setCoords();
        return textObject;
    }

    private loadImage(src: string, size: number) {
        return new Promise<fabric.Image | null>((resolve) => {
            if (!src) return resolve(null);
            fabric.Image.fromURL(
                src,
                (image) => {
                    image.set({
                        scaleX: size / Math.max(1, image.width || 1),
                        scaleY: size / Math.max(1, image.height || 1),
                        selectable: false,
                        evented: false,
                        objectCaching: false,
                    });
                    resolve(image);
                },
                { crossOrigin: 'anonymous' }
            );
        });
    }

    private async buildGroup(options: ImageTextListOptions) {
        const normalized = this.normalizeOptions(options);
        const items = this.getItems(normalized);
        const width = Math.max(1, this.toPx(normalized.width));
        if (!items.length) {
            return this.createGroup([], width, 1, false);
        }

        const layout = normalized.layout || DEFAULT_OPTIONS.layout;
        const showIcon = layout !== 'text-only';
        const showText = layout !== 'icon-only';
        const iconSize = Math.max(1, this.toPx(normalized.iconSize));
        const horizontalGap = Math.max(0, this.toPx(normalized.horizontalGap));
        const verticalGap = Math.max(0, this.toPx(normalized.verticalGap));
        const itemGap = Math.max(0, this.toPx(normalized.itemGap));
        const images = showIcon
            ? await Promise.all(items.map((item) => this.loadImage(item.src, iconSize)))
            : items.map(() => null);
        const objects: fabric.Object[] = [];
        let cursorY = 0;

        if (layout === 'icon-text-split') {
            const iconRows = this.flowRows(
                items.map(() => iconSize),
                width,
                horizontalGap
            );
            iconRows.forEach((row) => {
                row.items.forEach((cell) => {
                    const image = images[cell.index];
                    if (image) {
                        image.set({ left: cell.x, top: cursorY });
                        objects.push(image);
                    }
                });
                cursorY += iconSize + verticalGap;
            });
            items.forEach((item) => {
                const text = this.createText(item.name || '', normalized, width);
                text.set({ left: 0, top: cursorY });
                objects.push(text);
                cursorY += text.getScaledHeight() + itemGap;
            });
        } else if (layout === 'item-vertical') {
            const textLeft = iconSize + horizontalGap;
            const textWidth = Math.max(1, width - textLeft);
            items.forEach((item, index) => {
                const image = images[index];
                const text = this.createText(
                    item.name || '',
                    normalized,
                    textWidth
                );
                const textHeight = text.getScaledHeight();
                const rowHeight = Math.max(iconSize, textHeight);
                if (image) {
                    image.set({
                        left: 0,
                        top: cursorY + (rowHeight - iconSize) / 2,
                    });
                    objects.push(image);
                }
                text.set({
                    left: textLeft,
                    top: cursorY + (rowHeight - textHeight) / 2,
                });
                objects.push(text);
                cursorY += rowHeight + verticalGap;
            });
        } else {
            const textObjects = items.map((item) =>
                showText ? this.createText(item.name || '', normalized) : null
            );
            const itemWidths = items.map((_, index) => {
                const textWidth = textObjects[index]?.getScaledWidth() || 0;
                if (showIcon && showText)
                    return iconSize + horizontalGap + textWidth;
                return showIcon ? iconSize : textWidth;
            });
            const rows = this.flowRows(itemWidths, width, horizontalGap);
            rows.forEach((row) => {
                const rowHeight = Math.max(
                    showIcon ? iconSize : 0,
                    ...row.items.map(
                        (cell) => textObjects[cell.index]?.getScaledHeight() || 0
                    )
                );
                row.items.forEach((cell) => {
                    let x = cell.x;
                    const image = images[cell.index];
                    const text = textObjects[cell.index];
                    if (showIcon && image) {
                        image.set({
                            left: x,
                            top: cursorY + (rowHeight - iconSize) / 2,
                        });
                        objects.push(image);
                        x += iconSize + (showText ? horizontalGap : 0);
                    }
                    if (showText && text) {
                        text.set({
                            left: x,
                            top: cursorY + (rowHeight - text.getScaledHeight()) / 2,
                        });
                        objects.push(text);
                    }
                });
                cursorY += rowHeight + verticalGap;
            });
        }

        const trailingGap =
            layout === 'icon-text-split' ? itemGap : verticalGap;
        const naturalHeight = Math.max(1, cursorY - trailingGap);
        const configuredHeight = Number(normalized.height);
        const height =
            configuredHeight > 0
                ? Math.max(1, this.toPx(configuredHeight))
                : naturalHeight;
        return this.createGroup(
            objects,
            width,
            height,
            true,
            normalized._clipContent
        );
    }

    private createGroup(
        objects: fabric.Object[],
        width: number,
        height: number,
        visible: boolean,
        clipContent = false
    ) {
        const boundary = new fabric.Rect({
            left: 0,
            top: 0,
            width,
            height,
            fill: 'rgba(0,0,0,0)',
            strokeWidth: 0,
            selectable: false,
            evented: false,
        });
        const group = new fabric.Group([boundary], {
            width,
            height,
            visible,
            // Fabric 5 renders clipPath through the object cache.
            objectCaching: clipContent,
            subTargetCheck: false,
            clipPath: clipContent
                ? new fabric.Rect({
                    width,
                    height,
                    originX: 'center',
                    originY: 'center',
                })
                : undefined,
        }) as ImageTextListGroup;

        // Keep the configured boundary fixed. Overflowing content starts at the
        // group's top edge and grows downward without changing the group size.
        objects.forEach((object) => {
            object.set({
                left: (object.left || 0) - width / 2,
                top: (object.top || 0) - height / 2,
            });
            object.group = group;
        });
        (group as any)._objects.push(...objects);
        group.setCoords();
        return group;
    }

    private flowRows(widths: number[], maxWidth: number, gap: number) {
        const rows: Array<{
            items: Array<{ index: number; x: number; width: number }>;
        }> = [];
        let row = {
            items: [] as Array<{ index: number; x: number; width: number }>,
        };
        let x = 0;
        widths.forEach((rawWidth, index) => {
            const width = Math.min(Math.max(1, rawWidth), maxWidth);
            if (row.items.length && x + width > maxWidth) {
                rows.push(row);
                row = { items: [] };
                x = 0;
            }
            row.items.push({ index, x, width });
            x += width + gap;
        });
        if (row.items.length) rows.push(row);
        return rows;
    }

    private updateOriginSize(
        group: ImageTextListGroup,
        extension: ImageTextListOptions
    ) {
        const unit = getUnit(this.editor);
        const origin = group._originSize || {};
        group._originSize = {
            ...origin,
            [unit]: formatOriginValues(
                {
                    ...(origin[unit] || {}),
                    width: extension.width,
                    height:
                        extension.height ??
                        (unit === 'px'
                            ? group.height
                            : this.editor.getSizeByUnit(group.height || 1)),
                },
                (this.editor as any).getPrecision?.()
            ),
        };
    }

    destroy() {}
}

export default ImageTextListPlugin;
