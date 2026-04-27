import { ImageLayer } from './ImageLayer.js';

export class GifLayer extends ImageLayer {
  getType()     { return 'gif'; }
  getBadge()    { return 'GIF'; }
  getDefaults() { return { type: 'gif', visible: true, opacity: 1 }; }
}
