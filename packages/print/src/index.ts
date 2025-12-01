import Editor from '@hprint/core';
import { pluginsList } from '@hprint/plugins';
import '@hprint/plugins';

const usePlugins = (editor: Editor) => {
    pluginsList.forEach((plugin) => {
        // TODO 支持传参
        editor.use(plugin);
    });
};

export { usePlugins };
export default Editor;
