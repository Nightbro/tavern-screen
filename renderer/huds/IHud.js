// Abstract interface — every HUD type must implement all methods.
// Calling any unimplemented method throws so missing overrides surface immediately.
class IHud {
  getType()                                  { throw new Error(`${this.constructor.name} must implement getType()`); }
  getBadge()                                 { throw new Error(`${this.constructor.name} must implement getBadge()`); }
  getDisplayName(hud)                        { throw new Error(`${this.constructor.name} must implement getDisplayName()`); }
  getDefaults()                              { throw new Error(`${this.constructor.name} must implement getDefaults()`); }

  // GM editor — called once at page load to wire event listeners
  mountEditor(ctx)                           { throw new Error(`${this.constructor.name} must implement mountEditor()`); }
  // GM editor — called when this HUD type is selected, populates editor DOM
  renderEditor(hud, ctx)                     { throw new Error(`${this.constructor.name} must implement renderEditor()`); }

  // Player screen — builds a single positioned panel element
  buildPlayerPanel(hud)                      { throw new Error(`${this.constructor.name} must implement buildPlayerPanel()`); }

  // GM simulation — estimates panel size before layout
  estimateSimSize(hud)                       { throw new Error(`${this.constructor.name} must implement estimateSimSize()`); }
  // GM simulation — fills the body div of a sim panel
  buildSimBody(container, hud)              { throw new Error(`${this.constructor.name} must implement buildSimBody()`); }
}
