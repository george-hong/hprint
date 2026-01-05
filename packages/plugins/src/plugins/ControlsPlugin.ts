import { fabric } from '@hprint/core';
import verticalImg from '../assets/middlecontrol.svg?url';
// import verticalImg from './middlecontrol.svg';
import horizontalImg from '../assets/middlecontrolhoz.svg?url';
import edgeImg from '../assets/edgecontrol.svg?url';
import rotateImg from '../assets/rotateicon.svg?url';
import type { IEditor, IPluginTempl } from '@hprint/core';

/**
 * 实际场景: 在进行某个对象缩放的时候，由于fabricjs默认精度使用的是toFixed(2)。
 * 此处为了缩放的精度更准确一些，因此将NUM_FRACTION_DIGITS默认值改为4，即toFixed(4).
 */
fabric.Object.NUM_FRACTION_DIGITS = 4;

/**
 * 统一的控制点样式配置
 */
const CONTROL_STYLES = {
    transparentCorners: false,
    borderColor: '#51B9F9',
    cornerColor: '#FFF',
    borderScaleFactor: 2.5,
    cornerStyle: 'circle' as const,
    cornerStrokeColor: 'rgba(0,0,0,0.25)', // 更淡的灰色边框
    borderOpacityWhenMoving: 1,
};

function drawImg(
    ctx: CanvasRenderingContext2D,
    left: number,
    top: number,
    img: HTMLImageElement,
    wSize: number,
    hSize: number,
    angle: number | undefined
) {
    if (angle === undefined) return;
    ctx.save();
    ctx.translate(left, top);
    ctx.rotate(fabric.util.degreesToRadians(angle));
    ctx.drawImage(img, -wSize / 2, -hSize / 2, wSize, hSize);
    ctx.restore();
}

// 中间横杠
function intervalControl() {
    const verticalImgIcon = document.createElement('img');
    verticalImgIcon.src = verticalImg;

    const horizontalImgIcon = document.createElement('img');
    horizontalImgIcon.src = horizontalImg;

    function renderIcon(
        ctx: CanvasRenderingContext2D,
        left: number,
        top: number,
        styleOverride: any,
        fabricObject: fabric.Object
    ) {
        drawImg(ctx, left, top, verticalImgIcon, 20, 25, fabricObject.angle);
    }

    function renderIconHoz(
        ctx: CanvasRenderingContext2D,
        left: number,
        top: number,
        styleOverride: any,
        fabricObject: fabric.Object
    ) {
        drawImg(ctx, left, top, horizontalImgIcon, 25, 20, fabricObject.angle);
    }
    // 中间横杠
    fabric.Object.prototype.controls.ml = new fabric.Control({
        x: -0.5,
        y: 0,
        offsetX: -1,
        cursorStyleHandler: fabric.controlsUtils.scaleSkewCursorStyleHandler,
        actionHandler: fabric.controlsUtils.scalingXOrSkewingY,
        getActionName: fabric.controlsUtils.scaleOrSkewActionName,
        render: renderIcon,
    });

    fabric.Object.prototype.controls.mr = new fabric.Control({
        x: 0.5,
        y: 0,
        offsetX: 1,
        cursorStyleHandler: fabric.controlsUtils.scaleSkewCursorStyleHandler,
        actionHandler: fabric.controlsUtils.scalingXOrSkewingY,
        getActionName: fabric.controlsUtils.scaleOrSkewActionName,
        render: renderIcon,
    });

    fabric.Object.prototype.controls.mb = new fabric.Control({
        x: 0,
        y: 0.5,
        offsetY: 1,
        cursorStyleHandler: fabric.controlsUtils.scaleSkewCursorStyleHandler,
        actionHandler: fabric.controlsUtils.scalingYOrSkewingX,
        getActionName: fabric.controlsUtils.scaleOrSkewActionName,
        render: renderIconHoz,
    });

    fabric.Object.prototype.controls.mt = new fabric.Control({
        x: 0,
        y: -0.5,
        offsetY: -1,
        cursorStyleHandler: fabric.controlsUtils.scaleSkewCursorStyleHandler,
        actionHandler: fabric.controlsUtils.scalingYOrSkewingX,
        getActionName: fabric.controlsUtils.scaleOrSkewActionName,
        render: renderIconHoz,
    });
}

// 顶点
function peakControl() {
    const img = document.createElement('img');
    img.src = edgeImg;

    function renderIconEdge(
        ctx: CanvasRenderingContext2D,
        left: number,
        top: number,
        styleOverride: any,
        fabricObject: fabric.Object
    ) {
        drawImg(ctx, left, top, img, 25, 25, fabricObject.angle);
    }
    // 四角图标
    fabric.Object.prototype.controls.tl = new fabric.Control({
        x: -0.5,
        y: -0.5,
        cursorStyleHandler: fabric.controlsUtils.scaleCursorStyleHandler,
        actionHandler: fabric.controlsUtils.scalingEqually,
        render: renderIconEdge,
    });
    fabric.Object.prototype.controls.bl = new fabric.Control({
        x: -0.5,
        y: 0.5,
        cursorStyleHandler: fabric.controlsUtils.scaleCursorStyleHandler,
        actionHandler: fabric.controlsUtils.scalingEqually,
        render: renderIconEdge,
    });
    fabric.Object.prototype.controls.tr = new fabric.Control({
        x: 0.5,
        y: -0.5,
        cursorStyleHandler: fabric.controlsUtils.scaleCursorStyleHandler,
        actionHandler: fabric.controlsUtils.scalingEqually,
        render: renderIconEdge,
    });
    fabric.Object.prototype.controls.br = new fabric.Control({
        x: 0.5,
        y: 0.5,
        cursorStyleHandler: fabric.controlsUtils.scaleCursorStyleHandler,
        actionHandler: fabric.controlsUtils.scalingEqually,
        render: renderIconEdge,
    });
}

// 删除
/*function deleteControl(canvas: fabric.Canvas) {
  const deleteIcon =
    "data:image/svg+xml,%3C%3Fxml version='1.0' encoding='utf-8'%3F%3E%3C!DOCTYPE svg PUBLIC '-//W3C//DTD SVG 1.1//EN' 'http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd'%3E%3Csvg version='1.1' id='Ebene_1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' x='0px' y='0px' width='595.275px' height='595.275px' viewBox='200 215 230 470' xml:space='preserve'%3E%3Ccircle style='fill:%23F44336;' cx='299.76' cy='439.067' r='218.516'/%3E%3Cg%3E%3Crect x='267.162' y='307.978' transform='matrix(0.7071 -0.7071 0.7071 0.7071 -222.6202 340.6915)' style='fill:white;' width='65.545' height='262.18'/%3E%3Crect x='266.988' y='308.153' transform='matrix(0.7071 0.7071 -0.7071 0.7071 398.3889 -83.3116)' style='fill:white;' width='65.544' height='262.179'/%3E%3C/g%3E%3C/svg%3E";
  const delImg = document.createElement('img');
  delImg.src = deleteIcon;

  function renderDelIcon(
    ctx: CanvasRenderingContext2D,
    left: number,
    top: number,
    styleOverride: any,
    fabricObject: fabric.Object
  ) {
    drawImg(ctx, left, top, delImg, 24, 24, fabricObject.angle);
  }

  // 删除选中元素
  function deleteObject(mouseEvent: MouseEvent, target: fabric.Transform) {
    if (target.action === 'rotate') return true;
    const activeObject = canvas.getActiveObjects();
    if (activeObject) {
      activeObject.map((item) => canvas.remove(item));
      canvas.requestRenderAll();
      canvas.discardActiveObject();
    }
    return true;
  }

  // 删除图标
  fabric.Object.prototype.controls.deleteControl = new fabric.Control({
    x: 0.5,
    y: -0.5,
    offsetY: -16,
    offsetX: 16,
    cursorStyle: 'pointer',
    mouseUpHandler: deleteObject,
    render: renderDelIcon,
    // cornerSize: 24,
  });
}*/

// 旋转
function rotationControl() {
    const img = document.createElement('img');
    img.src = rotateImg;
    function renderIconRotate(
        ctx: CanvasRenderingContext2D,
        left: number,
        top: number,
        styleOverride: any,
        fabricObject: fabric.Object
    ) {
        drawImg(ctx, left, top, img, 40, 40, fabricObject.angle);
    }
    // 旋转图标
    fabric.Object.prototype.controls.mtr = new fabric.Control({
        x: 0,
        y: 0.5,
        cursorStyleHandler: fabric.controlsUtils.rotationStyleHandler,
        actionHandler: fabric.controlsUtils.rotationWithSnapping,
        offsetY: 30,
        // withConnecton: false,
        actionName: 'rotate',
        render: renderIconRotate,
    });
}

class ControlsPlugin implements IPluginTempl {
    static pluginName = 'ControlsPlugin';
    constructor(
        public canvas: fabric.Canvas,
        public editor: IEditor
    ) {
        this.init();
    }
    init() {
        // 删除图标
        // deleteControl(this.canvas);
        // 顶点图标
        peakControl();
        // 中间横杠图标
        intervalControl();
        // 旋转图标
        rotationControl();

        // 选中样式
        fabric.Object.prototype.set(CONTROL_STYLES);
        // textbox保持一致
        // fabric.Textbox.prototype.controls = fabric.Object.prototype.controls;

        // 自定义多选控制点渲染
        this.customizeActiveSelection();

        // 监听 loadJson 事件，重新应用控制点样式
        this.editor.on('loadJson', () => {
            this.applyControlStyles();
        });
    }

    /**
     * 为画布上所有对象应用统一的控制点样式
     */
    applyControlStyles() {
        const objects = this.canvas.getObjects();
        objects.forEach((obj) => {
            // 跳过 workspace 等特殊对象
            if (obj.id === 'workspace' || obj.id === 'coverMask') {
                return;
            }
            obj.set(CONTROL_STYLES);
        });
        this.canvas.renderAll();
    }

    /**
     * 自定义多选控制点，添加白色填充并确保在边框上方
     */
    customizeActiveSelection() {
        // 自定义控制点渲染函数
        const renderCircleControl = (
            ctx: CanvasRenderingContext2D,
            left: number,
            top: number,
            styleOverride: any,
            fabricObject: fabric.Object
        ) => {
            const size = fabricObject.cornerSize || 10;
            ctx.save();
            ctx.translate(left, top);
            ctx.rotate(fabric.util.degreesToRadians(fabricObject.angle || 0));
            
            // 绘制阴影
            ctx.shadowColor = 'rgba(0,0,0,0.15)';
            ctx.shadowBlur = 3;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 1;
            
            // 绘制白色填充的圆形
            ctx.beginPath();
            ctx.arc(0, 0, size / 2, 0, 2 * Math.PI, false);
            ctx.fillStyle = '#FFF';
            ctx.fill();
            
            // 清除阴影，避免边框也有阴影
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            // 绘制更淡的灰色边框
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            
            ctx.restore();
        };

        // 为 ActiveSelection 设置自定义控制点
        const controlKeys = ['tl', 'tr', 'bl', 'br', 'ml', 'mr', 'mt', 'mb', 'mtr'];
        controlKeys.forEach((key) => {
            if (fabric.ActiveSelection.prototype.controls[key]) {
                const originalControl = fabric.ActiveSelection.prototype.controls[key];
                fabric.ActiveSelection.prototype.controls[key] = new fabric.Control({
                    ...originalControl,
                    render: renderCircleControl,
                });
            }
        });

        // 应用样式配置
        fabric.ActiveSelection.prototype.set(CONTROL_STYLES);
        
        // 跟踪是否正在移动或缩放对象
        let isTransforming = false;
        
        // 监听对象移动开始
        this.canvas.on('object:moving', (e: any) => {
            if (e.target && e.target.type === 'activeSelection') {
                isTransforming = true;
            }
        });
        
        // 监听对象缩放开始
        this.canvas.on('object:scaling', (e: any) => {
            if (e.target && e.target.type === 'activeSelection') {
                isTransforming = true;
            }
        });
        
        // 监听对象旋转开始
        this.canvas.on('object:rotating', (e: any) => {
            if (e.target && e.target.type === 'activeSelection') {
                isTransforming = true;
            }
        });
        
        // 监听对象变换结束
        this.canvas.on('object:modified', (e: any) => {
            if (e.target && e.target.type === 'activeSelection') {
                isTransforming = false;
                this.canvas.requestRenderAll();
            }
        });
        
        // 监听鼠标松开（防止某些情况下modified事件未触发）
        this.canvas.on('mouse:up', () => {
            if (isTransforming) {
                isTransforming = false;
                this.canvas.requestRenderAll();
            }
        });
        
        // 监听canvas的after:render事件，在所有内容渲染完成后额外绘制多选控制点
        this.canvas.on('after:render', () => {
            // 如果正在变换（移动、缩放、旋转），不绘制控制点
            if (isTransforming) return;
            
            const activeObject = this.canvas.getActiveObject();
            if (activeObject && activeObject.type === 'activeSelection') {
                const ctx = this.canvas.getContext();
                if (!ctx) return;
                
                ctx.save();
                
                // 确保控制点在最上层
                ctx.globalCompositeOperation = 'source-over';
                
                // 额外绘制一次控制点，确保在所有边框之上
                activeObject.forEachControl((control: any, key: string) => {
                    if (control.getVisibility(activeObject, key)) {
                        const p = activeObject.oCoords[key];
                        if (p) {
                            control.render(
                                ctx,
                                p.x,
                                p.y,
                                {},
                                activeObject
                            );
                        }
                    }
                });
                
                ctx.restore();
            }
        });
    }

    destroy() {
        console.log('pluginDestroy');
    }
}

export default ControlsPlugin;
