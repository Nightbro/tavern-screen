import { LayerBase }     from './LayerBase.js';
import { WEATHER_TYPES } from './settings-layers.js';

const WEATHER_CFG = {
  rain: {
    count: 180, speed: 14, spreadX: 1.2, size: [1, 2],
    color: () => `rgba(140,185,220,${0.4 + Math.random() * 0.4})`,
    draw(ctx, p) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth   = p.size;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
      ctx.stroke();
    },
  },
  snow: {
    count: 120, speed: 1.8, spreadX: 0.4, size: [2, 5],
    color: () => `rgba(220,235,255,${0.5 + Math.random() * 0.4})`,
    draw(ctx, p) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  embers: {
    count: 90, speed: -2.5, spreadX: 0.8, size: [2, 4],
    color: () => `rgba(${200 + Math.random() * 55},${60 + Math.random() * 80},20,${0.6 + Math.random() * 0.4})`,
    draw(ctx, p) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  fog: {
    count: 28, speed: 0.25, spreadX: 0.06, size: [90, 220],
    color: () => `rgba(130,145,165,${0.14 + Math.random() * 0.14})`,
    draw(ctx, p) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      g.addColorStop(0, p.color);
      g.addColorStop(1, 'rgba(130,145,165,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  fireflies: {
    count: 45, speed: 0, spreadX: 0, size: [3, 6],
    color: () => `rgba(160,255,140,${0.6 + Math.random() * 0.4})`,
    draw(ctx, p) {
      const brightness = 0.5 + 0.5 * Math.sin(p.phase);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.5);
      g.addColorStop(0, `rgba(160,255,140,${brightness * 0.9})`);
      g.addColorStop(1, 'rgba(160,255,140,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
      ctx.fill();
    },
  },

  // ── New atmosphere effects ────────────────────────────────────────────────

  fire: {
    count: 80, speed: -7, spreadX: 1.4, size: [8, 22],
    color: () => '',
    init(p) { p.life = 0.6 + Math.random() * 0.4; },
    tick(p, dt, cw, ch) {
      p.phase += 0.06 * dt;
      p.x     += Math.sin(p.phase * 1.4) * 1.6 * dt + p.vx * dt;
      p.y     += p.vy * dt;
      p.life   = Math.max(0, p.life - 0.016 * dt);
      return p.life <= 0 || p.x < -p.size * 4 || p.x > cw + p.size * 4;
    },
    draw(ctx, p) {
      const t = p.life ?? 1;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      g.addColorStop(0,   `rgba(255,${Math.floor(220 + 35 * t)},${Math.floor(80 * t)},${t * 0.9})`);
      g.addColorStop(0.4, `rgba(255,${Math.floor(110 * t)},0,${t * 0.55})`);
      g.addColorStop(1,   'rgba(160,10,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    },
  },

  smoke: {
    count: 22, speed: -0.9, spreadX: 0.28, size: [55, 140],
    color: () => '',
    init(p) { p.life = 0.7 + Math.random() * 0.3; },
    tick(p, dt, cw, ch) {
      p.phase += 0.007 * dt;
      p.x     += Math.sin(p.phase) * 0.5 * dt + p.vx * dt;
      p.y     += p.vy * dt;
      p.life   = Math.max(0, p.life - 0.004 * dt);
      return p.life <= 0 || p.y < -p.size * 4;
    },
    draw(ctx, p) {
      const t = p.life ?? 1;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      g.addColorStop(0, `rgba(55,52,50,${t * 0.28})`);
      g.addColorStop(1, 'rgba(55,52,50,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    },
  },

  mist: {
    count: 28, speed: -0.35, spreadX: 0.1, size: [110, 270],
    color: () => '',
    init(p) { p.life = 0.65 + Math.random() * 0.35; },
    tick(p, dt, cw, ch) {
      p.phase += 0.004 * dt;
      p.x     += Math.sin(p.phase * 0.7) * 0.35 * dt + p.vx * dt;
      p.y     += p.vy * dt;
      p.life   = Math.max(0, p.life - 0.0025 * dt);
      return p.life <= 0 || p.y < -p.size * 4;
    },
    draw(ctx, p) {
      const t = p.life ?? 1;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      g.addColorStop(0, `rgba(210,215,228,${t * 0.18})`);
      g.addColorStop(1, 'rgba(210,215,228,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    },
  },
};

function spawnParticle(type, cw, ch, randomY = false) {
  const cfg  = WEATHER_CFG[type] || WEATHER_CFG.rain;
  const vy   = cfg.speed + (Math.random() - 0.5) * Math.abs(cfg.speed) * 0.4;
  const vx   = (Math.random() - 0.5) * cfg.spreadX * Math.abs(vy);
  const size = cfg.size[0] + Math.random() * (cfg.size[1] - cfg.size[0]);
  const p = {
    x:    Math.random() * cw,
    y:    randomY
      ? Math.random() * ch
      : (cfg.speed >= 0 ? -size - Math.random() * ch * 0.2 : ch + size),
    vx, vy, size,
    color: cfg.color(),
    phase: Math.random() * Math.PI * 2,
    px: 0, py: 0,
  };
  cfg.init?.(p);
  return p;
}

export class WeatherLayer extends LayerBase {
  #lastTs = 0;

  getType()     { return 'weather'; }
  getBadge()    { return 'Wx'; }
  getDefaults() { return { type: 'weather', visible: true, weatherType: 'rain', intensity: 1 }; }

  renderEditorFields(layer, addField, ctx) {
    const typeSelect = document.createElement('select');
    WEATHER_TYPES.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t; opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
      if (t === (layer.weatherType ?? 'rain')) opt.selected = true;
      typeSelect.appendChild(opt);
    });
    addField('Type', typeSelect);
    typeSelect.addEventListener('change', async () => {
      await ctx.updateLayer(layer.id, { weatherType: typeSelect.value });
    });

    const intInput = document.createElement('input');
    intInput.type  = 'number'; intInput.min = 0.1; intInput.max = 3; intInput.step = 0.1;
    intInput.value = layer.intensity ?? 1;
    addField('Intensity', intInput);
    intInput.addEventListener('change', async () => {
      await ctx.updateLayer(layer.id, { intensity: parseFloat(intInput.value) || 1 });
    });
  }

  setLastTs(ts) { this.#lastTs = ts; }

  // Animate and draw weather particles.
  // weatherParticles = Map<type, particle[]> from screen-advanced-state.js
  // deps = { computeMapTransform, viewport }
  drawWeatherFrame(layer, canvasCtx, timestamp, weatherParticles, deps) {
    const type      = layer.weatherType || 'rain';
    const intensity = Math.max(0, Math.min(3, layer.intensity ?? 1));
    const cfg       = WEATHER_CFG[type] || WEATHER_CFG.rain;
    const cw        = window.innerWidth;
    const ch        = window.innerHeight;
    const dt        = Math.min((this.#lastTs ? timestamp - this.#lastTs : 16) / 16, 4);

    if (!weatherParticles.has(type)) {
      weatherParticles.set(type,
        Array.from({ length: cfg.count }, () => spawnParticle(type, cw, ch, true))
      );
    }
    const ps      = weatherParticles.get(type);
    const visible = Math.min(ps.length, Math.max(0, Math.floor(ps.length * intensity)));

    canvasCtx.save();
    if (layer.x != null && layer.y != null && layer.w != null && layer.h != null) {
      const { computeMapTransform, viewport } = deps;
      const tx = computeMapTransform(viewport);
      canvasCtx.beginPath();
      canvasCtx.rect(
        tx.originX + layer.x * tx.zoom,
        tx.originY + layer.y * tx.zoom,
        layer.w * tx.zoom,
        layer.h * tx.zoom,
      );
      canvasCtx.clip();
    }

    for (let i = 0; i < visible; i++) {
      const p = ps[i];
      if (cfg.tick) {
        if (cfg.tick(p, dt, cw, ch)) Object.assign(p, spawnParticle(type, cw, ch, false));
      } else if (type === 'fireflies') {
        p.phase += 0.025 * dt;
        p.x += Math.sin(p.phase * 1.1) * 0.7 * dt;
        p.y += Math.cos(p.phase * 0.8) * 0.5 * dt;
        if (p.x < -20)     p.x = cw + 20;
        if (p.x > cw + 20) p.x = -20;
        if (p.y < -20)     p.y = ch + 20;
        if (p.y > ch + 20) p.y = -20;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const gone = cfg.speed >= 0 ? p.y > ch + p.size * 4 : p.y < -p.size * 4;
        if (gone || p.x < -p.size * 4 || p.x > cw + p.size * 4) {
          Object.assign(p, spawnParticle(type, cw, ch, false));
        }
      }
      cfg.draw(canvasCtx, p);
    }

    canvasCtx.restore();
  }
}
