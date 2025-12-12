import { fabric, IEditor, IPluginTempl } from '@hprint/core';

type IPlugin = Pick<
    CenterAlignPlugin,
    'centerH' | 'center' | 'position' | 'centerV'
>;

declare module '@hprint/core' {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface IEditor extends IPlugin { }
}

class CenterAlignPlugin implements IPluginTempl {
    static pluginName = 'CenterAlignPlugin';
    static apis = ['centerH', 'center', 'position', 'centerV'];
    // public hotkeys: string[] = ['space'];
    constructor(
        public canvas: fabric.Canvas,
        public editor: IEditor
    ) { }

    center(workspace: fabric.Rect, object: fabric.Object) {
        const center = workspace.getCenterPoint();
        const result = this.canvas.centerObject(object);
        const leftPx = object.left ?? 0;
        const topPx = object.top ?? 0;
        const leftUnit = this.editor.getSizeByUnit?.(center.x);
        const topUnit = this.editor.getSizeByUnit?.(center.y);
        // TODO 这里需要计算元素的大小，与坐标计算后再设置
        object.set('left', leftUnit);
        object.set('top', topUnit);
        return result;
    }

    centerV(workspace: fabric.Rect, object: fabric.Object) {
        const result = this.canvas._centerObject(
            object,
            new fabric.Point(
                object.getCenterPoint().x,
                workspace.getCenterPoint().y
            )
        );
        const topPx = object.top ?? 0;
        const topUnit = (this.editor as any).getSizeByUnit?.(topPx, undefined, 96) ?? topPx;
        object.set('top', topUnit);
        return result;
    }

    centerH(workspace: fabric.Rect, object: fabric.Object) {
        const result = this.canvas._centerObject(
            object,
            new fabric.Point(
                workspace.getCenterPoint().x,
                object.getCenterPoint().y
            )
        );
        const leftPx = object.left ?? 0;
        const leftUnit = (this.editor as any).getSizeByUnit?.(leftPx, undefined, 96) ?? leftPx;
        object.set('left', leftUnit);
        return result;
    }

    position(name: 'centerH' | 'center' | 'centerV') {
        const anignType = ['centerH', 'center', 'centerV'];
        const activeObject = this.canvas.getActiveObject();
        if (anignType.includes(name) && activeObject) {
            const defaultWorkspace = this.canvas
                .getObjects()
                .find((item) => item.id === 'workspace');
            if (defaultWorkspace) {
                this[name](defaultWorkspace, activeObject);
            }
            this.canvas.renderAll();
        }
    }

    contextMenu() {
        const activeObject = this.canvas.getActiveObject();
        if (activeObject) {
            return [
                {
                    text: '水平垂直居中',
                    hotkey: '',
                    disabled: false,
                    onclick: () => this.position('center'),
                },
            ];
        }
    }
    destroy() {
        console.log('pluginDestroy');
    }
}

export default CenterAlignPlugin;
