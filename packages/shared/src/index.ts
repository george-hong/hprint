import LengthConvert from './lengthConvert';
import mathHelper from './mathHelper';
import utils from './utils';
import { fabric } from 'fabric';
import { version } from '../package.json';

if (window) (window as (typeof window & { _hprintPrintVersion: string }))._hprintPrintVersion = version

export { LengthConvert, mathHelper, utils, fabric };
