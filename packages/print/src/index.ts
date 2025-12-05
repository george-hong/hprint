import Editor, { IPluginOption } from '@hprint/core';
import { pluginsList, SelectEvent, SelectMode } from '@hprint/plugins';
import { fabric, LengthConvert } from '@hprint/shared';

const usePlugins = (editor: Editor, options?: Record<string, IPluginOption>) => {
    pluginsList.forEach((plugin) => {
        editor.use(plugin, options?.[plugin.pluginName])
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