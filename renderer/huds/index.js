import { DEFAULT_HUD_FONT_SIZE, PF1E_CONDITIONS } from './settings-huds.js';
import { IHud }          from './IHud.js';
import { HudBase }       from './HudBase.js';
import { InitiativeHud } from './InitiativeHud.js';
import { StatusHud }     from './StatusHud.js';
import { HandoutHud }    from './HandoutHud.js';

export { DEFAULT_HUD_FONT_SIZE, PF1E_CONDITIONS, IHud, HudBase, InitiativeHud, StatusHud, HandoutHud };

// Bridge: expose to classic scripts that haven't migrated to ES modules yet.
Object.assign(window, { DEFAULT_HUD_FONT_SIZE, PF1E_CONDITIONS, IHud, HudBase, InitiativeHud, StatusHud, HandoutHud });
