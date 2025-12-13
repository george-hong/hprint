import { fabric, IEditor, IPluginTempl } from '@hprint/core';

type IPlugin = Pick<
    CenterAlignPlugin,
    'centerH' | 'center' | 'position' | 'centerV' | 'positionV2'
>;

declare module '@hprint/core' {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface IEditor extends IPlugin { }
}

class CenterAlignPlugin implements IPluginTempl {
    static pluginName = 'CenterAlignPlugin';
    static apis = ['centerH', 'center', 'position', 'centerV', 'positionV2'];
    static anignType = ['centerH', 'center', 'centerV'];
    // public hotkeys: string[] = ['space'];
    constructor(
        public canvas: fabric.Canvas,
        public editor: IEditor
    ) { }

    center(workspace: fabric.Rect, object: fabric.Object) {
        const center = workspace.getCenterPoint();
        return this.canvas._centerObject(object, center);
    }

    centerV(workspace: fabric.Rect, object: fabric.Object) {
        return this.canvas._centerObject(
            object,
            new fabric.Point(
                object.getCenterPoint().x,
                workspace.getCenterPoint().y
            )
        );
    }

    centerH(workspace: fabric.Rect, object: fabric.Object) {
        return this.canvas._centerObject(
            object,
            new fabric.Point(
                workspace.getCenterPoint().x,
                object.getCenterPoint().y
            )
        );
    }

    position(name: 'centerH' | 'center' | 'centerV') {
        const activeObject = this.canvas.getActiveObject();
        if (CenterAlignPlugin.anignType.includes(name) && activeObject) {
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

    positionV2(element: fabric.Object, position: 'centerH' | 'center' | 'centerV') {
        if (CenterAlignPlugin.anignType.includes(position) && element) {
            const defaultWorkspace = this.canvas
                .getObjects()
                .find((item) => item.id === 'workspace');
            if (defaultWorkspace) {
                if (position === 'center') {
                    const center = defaultWorkspace.getCenterPoint();
                    this.canvas._centerObject(element, center);
                } else {
                }
            }
            this.canvas.renderAll();
        }

    }

    destroy() {
        console.log('pluginDestroy');
    }
}

export default CenterAlignPlugin;
