import { ILayer }                        from './ILayer.js';
import { LayerBase }                     from './LayerBase.js';
import { ImageLayer }                    from './ImageLayer.js';
import { GifLayer }                      from './GifLayer.js';
import { VideoLayer }                    from './VideoLayer.js';
import { LightLayer }                    from './LightLayer.js';
import { FogLayer }                      from './FogLayer.js';
import { WeatherLayer }                  from './WeatherLayer.js';
import { WEATHER_TYPES, LAYER_GM_COLORS } from './settings-layers.js';

export {
  ILayer, LayerBase,
  ImageLayer, GifLayer, VideoLayer, LightLayer, FogLayer, WeatherLayer,
  WEATHER_TYPES, LAYER_GM_COLORS,
};

export const LAYER_REGISTRY = {
  image:   new ImageLayer(),
  gif:     new GifLayer(),
  video:   new VideoLayer(),
  light:   new LightLayer(),
  fog:     new FogLayer(),
  weather: new WeatherLayer(),
};
