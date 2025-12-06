import { IPluginTempl } from '@hprint/core'
import { SelectEvent, SelectMode } from './types/eventType';
// 导入所有插件
import UnitPlugin from './plugins/UnitPlugin';
import DringPlugin from './plugins/DringPlugin';
import AlignGuidLinePlugin from './plugins/AlignGuidLinePlugin';
import ControlsPlugin from './plugins/ControlsPlugin';
import ControlsRotatePlugin from './plugins/ControlsRotatePlugin';
import CenterAlignPlugin from './plugins/CenterAlignPlugin';
import LayerPlugin from './plugins/LayerPlugin';
import CopyPlugin from './plugins/CopyPlugin';
import MoveHotKeyPlugin from './plugins/MoveHotKeyPlugin';
import DeleteHotKeyPlugin from './plugins/DeleteHotKeyPlugin';
import GroupPlugin from './plugins/GroupPlugin';
import DrawLinePlugin from './plugins/DrawLinePlugin';
import GroupTextEditorPlugin from './plugins/GroupTextEditorPlugin';
import GroupAlignPlugin from './plugins/GroupAlignPlugin';
import WorkspacePlugin from './plugins/WorkspacePlugin';
import MaskPlugin from './plugins/MaskPlugin';
import HistoryPlugin from './plugins/HistoryPlugin';
import FlipPlugin from './plugins/FlipPlugin';
import RulerPlugin from './plugins/RulerPlugin';
import MaterialPlugin from './plugins/MaterialPlugin';
import WaterMarkPlugin from './plugins/WaterMarkPlugin';
import FontPlugin from './plugins/FontPlugin';
import PolygonModifyPlugin from './plugins/PolygonModifyPlugin';
import DrawPolygonPlugin from './plugins/DrawPolygonPlugin';
import FreeDrawPlugin from './plugins/FreeDrawPlugin';
import PathTextPlugin from './plugins/PathTextPlugin';
import PsdPlugin from './plugins/PsdPlugin';
import SimpleClipImagePlugin from './plugins/SimpleClipImagePlugin';
import BarCodePlugin from './plugins/BarCodePlugin';
import QrCodePlugin from './plugins/QrCodePlugin';
import ImageStroke from './plugins/ImageStroke';
import ResizePlugin from './plugins/ResizePlugin';
import LockPlugin from './plugins/LockPlugin';
import AddBaseTypePlugin from './plugins/AddBaseTypePlugin';
import PrintPlugin from './plugins/PrintPlugin';
import CreateElementPlugin from './plugins/CreateElementPlugin';

// 对象形式导出所有插件
const pluginsObject: { [key: string]: IPluginTempl } = {
    UnitPlugin,
    DringPlugin,
    AlignGuidLinePlugin,
    ControlsPlugin,
    ControlsRotatePlugin,
    CenterAlignPlugin,
    LayerPlugin,
    CopyPlugin,
    MoveHotKeyPlugin,
    DeleteHotKeyPlugin,
    GroupPlugin,
    DrawLinePlugin,
    GroupTextEditorPlugin,
    GroupAlignPlugin,
    WorkspacePlugin,
    MaskPlugin,
    HistoryPlugin,
    FlipPlugin,
    RulerPlugin,
    MaterialPlugin,
    WaterMarkPlugin,
    FontPlugin,
    PolygonModifyPlugin,
    DrawPolygonPlugin,
    FreeDrawPlugin,
    PathTextPlugin,
    PsdPlugin,
    SimpleClipImagePlugin,
    BarCodePlugin,
    QrCodePlugin,
    ImageStroke,
    ResizePlugin,
    LockPlugin,
    AddBaseTypePlugin,
    PrintPlugin,
    CreateElementPlugin,
};

// 数组形式导出所有插件
const pluginsList: IPluginTempl[] = [
    UnitPlugin,
    DringPlugin,
    AlignGuidLinePlugin,
    ControlsPlugin,
    ControlsRotatePlugin,
    CenterAlignPlugin,
    LayerPlugin,
    CopyPlugin,
    MoveHotKeyPlugin,
    DeleteHotKeyPlugin,
    GroupPlugin,
    DrawLinePlugin,
    GroupTextEditorPlugin,
    GroupAlignPlugin,
    WorkspacePlugin,
    MaskPlugin,
    HistoryPlugin,
    FlipPlugin,
    RulerPlugin,
    MaterialPlugin,
    WaterMarkPlugin,
    FontPlugin,
    PolygonModifyPlugin,
    DrawPolygonPlugin,
    FreeDrawPlugin,
    PathTextPlugin,
    PsdPlugin,
    SimpleClipImagePlugin,
    BarCodePlugin,
    QrCodePlugin,
    ImageStroke,
    ResizePlugin,
    LockPlugin,
    AddBaseTypePlugin,
    PrintPlugin,
    CreateElementPlugin,
];

export { pluginsObject, pluginsList, SelectEvent, SelectMode };
