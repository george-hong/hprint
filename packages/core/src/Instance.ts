import Editor from './Editor';
import UnitPlugin from '../../plugins/src/plugins/UnitPlugin';
import DringPlugin from '../../plugins/src/plugins/DringPlugin';
import AlignGuidLinePlugin from '../../plugins/src/plugins/AlignGuidLinePlugin';
import ControlsPlugin from '../../plugins/src/plugins/ControlsPlugin';
import ControlsRotatePlugin from '../../plugins/src/plugins/ControlsRotatePlugin';
import CenterAlignPlugin from '../../plugins/src/plugins/CenterAlignPlugin';
import LayerPlugin from '../../plugins/src/plugins/LayerPlugin';
import CopyPlugin from '../../plugins/src/plugins/CopyPlugin';
import MoveHotKeyPlugin from '../../plugins/src/plugins/MoveHotKeyPlugin';
import DeleteHotKeyPlugin from '../../plugins/src/plugins/DeleteHotKeyPlugin';
import GroupPlugin from '../../plugins/src/plugins/GroupPlugin';
import DrawLinePlugin from '../../plugins/src/plugins/DrawLinePlugin';
import GroupTextEditorPlugin from '../../plugins/src/plugins/GroupTextEditorPlugin';
import GroupAlignPlugin from '../../plugins/src/plugins/GroupAlignPlugin';
import WorkspacePlugin from '../../plugins/src/plugins/WorkspacePlugin';
import MaskPlugin from '../../plugins/src/plugins/MaskPlugin';
import HistoryPlugin from '../../plugins/src/plugins/HistoryPlugin';
import FlipPlugin from '../../plugins/src/plugins/FlipPlugin';
import RulerPlugin from '../../plugins/src/plugins/RulerPlugin';
import MaterialPlugin from '../../plugins/src/plugins/MaterialPlugin';
import WaterMarkPlugin from '../../plugins/src/plugins/WaterMarkPlugin';
import FontPlugin from '../../plugins/src/plugins/FontPlugin';
import PolygonModifyPlugin from '../../plugins/src/plugins/PolygonModifyPlugin';
import DrawPolygonPlugin from '../../plugins/src/plugins/DrawPolygonPlugin';
import FreeDrawPlugin from '../../plugins/src/plugins/FreeDrawPlugin';
import PathTextPlugin from '../../plugins/src/plugins/PathTextPlugin';
import PsdPlugin from '../../plugins/src/plugins/PsdPlugin';
import SimpleClipImagePlugin from '../../plugins/src/plugins/SimpleClipImagePlugin';
import BarCodePlugin from '../../plugins/src/plugins/BarCodePlugin';
import QrCodePlugin from '../../plugins/src/plugins/QrCodePlugin';
import ImageStroke from '../../plugins/src/plugins/ImageStroke';
import ResizePlugin from '../../plugins/src/plugins/ResizePlugin';
import LockPlugin from '../../plugins/src/plugins/LockPlugin';
import AddBaseTypePlugin from '../../plugins/src/plugins/AddBaseTypePlugin';
import PrintPlugin from '../../plugins/src/plugins/PrintPlugin';

const AllEditor = {
    Editor,
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
};

declare type HPrintEditor = typeof AllEditor;

export default HPrintEditor;
