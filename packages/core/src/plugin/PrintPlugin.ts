import { fabric } from 'fabric';
import type { IEditor, IPluginTempl } from '@hprint/core';
import { io } from 'socket.io-client';

type IPlugin = Pick<PrintPlugin, 'printPDF' | 'getPrinterList'>;

export interface Option {
    'printer-location': string;
    'printer-make-and-model': string;
    system_driverinfo: string;
}

export interface IPrinterItem {
    name: string;
    displayName: string;
    description: string;
    status: number;
    isDefault: boolean;
    options: Option;
}

export interface IPrintPDFOption {
    width: number;
    height: number;
    base64: string;
}

declare module '@hprint/core' {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface IEditor extends IPlugin {}
}

export default class PrintPlugin implements IPluginTempl {
    static pluginName = 'PrintPlugin';
    static apis = ['printPDF', 'getPrinterList'];

    socket?: any;
    isConnect = false;
    printerList: IPrinterItem[] = [];

    constructor(
        public canvas: fabric.Canvas,
        public editor: IEditor
    ) {
        this.editor = editor;
        this.canvas = canvas;

        this.socket = io('http://localhost:17521', {
            transports: ['websocket'],
            auth: {
                token: 'vue-plugin-hiprint',
            },
        });

        this.socket.on('connect', () => {
            this.isConnect = true;
            // globalThis.connect = true;
            // TODO: Do something for your project
        });

        this.socket.on('printerList', (printerList: IPrinterItem[]) => {
            console.log('printerList', printerList);
            this.printerList = printerList;
        });
    }

    printPDF(options: IPrintPDFOption) {
        this.socket.emit('printPDF', {
            ...options,
            unit: 'mm',
        });
    }

    getPrinterList() {
        return this.printerList;
    }

    destroy() {
        console.log('pluginDestroy');
    }
}
