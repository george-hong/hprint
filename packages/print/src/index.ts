import Editor, { IPluginOption } from '@hprint/core';
import { pluginsList } from '@hprint/plugins';
import { fabric } from '@hprint/shared';
import '@hprint/plugins';

const usePlugins = (editor: Editor, options?:  Record<string, IPluginOption>) => {
    pluginsList.forEach((plugin) => {
        editor.use(plugin, options?.[plugin.pluginName])
    });
};

export { usePlugins, fabric, Editor };