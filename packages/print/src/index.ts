import Editor, { IPluginOption } from '@hprint/core';
import { pluginsList, SelectEvent, SelectMode } from '@hprint/plugins';
import { fabric, LengthConvert } from '@hprint/shared';

const usePlugins = (
    editor: Editor,
    options?: {
        excludes: string[];
        options: Record<string, IPluginOption>;
    }
) => {
    const excludesMap =
        options?.excludes?.reduce(
            (total, cur) => {
                total[cur] = 1;
                return total;
            },
            {} as Record<string, 1>
        ) || {};
    pluginsList.forEach((plugin) => {
        // 排除部分插件
        if (excludesMap[plugin.pluginName]) return;
        editor.use(plugin, options?.options?.[plugin.pluginName]);
    });
};

export {
    usePlugins,
    fabric,
    Editor,
    LengthConvert,
    // plugin packages
    SelectEvent,
    SelectMode,
};

export { normalizeTableColumns } from '@hprint/plugins';

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
}

export type TableGroup = fabric.Group & {
    extensionType?: 'table';
    extension?: TableOptions & { columns: TableColumn[] };
    setExtension?: (fields: Record<string, unknown>) => Promise<void>;
    setExtensionByUnit?: (fields: Record<string, unknown>) => Promise<void>;
    setByUnit?: (field: string, value: unknown) => Promise<unknown>;
};
