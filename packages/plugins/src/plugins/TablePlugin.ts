import { fabric } from '@hprint/core';
import type { IEditor, IPluginTempl } from '@hprint/core';
import { convertSingle, formatOriginValues, getUnit } from '../utils/units';

export interface TableColumn {
    title: string;
    field: string;
    width: number | `${number}%`;
}

export interface ITableItem {
    type: 'table';
    key: string;
    title: string;
    columns: TableColumn[];
    data?: Array<Record<string, unknown>>;
    headerHeight?: number;
    rowHeight?: number;
    height?: number;
    heightAllocationMode?: 'stretch' | 'grow';
    cellPaddingHorizontal?: number;
    cellPaddingVertical?: number;
    textOverflow?: 'wrap' | 'ellipsis';
    textAlign?: 'left' | 'center' | 'right' | 'justify';
}

export interface TableOptions {
    width?: number;
    height?: number;
    headerHeight?: number;
    rowHeight?: number;
    heightAllocationMode?: 'stretch' | 'grow';
    borderWidth?: number;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string;
    fontStyle?: string;
    underline?: boolean | string;
    linethrough?: boolean | string;
    textOverflow?: 'wrap' | 'ellipsis';
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    lineHeight?: number;
    charSpacing?: number;
    color?: string;
    cellPadding?: number;
    cellPaddingHorizontal?: number;
    cellPaddingVertical?: number;
    data?: Array<Record<string, unknown>>;
    _field_?: string;
    _renderRows?: Array<Record<string, unknown>>;
    _clipContent?: boolean;
    _actualContentLayout?: boolean;
    [key: string]: any;
}

export type TableGroup = fabric.Group & {
    extensionType?: string;
    extension?: TableOptions & { columns: TableColumn[] };
    _originSize?: Record<string, any>;
    setExtension?: (fields: Record<string, any>) => Promise<void>;
    setExtensionByUnit?: (fields: Record<string, any>) => Promise<void>;
    setByUnit?: (field: string, value: any) => Promise<any>;
    __tableModified?: () => void;
};

type IPlugin = Pick<
    TablePlugin,
    'createTable' | 'initTableEvents' | 'refreshTable'
>;

declare module '@hprint/core' {
    interface IEditor extends IPlugin {}
}

let tableCellClipId = 0;

type TableCellTextboxInstance = fabric.Textbox & {
    cellClipWidth: number;
    cellClipHeight: number;
    cellClipTopOffset: number;
    cellClipOffsetY: number;
};

// Keep the cell clipping behavior on the Fabric class itself instead of
// patching individual Textbox instances. History/loadFromJSON recreates child
// objects from their serialized type, so an instance-only renderer disappears
// after undo/redo and wrapped text can leak outside the cell.
const TableCellTextbox = fabric.util.createClass(fabric.Textbox, {
    type: 'TableCellTextbox',

    initialize(text: string, options: Record<string, any> = {}) {
        this.callSuper('initialize', text, options);
        this.cellClipWidth = Math.max(1, Number(options.cellClipWidth) || 1);
        this.cellClipHeight = Math.max(1, Number(options.cellClipHeight) || 1);
        this.cellClipTopOffset = Number(options.cellClipTopOffset) || 0;
        this.cellClipOffsetY = Number(options.cellClipOffsetY) || 0;
    },

    _render(ctx: CanvasRenderingContext2D) {
        ctx.save();
        try {
            ctx.beginPath();
            ctx.rect(
                -this.cellClipWidth / 2,
                -this.cellClipHeight / 2 + this.cellClipOffsetY,
                this.cellClipWidth,
                this.cellClipHeight
            );
            ctx.clip();
            this.callSuper('_render', ctx);
        } finally {
            ctx.restore();
        }
    },

    toObject(propertiesToInclude?: string[]) {
        return this.callSuper('toObject', [
            ...(propertiesToInclude || []),
            'cellClipWidth',
            'cellClipHeight',
            'cellClipTopOffset',
            'cellClipOffsetY',
        ]);
    },

    toSVG(reviver?: (markup: string) => string) {
        const markup = this.callSuper('toSVG', reviver);
        const clipId = `hprint-table-cell-${++tableCellClipId}`;
        const clipLeft = Number(this.left) || 0;
        const clipTop =
            (Number(this.top) || 0) + Number(this.cellClipTopOffset || 0);
        return `<defs><clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><rect x="${clipLeft}" y="${clipTop}" width="${this.cellClipWidth}" height="${this.cellClipHeight}" /></clipPath></defs><g clip-path="url(#${clipId})">${markup}</g>`;
    },
}) as any;

(fabric as any).TableCellTextbox = TableCellTextbox;
(fabric as any).TableCellTextbox.fromObject = (
    object: Record<string, any>,
    callback?: (instance: TableCellTextboxInstance) => void
) => {
    const instance = new TableCellTextbox(
        String(object.text ?? ''),
        object
    ) as TableCellTextboxInstance;
    callback?.(instance);
    return instance;
};

const DEFAULT_OPTIONS: Required<
    Pick<
        TableOptions,
        | 'width'
        | 'height'
        | 'headerHeight'
        | 'rowHeight'
        | 'heightAllocationMode'
        | 'borderWidth'
        | 'fontFamily'
        | 'fontSize'
        | 'fontWeight'
        | 'fontStyle'
        | 'underline'
        | 'linethrough'
        | 'textOverflow'
        | 'textAlign'
        | 'lineHeight'
        | 'charSpacing'
        | 'color'
        | 'cellPadding'
        | 'cellPaddingHorizontal'
        | 'cellPaddingVertical'
    >
> = {
    width: 40,
    height: 12,
    headerHeight: 6,
    rowHeight: 6,
    heightAllocationMode: 'stretch',
    borderWidth: 0.2,
    fontFamily: 'Microsoft YaHei',
    fontSize: 3,
    fontWeight: 'normal',
    fontStyle: 'normal',
    underline: false,
    linethrough: false,
    textOverflow: 'wrap',
    textAlign: 'left',
    lineHeight: 1.5,
    charSpacing: 0,
    color: '#000000',
    cellPadding: 1,
    cellPaddingHorizontal: 1,
    cellPaddingVertical: 1,
};

export function normalizeTableColumns(columns: TableColumn[]) {
    if (!Array.isArray(columns) || columns.length === 0) {
        throw new Error('表格至少需要配置一列');
    }

    const normalized = columns.map((column, index) => {
        if (!column || !String(column.field || '').trim()) {
            throw new Error(`表格第 ${index + 1} 列缺少 field`);
        }
        const percent = typeof column.width === 'string';
        let weight: number;
        if (percent) {
            const raw = String(column.width).trim();
            if (!/^\d+(?:\.\d+)?%$/.test(raw)) {
                throw new Error(`表格第 ${index + 1} 列的百分比宽度无效`);
            }
            weight = Number.parseFloat(raw.slice(0, -1));
        } else {
            weight = Number(column.width);
        }
        if (!Number.isFinite(weight) || weight <= 0) {
            throw new Error(`表格第 ${index + 1} 列的宽度必须大于 0`);
        }
        return {
            ...column,
            title: String(column.title ?? ''),
            field: String(column.field),
            width: column.width,
            weight,
            widthType: percent ? 'percent' : 'number',
        };
    });

    const widthTypes = new Set(normalized.map((column) => column.widthType));
    if (widthTypes.size > 1) {
        throw new Error('表格列宽不能混用数值和百分比');
    }
    const total = normalized.reduce((sum, column) => sum + column.weight, 0);
    return normalized.map(({ weight, widthType, ...column }) => ({
        ...column,
        ratio: weight / total,
    }));
}

class TablePlugin implements IPluginTempl {
    static pluginName = 'TablePlugin';
    static apis = ['createTable', 'initTableEvents', 'refreshTable'];

    constructor(
        public canvas: fabric.Canvas,
        public editor: IEditor
    ) {}

    async hookTransform(object: any) {
        if (object.extensionType !== 'table') return;
        const left = object.left;
        const top = object.top;
        const sourceExtension = { ...(object.extension || {}) };
        if (!Number.isFinite(Number(sourceExtension.height))) {
            const unit = getUnit(this.editor);
            const originHeight = Number(object._originSize?.[unit]?.height);
            sourceExtension.height = Number.isFinite(originHeight)
                ? originHeight
                : unit === 'px'
                  ? Math.abs(Number(object.height || 1) * Number(object.scaleY || 1))
                  : this.editor.getSizeByUnit(
                        Math.abs(Number(object.height || 1) * Number(object.scaleY || 1))
                    );
        }
        const extension = this.normalizeOptions(sourceExtension);
        const group = this.buildGroup(extension);
        this.updateOriginSize(group, extension);
        const transformed = group.toObject(
            this.editor.getExtensionKey?.() || []
        );
        Object.assign(object, transformed, {
            left,
            top,
            extensionType: 'table',
            extension,
        });
    }

    async hookTransformObjectEnd(...args: unknown[]) {
        const { originObject, fabricObject } = args[0] as {
            originObject: any;
            fabricObject: TableGroup;
        };
        if (originObject.extensionType === 'table') {
            this.initTableEvents(fabricObject);
        }
    }

    createTable(
        columns: TableColumn[],
        options: TableOptions = {}
    ): TableGroup {
        const extension = this.normalizeOptions({ ...options, columns });
        const group = this.buildGroup(extension);
        group.set({ extensionType: 'table', extension } as any);
        this.updateOriginSize(group, extension);
        this.initTableEvents(group);
        return group;
    }

    initTableEvents(group: TableGroup) {
        group.setExtension = async (fields: Record<string, any>) => {
            const extension = this.normalizeOptions({
                ...(group.get('extension') || {}),
                ...(fields || {}),
            });
            group.set('extension' as any, extension as any);
            await this.refreshTable(group);
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
                    group.set('extension' as any, extension as any);
                    await this.refreshTable(group);
                    return group;
                }
                return originalSetByUnit(field, value);
            };
        }

        if (group.__tableModified) {
            group.off('modified', group.__tableModified);
        }
        group.__tableModified = () => {
            const scaleX = Math.abs(group.scaleX || 1);
            const scaleY = Math.abs(group.scaleY || 1);
            if (scaleX === 1 && scaleY === 1) return;
            const extension = this.normalizeOptions(
                group.get('extension') || {}
            );
            const scaledHeight = Math.max(
                1,
                Number(group.height || 1) * scaleY
            );
            group.set({ scaleX: 1, scaleY: 1 });
            group.set(
                'extension' as any,
                {
                    ...extension,
                    width: extension.width * scaleX,
                    height:
                        getUnit(this.editor) === 'px'
                            ? scaledHeight
                            : this.editor.getSizeByUnit(scaledHeight),
                } as any
            );
            void this.refreshTable(group);
        };
        group.on('modified', group.__tableModified);
    }

    async refreshTable(group: TableGroup) {
        const extension = this.normalizeOptions(group.get('extension') || {});
        const left = group.left;
        const top = group.top;
        const replacement = this.buildGroup(extension);
        const children = replacement.getObjects();

        // A scaled Fabric group can retain its previous bitmap cache even after
        // scaleX/scaleY are normalized. Drop it before replacing the children so
        // text is rasterized again at the new table dimensions.
        (group as any)._removeCacheCanvas?.();

        (group as any)._objects = children;
        children.forEach((child) => {
            child.group = group;
            child.set({ dirty: true, noScaleCache: false } as any);
        });
        (replacement as any)._objects = [];

        group.set({
            left,
            top,
            width: replacement.width,
            height: replacement.height,
            scaleX: 1,
            scaleY: 1,
            clipPath: undefined,
            objectCaching: false,
            noScaleCache: false,
            dirty: true,
        });
        group.set('extension' as any, extension as any);
        this.updateOriginSize(group, extension);
        group.setCoords();
        this.canvas.requestRenderAll();
    }

    private normalizeOptions(
        options: TableOptions & { columns?: TableColumn[] }
    ) {
        const columns = (options.columns || []).map((column) => ({
            ...column,
        }));
        normalizeTableColumns(columns);
        const cellPadding = this.nonNegativeNumber(
            options.cellPadding,
            DEFAULT_OPTIONS.cellPadding
        );
        return {
            ...DEFAULT_OPTIONS,
            ...options,
            width: this.positiveNumber(options.width, DEFAULT_OPTIONS.width),
            height: Math.max(
                this.positiveNumber(options.headerHeight, DEFAULT_OPTIONS.headerHeight),
                this.positiveNumber(options.height, DEFAULT_OPTIONS.height)
            ),
            headerHeight: this.positiveNumber(
                options.headerHeight,
                DEFAULT_OPTIONS.headerHeight
            ),
            rowHeight: this.positiveNumber(
                options.rowHeight,
                DEFAULT_OPTIONS.rowHeight
            ),
            borderWidth: this.nonNegativeNumber(
                options.borderWidth,
                DEFAULT_OPTIONS.borderWidth
            ),
            cellPadding,
            cellPaddingHorizontal: this.nonNegativeNumber(
                options.cellPaddingHorizontal,
                cellPadding
            ),
            cellPaddingVertical: this.nonNegativeNumber(
                options.cellPaddingVertical,
                cellPadding
            ),
            fontSize: this.positiveNumber(
                options.fontSize,
                DEFAULT_OPTIONS.fontSize
            ),
            lineHeight: this.positiveNumber(
                options.lineHeight,
                DEFAULT_OPTIONS.lineHeight
            ),
            charSpacing: this.nonNegativeNumber(
                options.charSpacing,
                DEFAULT_OPTIONS.charSpacing
            ),
            textOverflow:
                options.textOverflow === 'ellipsis' ? 'ellipsis' : 'wrap',
            heightAllocationMode:
                options.heightAllocationMode === 'grow' ? 'grow' : 'stretch',
            columns,
        } as Required<
            Pick<
                TableOptions,
                | 'width'
                | 'height'
                | 'headerHeight'
                | 'rowHeight'
                | 'heightAllocationMode'
                | 'borderWidth'
                | 'cellPadding'
                | 'fontSize'
                | 'lineHeight'
                | 'charSpacing'
                | 'textOverflow'
                | 'cellPaddingHorizontal'
                | 'cellPaddingVertical'
            >
        > &
            TableOptions & { columns: TableColumn[] };
    }

    private positiveNumber(value: unknown, fallback: number) {
        const number = Number(value);
        return Number.isFinite(number) && number > 0 ? number : fallback;
    }

    private nonNegativeNumber(value: unknown, fallback: number) {
        const number = Number(value);
        return Number.isFinite(number) && number >= 0 ? number : fallback;
    }

    private toPx(value: number | undefined) {
        return convertSingle(Number(value) || 0, getUnit(this.editor));
    }

    private buildGroup(
        extension: TableOptions & { columns: TableColumn[] }
    ): TableGroup {
        const normalizedColumns = normalizeTableColumns(extension.columns);
        const width = Math.max(1, this.toPx(extension.width));
        const headerHeight = Math.max(1, this.toPx(extension.headerHeight));
        const designHeight = Math.max(headerHeight, this.toPx(extension.height));
        const minimumRowHeight = Math.max(1, this.toPx(extension.rowHeight));
        const borderWidth = Math.max(0, this.toPx(extension.borderWidth));
        const rows = Array.isArray(extension._renderRows)
            ? extension._renderRows
            : [];
        const growByContent = extension.heightAllocationMode === 'grow';
        const verticalPadding = growByContent
            ? Math.max(
                  0,
                  this.toPx(
                      extension.cellPaddingVertical ?? extension.cellPadding
                  )
              )
            : 0;

        const columnBounds: Array<{ left: number; width: number }> = [];
        let left = 0;
        normalizedColumns.forEach((column, index) => {
            const columnWidth =
                index === normalizedColumns.length - 1
                    ? width - left
                    : width * column.ratio;
            columnBounds.push({ left, width: columnWidth });
            left += columnWidth;
        });

        const rowHeights = growByContent
            ? rows.map((row) =>
                  Math.max(
                      minimumRowHeight,
                      ...columnBounds.map((column, columnIndex) => {
                          const field = extension.columns[columnIndex].field;
                          return (
                              this.measureCellTextHeight(
                                  row?.[field],
                                  column.width,
                                  extension
                              ) +
                              verticalPadding * 2
                          );
                      })
                  )
              )
            : rows.map(() =>
                  Math.max(1, (designHeight - headerHeight) / rows.length)
              );
        const naturalHeight =
            headerHeight + rowHeights.reduce((sum, height) => sum + height, 0);
        const visibleHeight = !rows.length
            ? headerHeight
            : growByContent
              ? extension._actualContentLayout
                  ? naturalHeight
                  : Math.min(naturalHeight, designHeight)
              : designHeight;
        const groupHeight = Math.max(1, visibleHeight);
        const objects: fabric.Object[] = [];

        const boundary = new fabric.Rect({
            left: 0,
            top: 0,
            width,
            height: groupHeight,
            fill: 'rgba(0,0,0,0)',
            strokeWidth: 0,
            selectable: false,
            evented: false,
        });
        objects.push(boundary);

        columnBounds.forEach((column, index) => {
            objects.push(
                this.createCellText(
                    extension.columns[index].title,
                    column.left,
                    0,
                    column.width,
                    headerHeight,
                    extension,
                    Math.min(headerHeight, visibleHeight),
                    verticalPadding
                )
            );
        });
        let rowTop = headerHeight;
        const renderedRowTops: number[] = [];
        rows.forEach((row, rowIndex) => {
            const rowHeight = rowHeights[rowIndex];
            if (rowTop >= visibleHeight) return;
            const visibleRowHeight = Math.min(
                rowHeight,
                visibleHeight - rowTop
            );
            renderedRowTops.push(rowTop);
            columnBounds.forEach((column, columnIndex) => {
                const field = extension.columns[columnIndex].field;
                const value = row?.[field];
                objects.push(
                    this.createCellText(
                        value == null ? '' : String(value),
                        column.left,
                        rowTop,
                        column.width,
                        rowHeight,
                        extension,
                        visibleRowHeight,
                        verticalPadding
                    )
                );
            });
            rowTop += rowHeight;
        });

        const renderedBorderWidth = Math.min(borderWidth, width, visibleHeight);
        const lineOptions = {
            stroke: '#000000',
            strokeWidth: renderedBorderWidth,
            selectable: false,
            evented: false,
            objectCaching: false,
        };
        const edgeOffset = renderedBorderWidth / 2;
        objects.push(
            new fabric.Rect({
                // Fabric positions a stroked Rect by its outer bounds. Its
                // stroke is already included in left/top, so adding half the
                // stroke here shifts the visible table down and right from the
                // group's controls.
                left: 0,
                top: 0,
                width: Math.max(0, width - renderedBorderWidth),
                height: Math.max(0, visibleHeight - renderedBorderWidth),
                fill: 'rgba(0,0,0,0)',
                ...lineOptions,
            })
        );
        const horizontalLines = renderedRowTops.filter(
            (top) => top < visibleHeight
        );
        horizontalLines.forEach((top) => {
            objects.push(
                new fabric.Line(
                    [edgeOffset, top, width - edgeOffset, top],
                    lineOptions
                )
            );
        });
        const verticalLines = columnBounds
            .slice(1)
            .map((column) => column.left);
        verticalLines.forEach((columnLeft) => {
            objects.push(
                new fabric.Line(
                    [
                        columnLeft,
                        edgeOffset,
                        columnLeft,
                        visibleHeight - edgeOffset,
                    ],
                    lineOptions
                )
            );
        });

        // Let only the transparent boundary establish the group coordinate
        // system. A Textbox may be taller than its cell before it is visually
        // clipped; including that raw textbox in Fabric's initial bounds would
        // move the group origin and make the controls drift vertically from the
        // visible table.
        const contentObjects = objects.slice(1);
        const group = new fabric.Group([boundary], {
            width,
            height: groupHeight,
            subTargetCheck: false,
            // Only the rows that fit the design height are constructed in clip
            // mode, so a group-level clip/cache is unnecessary. Rendering the
            // group directly keeps text sharp while and after resizing.
            objectCaching: false,
            noScaleCache: false,
        }) as TableGroup;

        contentObjects.forEach((object) => {
            object.set({
                left: (object.left || 0) - width / 2,
                top: (object.top || 0) - groupHeight / 2,
            });
            object.group = group;
        });
        (group as any)._objects.push(...contentObjects);

        group.set({ width, height: groupHeight });
        group.setCoords();
        return group;
    }

    private createCellText(
        text: unknown,
        left: number,
        top: number,
        width: number,
        height: number,
        extension: TableOptions,
        visibleHeight = height,
        verticalPaddingOverride?: number
    ) {
        const horizontalPadding = Math.max(
            0,
            this.toPx(extension.cellPaddingHorizontal ?? extension.cellPadding)
        );
        const verticalPadding =
            verticalPaddingOverride ??
            Math.max(
                0,
                this.toPx(
                    extension.cellPaddingVertical ?? extension.cellPadding
                )
            );
        const fontSize = Math.max(1, this.toPx(extension.fontSize));
        const charSpacingPx = Math.max(0, this.toPx(extension.charSpacing));
        const textWidth = Math.max(1, width - horizontalPadding * 2);
        const clipTop = Math.min(height, verticalPadding);
        const clipBottom = Math.max(
            clipTop,
            Math.min(height - verticalPadding, visibleHeight)
        );
        const textHeight = Math.max(0.01, clipBottom - clipTop);
        const textStyle = {
            fontFamily: extension.fontFamily,
            fontSize,
            fontWeight: extension.fontWeight as any,
            fontStyle: extension.fontStyle as any,
            charSpacing: (charSpacingPx / fontSize) * 1000,
        };
        const textValue =
            extension.textOverflow === 'ellipsis'
                ? this.ellipsizeCellText(
                      String(text ?? ''),
                      textWidth,
                      textStyle
                  )
                : String(text ?? '');
        const textObject = new TableCellTextbox(textValue, {
            left: left + horizontalPadding,
            top,
            width: textWidth,
            cellClipWidth: textWidth,
            cellClipHeight: textHeight,
            cellClipOffsetY:
                (clipTop + clipBottom) / 2 - height / 2,
            ...textStyle,
            underline: Boolean(extension.underline),
            linethrough: Boolean(extension.linethrough),
            fill: extension.color,
            textAlign: extension.textAlign,
            lineHeight: Number(extension.lineHeight) || 1,
            splitByGrapheme: true,
            selectable: false,
            evented: false,
            // A Fabric clipPath forces this textbox through an off-screen
            // bitmap cache. That bitmap is scaled with the table while a
            // corner control is dragged, which leaves the text blurred.
            // Render the glyphs directly and clip on the live canvas instead.
            objectCaching: false,
            noScaleCache: false,
        });
        textObject.initDimensions();
        const clipTopOffset =
            clipTop - (height - textObject.getScaledHeight()) / 2;

        textObject.set({
            top: top + (height - textObject.getScaledHeight()) / 2,
            cellClipTopOffset: clipTopOffset,
        });
        textObject.setCoords();
        return textObject;
    }

    private measureCellTextHeight(
        text: unknown,
        width: number,
        extension: TableOptions
    ) {
        const horizontalPadding = Math.max(
            0,
            this.toPx(extension.cellPaddingHorizontal ?? extension.cellPadding)
        );
        const fontSize = Math.max(1, this.toPx(extension.fontSize));
        const charSpacingPx = Math.max(0, this.toPx(extension.charSpacing));
        const textWidth = Math.max(1, width - horizontalPadding * 2);
        const textStyle = {
            fontFamily: extension.fontFamily,
            fontSize,
            fontWeight: extension.fontWeight as any,
            fontStyle: extension.fontStyle as any,
            charSpacing: (charSpacingPx / fontSize) * 1000,
        };
        const value =
            extension.textOverflow === 'ellipsis'
                ? this.ellipsizeCellText(String(text ?? ''), textWidth, textStyle)
                : String(text ?? '');
        const measurement = new fabric.Textbox(value, {
            width: textWidth,
            ...textStyle,
            lineHeight: Number(extension.lineHeight) || 1,
            splitByGrapheme: true,
            objectCaching: false,
        });
        measurement.initDimensions();
        return Math.max(1, measurement.getScaledHeight());
    }

    private ellipsizeCellText(
        value: string,
        maxWidth: number,
        textStyle: {
            fontFamily?: string;
            fontSize: number;
            fontWeight?: any;
            fontStyle?: any;
            charSpacing: number;
        }
    ) {
        const text = value.replace(/[\r\n]+/g, ' ');
        if (!text) return '';

        const measure = (content: string) => {
            const measurement = new fabric.Text(content, {
                ...textStyle,
                objectCaching: false,
            });
            measurement.initDimensions();
            return measurement.getScaledWidth();
        };
        if (measure(text) <= maxWidth) return text;

        const ellipsis = '…';
        const graphemes = Array.from(text);
        let low = 0;
        let high = graphemes.length;
        while (low < high) {
            const middle = Math.ceil((low + high) / 2);
            const candidate = `${graphemes.slice(0, middle).join('')}${ellipsis}`;
            if (measure(candidate) <= maxWidth) {
                low = middle;
            } else {
                high = middle - 1;
            }
        }
        return `${graphemes.slice(0, low).join('')}${ellipsis}`;
    }

    private updateOriginSize(
        group: TableGroup,
        extension: TableOptions & { columns: TableColumn[] }
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
                        unit === 'px'
                            ? group.height
                            : this.editor.getSizeByUnit(group.height || 1),
                },
                (this.editor as any).getPrecision?.()
            ),
        };
    }

    destroy() {}
}

export default TablePlugin;
