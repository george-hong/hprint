import { fabric } from 'fabric';

fabric.Rect = fabric.util.createClass(fabric.Rect, {
    type: 'rect',
    initialize: function (options) {
        options || (options = {});
        this.callSuper('initialize', options);
    },
    _render(ctx) {
        const roundValue = this.roundValue || 0;
        this.rx = (1 / this.scaleX) * roundValue;
        this.ry = (1 / this.scaleY) * roundValue;
        this.callSuper('_render', ctx);
    },
});

fabric.Rect.fromObject = function (object, callback) {
    return fabric.Object._fromObject('Rect', object, callback);
};

export default fabric.Rect;
