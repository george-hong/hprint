import { fabric } from '@hprint/core';
import type { IEditor, IPluginTempl } from '@hprint/core';

export interface ActualContentLayoutSettings {
    actualContentLayout?: boolean;
    overflowMode?: 'clip' | 'expand';
}

type IPlugin = Pick<ActualContentLayoutPlugin, 'applyActualContentLayout'>;

declare module '@hprint/core' {
    interface IEditor extends IPlugin {}
}

type LayoutEntry = {
    object: fabric.Object;
    index: number;
    originalTop: number;
    originalBottom: number;
};

class ActualContentLayoutPlugin implements IPluginTempl {
    static pluginName = 'ActualContentLayoutPlugin';
    static apis = ['applyActualContentLayout'];

    constructor(
        public canvas: fabric.Canvas,
        public editor: IEditor
    ) {}

    private layoutOrigins = new WeakMap<
        fabric.Object,
        { top: number; height: number }
    >();

    async hookTransformObjectEnd(...args: unknown[]) {
        const { originObject, fabricObject } = args[0] as {
            originObject: any;
            fabricObject: fabric.Object;
        };
        if (!this.isPrintableObject(originObject)) return;

        const mmPerPx = Number(this.editor.getSizeByUnit?.(1, 'mm')) || 1;
        this.layoutOrigins.set(fabricObject, {
            top: this.getOriginalTop(originObject, fabricObject, mmPerPx),
            height: this.getOriginalHeight(
                originObject,
                fabricObject,
                mmPerPx
            ),
        });
    }

    applyActualContentLayout(templateContent: any, templateHeight: number) {
        const settings = (templateContent?.templateSettings ||
            {}) as ActualContentLayoutSettings;
        if (!settings.actualContentLayout) return templateHeight;

        const fabricObjects = this.canvas
            .getObjects()
            .filter(this.isPrintableObject);
        const mmPerPx = Number(this.editor.getSizeByUnit?.(1, 'mm')) || 1;
        const sourceObjects = this.getTemplateSourceObjects(templateContent);

        fabricObjects.forEach((object) => this.preparePrintLayoutObject(object));

        const entries = fabricObjects.map((object, index) => {
            const origin = this.layoutOrigins.get(object);
            const source = this.getSourceObject(object, sourceObjects);
            const originalTop =
                origin?.top ??
                this.getOriginalTop(source, object, mmPerPx);
            const originalHeight =
                origin?.height ??
                this.getOriginalHeight(source, object, mmPerPx);
            return {
                object,
                index,
                originalTop,
                originalBottom: originalTop + originalHeight,
            };
        }) as LayoutEntry[];

        entries.sort(
            (a, b) => a.originalTop - b.originalTop || a.index - b.index
        );
        const rows: LayoutEntry[][] = [];
        const sameRowTolerance = 0.01;
        entries.forEach((entry) => {
            const row = rows[rows.length - 1];
            if (
                row &&
                Math.abs(row[0].originalTop - entry.originalTop) <=
                    sameRowTolerance
            ) {
                row.push(entry);
            } else {
                rows.push([entry]);
            }
        });

        let previousOriginalBottom: number | undefined;
        let previousActualBottom: number | undefined;
        let pendingGap = 0;
        let lastVisibleOriginalBottom = 0;

        rows.forEach((row) => {
            const rowOriginalTop = row[0].originalTop;
            const rowOriginalBottom = Math.max(
                ...row.map((entry) => entry.originalBottom)
            );
            if (previousOriginalBottom !== undefined) {
                pendingGap += Math.max(
                    0,
                    rowOriginalTop - previousOriginalBottom
                );
            }
            previousOriginalBottom = rowOriginalBottom;

            const visibleEntries = row.filter(
                (entry) => !this.isEmptyLayoutObject(entry.object)
            );
            if (!visibleEntries.length) return;

            const targetTop =
                previousActualBottom === undefined
                    ? rowOriginalTop
                    : previousActualBottom + pendingGap;
            visibleEntries.forEach((entry) => {
                entry.object.set('top', targetTop / mmPerPx);
                entry.object.setCoords();
            });
            previousActualBottom = Math.max(
                ...visibleEntries.map(
                    (entry) =>
                        (Number(entry.object.top || 0) +
                            this.getActualLayoutHeight(entry.object)) *
                        mmPerPx
                )
            );
            lastVisibleOriginalBottom = rowOriginalBottom;
            pendingGap = 0;
        });

        this.canvas.requestRenderAll();
        if (
            settings.overflowMode !== 'expand' ||
            previousActualBottom === undefined
        ) {
            return templateHeight;
        }
        const bottomSpace = Math.max(
            0,
            templateHeight - lastVisibleOriginalBottom
        );
        return Math.max(
            templateHeight,
            previousActualBottom + bottomSpace
        );
    }

    private getOriginalTop(
        source: any,
        object: fabric.Object,
        mmPerPx: number
    ) {
        const top = Number(source?.top);
        if (Number.isFinite(top)) return top * mmPerPx;
        return this.getOriginMmValue(
            source,
            'top',
            Number(object.top || 0) * mmPerPx
        );
    }

    private getOriginalHeight(
        source: any,
        object: fabric.Object,
        mmPerPx: number
    ) {
        const height = Number(source?.height);
        const scaleY = Number(source?.scaleY ?? 1);
        if (Number.isFinite(height) && Number.isFinite(scaleY)) {
            return Math.abs(height * scaleY) * mmPerPx;
        }
        return this.getOriginMmValue(
            source,
            'height',
            Number(object.getScaledHeight?.() || object.height || 0) *
                mmPerPx
        );
    }

    private getTemplateSourceObjects(templateContent: any) {
        const sourceObjects = new Map<string, any>();
        if (!Array.isArray(templateContent?.objects)) return sourceObjects;
        templateContent.objects.forEach((source: any, index: number) => {
            if (source?.id) sourceObjects.set(`id:${source.id}`, source);
            sourceObjects.set(`index:${index}`, source);
        });
        return sourceObjects;
    }

    private getSourceObject(
        object: any,
        sourceObjects: Map<string, any>
    ) {
        if (object?.id) {
            const source = sourceObjects.get(`id:${object.id}`);
            if (source) return source;
        }
        const objects = this.canvas.getObjects().filter(this.isPrintableObject);
        const index = objects.indexOf(object);
        return sourceObjects.get(`index:${index}`);
    }

    private getOriginMmValue(
        source: any,
        field: 'top' | 'height',
        fallback: number
    ) {
        const originalValue = source?._originSize?.mm?.[field];
        if (
            originalValue === undefined ||
            originalValue === null ||
            originalValue === ''
        ) {
            return fallback;
        }
        const value = Number(originalValue);
        return Number.isFinite(value) ? value : fallback;
    }

    private preparePrintLayoutObject(object: any) {
        if (object?.extensionType !== 'imageTextList') return;
        if (object.extension?._clipContent === true) return;

        // Design canvases can opt into clipping, but print/layout canvases should
        // measure and render the natural image-text content height.
        if (object.clipPath) object.set('clipPath', undefined);
        object.set({
            objectCaching: false,
            dirty: true,
        });
    }

    private isPrintableObject(object: any) {
        return (
            object?.id !== 'workspace' &&
            object?.id !== 'coverMask' &&
            object?.type !== 'GuideLine'
        );
    }

    private isEmptyLayoutObject(object: any) {
        if (object?.visible === false) return true;
        const field = object?.extension?._field_;
        if (!field) return false;
        if (object.type === 'textbox') {
            return String(object.text ?? '') === '';
        }
        if (['barcode', 'qrcode'].includes(object.extensionType)) {
            return (
                String(object.extension?.value ?? '') === '' &&
                !this.hasVisibleImageSource(object)
            );
        }
        if (object.extensionType === 'imageTextList') {
            return (
                !Array.isArray(object.extension?.items) ||
                object.extension.items.length === 0
            );
        }
        return false;
    }

    private hasVisibleImageSource(object: any) {
        const src = String(object?.getSrc?.() ?? object?.src ?? '');
        return src !== '' && /^data:image\//i.test(src);
    }

    private getActualLayoutHeight(object: any) {
        if (object?.extensionType !== 'imageTextList') {
            return Number(
                object.getScaledHeight?.() || object.height || 0
            );
        }

        const children = object.getObjects?.() || object._objects || [];
        const contentChildren = children.slice(1);
        if (!contentChildren.length) return 0;

        const groupHeight = Number(object.height || 0);
        const groupScaleY = Math.abs(Number(object.scaleY ?? 1));
        const contentBottom = Math.max(
            ...contentChildren.map(
                (child: any) =>
                    Number(child.top || 0) +
                    groupHeight / 2 +
                    Number(
                        child.getScaledHeight?.() || child.height || 0
                    )
            )
        );
        return Math.max(0, contentBottom) * groupScaleY;
    }
}

export default ActualContentLayoutPlugin;
