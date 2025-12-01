import Editor from './Editor';
import Utils from './utils/utils';
import CustomRect from './objects/CustomRect';
import CustomTextbox from './objects/CustomTextbox';
import { fabric } from 'fabric';
import type { Canvas, Point, IEvent } from 'fabric/fabric-impl';

export { Utils, CustomRect, CustomTextbox, fabric, Canvas, Point, IEvent };
export default Editor;

export * from './interface/Editor';
