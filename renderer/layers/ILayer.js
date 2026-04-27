// Abstract interface — every layer type must implement all methods.
// Calling any unimplemented method throws so missing overrides surface immediately.
export class ILayer {
  getType()                                        { throw new Error(`${this.constructor.name} must implement getType()`); }
  getBadge()                                       { throw new Error(`${this.constructor.name} must implement getBadge()`); }
  getDefaults()                                    { throw new Error(`${this.constructor.name} must implement getDefaults()`); }

  // GM editor — append type-specific input fields via addField(label, inputEl)
  // ctx = { updateLayer: async (id, patch) => newLayers, imageBoundsFromSrc, refreshDetail: (layer) => void }
  renderEditorFields(layer, addField, ctx)         { throw new Error(`${this.constructor.name} must implement renderEditorFields()`); }

  // GM canvas overlay — draw the layer's visual content within bounds
  // overlayCtx = CanvasRenderingContext2D, bounds = { px, py, pw, ph }
  // gmCtx = { imageCache: Map<string, HTMLImageElement>, onImageLoaded: () => void }
  drawGMPreview(layer, overlayCtx, bounds, gmCtx) { throw new Error(`${this.constructor.name} must implement drawGMPreview()`); }

  // Player screen canvas — draw this layer
  // canvasCtx = CanvasRenderingContext2D, tx = { originX, originY, zoom }
  // deps = { CANVAS_SIZE, getMedia }
  drawPlayerLayer(layer, canvasCtx, tx, deps)      { throw new Error(`${this.constructor.name} must implement drawPlayerLayer()`); }
}
