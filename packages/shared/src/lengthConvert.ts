export default class LengthConvert {
    static devicePixelRatio: number = window.devicePixelRatio;
    static _deviceDPI: number | null;
    static CONSTANTS = {
        INCH_TO_MM: 25.4,
        DEFAULT_DPI: 96,
        STANDARD_DPI: {
            SCREEN: 96,
            PRINT: 300,
            HIGH_RES: 600,
        },
    };

    /**
     * 获取设备DPI（缓存结果避免重复计算）
     */
    static getDeviceDPI(): number {
        if (!this._deviceDPI) {
            try {
                const element = document.createElement('div');
                element.style.width = '1in';
                element.style.height = '0';
                element.style.position = 'absolute';
                element.style.visibility = 'hidden';

                document.body.appendChild(element);
                const cssPixels = element.offsetWidth;
                document.body.removeChild(element);

                this._deviceDPI =
                    cssPixels * window.devicePixelRatio ||
                    this.CONSTANTS.DEFAULT_DPI;
            } catch (error) {
                console.warn(
                    '无法获取设备DPI，使用默认值:',
                    this.CONSTANTS.DEFAULT_DPI
                );
                this._deviceDPI = this.CONSTANTS.DEFAULT_DPI;
            }
        }
        return this._deviceDPI;
    }

    /**
     * 毫米转像素
     * @param {number|string} mm - 毫米值
     * @param {number|string} [dpi] - DPI值
     * @param {object} [options] - 可选参数 { direct: true } 是否允许非整数
     * @returns {number} 像素值
     */
    static mmToPx(
        mm: number | string,
        dpi?: number,
        options?: { direct?: boolean }
    ): number {
        const normalizedMm = this.normalizeNumber(mm, '毫米值');
        const currentDpi = this.getValidDpi(dpi);
        const directValue =
            (normalizedMm * currentDpi) / this.CONSTANTS.INCH_TO_MM;
        return options?.direct ? directValue : Math.ceil(directValue);
    }

    /**
     * 像素转毫米
     * @param {number|string} px - 像素值
     * @param {number|string} [dpi] - DPI值
     * @param {object} [options] - 可选参数
     * @returns {number} 毫米值
     */
    static pxToMm(px: number | string, dpi?: number, options?: unknown): number {
        const normalizedPx = this.normalizeNumber(px, '像素值');
        const currentDpi = this.getValidDpi(dpi);
        return (normalizedPx * this.CONSTANTS.INCH_TO_MM) / currentDpi;
    }

    /**
     * 批量转换毫米到像素
     */
    static mmToPxBatch(mmArray: Array<number | string>, dpi?: number): number[] {
        return mmArray.map((mm) => this.mmToPx(mm, dpi, undefined));
    }

    /**
     * 批量转换像素到毫米
     */
    static pxToMmBatch(pxArray: Array<number | string>, dpi?: number): number[] {
        return pxArray.map((px) => this.pxToMm(px, dpi, undefined));
    }

    // 私有方法
    static getValidDpi(dpi?: number): number {
        if (dpi !== undefined && dpi !== null) {
            const normalizedDpi = this.normalizeNumber(dpi, 'DPI值');
            if (normalizedDpi <= 0) {
                throw new Error('DPI值必须大于0');
            }
            return normalizedDpi;
        }
        const deviceDpi = this.getDeviceDPI();
        if (deviceDpi <= 0) {
            throw new Error('DPI值必须大于0');
        }
        return deviceDpi;
    }

    /**
     * 规范化数字输入（支持字符串和数字）
     * @param {number|string} value - 输入值
     * @param {string} name - 参数名称（用于错误提示）
     * @returns {number} 规范化后的数字
     */
    static normalizeNumber(value: number | string, name: string): number {
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed === '') {
                throw new Error(`${name}不能为空字符串`);
            }
            const num = Number(trimmed);
            if (isNaN(num)) {
                throw new Error(`${name}必须是有效数字，无法转换: "${value}"`);
            }
            return num;
        }
        if (typeof value !== 'number' || isNaN(value)) {
            throw new Error(`${name}必须是有效数字`);
        }
        return value;
    }

    static validateNumber(value: number | string, name: string): void {
        this.normalizeNumber(value, name);
    }

    // 重置设备DPI缓存（用于响应设备变化）
    static resetCache() {
        this._deviceDPI = null;
    }

    /**
     * pt（磅）转 px（像素）
     * @param {number|string} pt - 磅值
     * @param {object} [options] - 可选参数 { direct: true } 是否允许非整数
     * @returns {number} 像素值
     */
    static ptToPx(pt: number | string, options?: { direct?: boolean }): number {
        const normalizedPt = this.normalizeNumber(pt, '磅值');
        const currentDpi = this.getValidDpi(undefined);
        // 1英寸 = 72pt，所以 px = pt * dpi / 72
        const directValue = (normalizedPt * currentDpi) / 72;
        return options?.direct ? directValue : Math.ceil(directValue);
    }

    /**
     * px（像素）转 pt（磅）
     * @param {number|string} px - 像素值
     * @returns {number} 磅值
     */
    static pxToPt(px: number | string): number {
        const normalizedPx = this.normalizeNumber(px, '像素值');
        const currentDpi = this.getValidDpi(undefined);
        // 1英寸 = 72pt，所以 pt = px * 72 / dpi
        return (normalizedPx * 72) / currentDpi;
    }

    /**
     * 批量pt转px
     * @param {number[]} ptArray
     * @param {object} [options]
     * @returns {number[]}
     */
    static ptToPxBatch(
        ptArray: Array<number | string>,
        options?: { direct?: boolean }
    ): number[] {
        return ptArray.map((pt) => this.ptToPx(pt, options));
    }

    /**
     * 批量px转pt
     * @param {number[]} pxArray
     * @returns {number[]}
     */
    static pxToPtBatch(pxArray: Array<number | string>): number[] {
        return pxArray.map((px) => this.pxToPt(px));
    }

    /**
     * 毫米转磅（pt）
     * @param {number|string} mm - 毫米值
     * @returns {number} 磅值
     */
    static mmToPt(mm: number | string): number {
        // 毫米转磅（pt）
        // 1英寸 = 25.4毫米，1英寸 = 72pt，所以 1毫米 = 72/25.4 pt
        const normalizedMm = this.normalizeNumber(mm, '毫米值');
        return (normalizedMm * 72) / 25.4;
    }
}
