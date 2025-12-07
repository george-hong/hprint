import Editor, { IPluginOption } from '@hprint/core';
import { pluginsList, SelectEvent, SelectMode } from '@hprint/plugins';
import { fabric, LengthConvert } from '@hprint/shared';

const usePlugins = (editor: Editor, options?: {
    excludes: string[]
    options: Record<string, IPluginOption>
}) => {
    const excludesMap = options?.excludes?.reduce((total, cur) => {
        total[cur] = 1;
        return total;
    }, {} as Record<string, 1>) || {};
    pluginsList.forEach((plugin) => {
        // 排除部分插件
        if (excludesMap[plugin.pluginName]) return;
        editor.use(plugin, options?.options?.[plugin.pluginName])
    });
};

export {
    usePlugins,
    fabric,
    Editor,
    LengthConvert,
    // plugin packages
    SelectEvent,
    SelectMode
};