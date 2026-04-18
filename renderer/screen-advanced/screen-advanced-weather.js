// ── Weather particle system ───────────────────────────────────────────────────

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
};

function spawnParticle(type, cw, ch, randomY = false) {
  const cfg  = WEATHER_CFG[type] || WEATHER_CFG.rain;
  const vy   = cfg.speed + (Math.random() - 0.5) * Math.abs(cfg.speed) * 0.4;
  const vx   = (Math.random() - 0.5) * cfg.spreadX * Math.abs(vy);
  const size = cfg.size[0] + Math.random() * (cfg.size[1] - cfg.size[0]);
  return {
    x:     Math.random() * cw,
    y:     randomY
      ? Math.random() * ch
      : (cfg.speed >= 0 ? -size - Math.random() * ch * 0.2 : ch + size),
    vx, vy, size,
    color: cfg.color(),
    phase: Math.random() * Math.PI * 2,
    px: 0, py: 0,
  };
}

function getWeatherParticles(type) {
  if (!weatherParticles.has(type)) {
    const cfg = WEATHER_CFG[type] || WEATHER_CFG.rain;
    const cw  = window.innerWidth;
    const ch  = window.innerHeight;
    weatherParticles.set(type,
      Array.from({ length: cfg.count }, () => spawnParticle(type, cw, ch, true))
    );
  }
  return weatherParticles.get(type);
}

let _lastTs = 0;
function drawWeatherLayer(layer, timestamp) {
  const type      = layer.weatherType || 'rain';
  const intensity = Math.max(0, Math.min(3, layer.intensity ?? 1));
  const cfg       = WEATHER_CFG[type] || WEATHER_CFG.rain;
  const ps        = getWeatherParticles(type);
  const cw        = window.innerWidth;
  const ch        = window.innerHeight;
  const dt        = Math.min((_lastTs ? timestamp - _lastTs : 16) / 16, 4);
  const visible   = Math.min(ps.length, Math.max(0, Math.floor(ps.length * intensity)));

  ctx.save();
  if (layer.x != null && layer.y != null && layer.w != null && layer.h != null) {
    const tx = computeMapTransform(scene.viewport);
    ctx.beginPath();
    ctx.rect(
      tx.originX + layer.x * tx.zoom,
      tx.originY + layer.y * tx.zoom,
      layer.w * tx.zoom,
      layer.h * tx.zoom,
    );
    ctx.clip();
  }
  for (let i = 0; i < visible; i++) {
    const p = ps[i];
    if (type === 'fireflies') {
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
    cfg.draw(ctx, p);
  }
  ctx.restore();
}
