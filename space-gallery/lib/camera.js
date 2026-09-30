// Камера мышью: ЛКМ — вращение, ПКМ/Shift — сдвиг, колесо — зум, двойной клик — сброс, касания — то же.
// Камера сама никогда не движется: целевые значения меняет только пользователь, сглаживание лишь догоняет их.
(function () {
  const SV = (window.SV = window.SV || {});
  const defaults = { smooth: 0.12, zoomSpeed: 1, tilt: 180 };
  const schema = {
    title: 'Камера (мышь)', ns: 'cam', open: false, items: [
      { type: 'note', text: 'ЛКМ — вращение, ПКМ или Shift — сдвиг, колесо — зум, двойной клик — сброс.' },
      { key: 'smooth', type: 'slider', label: 'Сглаживание', min: 0, max: 1.5, step: 0.01, unit: ' с' },
      { key: 'zoomSpeed', type: 'slider', label: 'Скорость зума', min: 0.1, max: 5, step: 0.05 },
      { key: 'tilt', type: 'slider', label: 'Предел наклона', min: 5, max: 180, step: 1, unit: '°', fmt: (v) => (v >= 180 ? 'нет' : v + '°') },
      { type: 'button', label: 'Сбросить камеру', action: 'camReset' },
    ],
  };
  const KEYS = ['yaw', 'pitch', 'zoom', 'panX', 'panY'];

  // o: { view: объект настроек (yaw,pitch,zoom,panX,panY), degPerPx(), yawSign(), zoomLimits() -> [min,max],
  //      onChange(), onReset() }
  class Camera {
    constructor(el, o) {
      this.el = el; this.o = o; this.c = Object.assign({}, defaults); this.cur = {}; this.snap();
      const on = (t, f, opt) => { el.addEventListener(t, f, opt); this._off.push(() => el.removeEventListener(t, f, opt)); };
      this._off = []; this.ptr = new Map();
      on('contextmenu', (e) => e.preventDefault());
      on('pointerdown', (e) => {
        el.setPointerCapture(e.pointerId);
        this.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey || e.button === 1 });
      });
      on('pointermove', (e) => {
        const p = this.ptr.get(e.pointerId); if (!p) return;
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        if (this.ptr.size === 2) { // щипок: зум по изменению расстояния
          const [a, b] = [...this.ptr.values()], d0 = Math.hypot(a.x - b.x, a.y - b.y);
          p.x = e.clientX; p.y = e.clientY;
          const d1 = Math.hypot(a.x - b.x, a.y - b.y);
          if (d0 > 0) this.zoomBy(d1 / d0);
          return;
        }
        p.x = e.clientX; p.y = e.clientY;
        this.drag(dx, dy, p.pan || e.shiftKey);
      });
      const up = (e) => this.ptr.delete(e.pointerId);
      on('pointerup', up); on('pointercancel', up);
      on('wheel', (e) => { e.preventDefault(); this.zoomBy(Math.exp(-e.deltaY * (e.deltaMode ? 40 : 1) * 0.0012 * this.c.zoomSpeed)); }, { passive: false });
      on('dblclick', () => this.o.onReset && this.o.onReset());
    }
    config(c) { this.c = Object.assign({}, defaults, c); }
    get v() { return this.o.view(); }
    drag(dx, dy, pan) {
      const v = this.v, h = this.el.clientHeight || 1;
      if (pan) { v.panX = (v.panX || 0) + (2 * dx) / h; v.panY = (v.panY || 0) - (2 * dy) / h; }
      else {
        const d = this.o.degPerPx(), flip = Math.cos((v.pitch * Math.PI) / 180) < 0 ? -1 : 1;
        v.yaw += dx * d * this.o.yawSign() * flip;
        v.pitch += dy * d;
        const t = this.c.tilt;
        if (t < 180) v.pitch = Math.max(-t, Math.min(t, v.pitch));
      }
      this.o.onChange && this.o.onChange();
    }
    zoomBy(k) {
      const v = this.v, [a, b] = this.o.zoomLimits ? this.o.zoomLimits() : [1e-3, 1e6];
      v.zoom = Math.max(a, Math.min(b, v.zoom * k));
      this.o.onChange && this.o.onChange();
    }
    // Мгновенно встать в целевое положение (смена сцены, сброс)
    snap() { const v = this.v; for (const k of KEYS) this.cur[k] = v[k] || 0; if (!(this.cur.zoom > 0)) this.cur.zoom = 1; }
    // Экспоненциальное сглаживание к цели; зум — в логарифме
    update(dt) {
      const v = this.v, s = this.c.smooth, a = s > 0 ? 1 - Math.exp(-dt / s) : 1;
      for (const k of KEYS) {
        const tv = v[k] || 0;
        if (k === 'zoom') this.cur.zoom = Math.exp(Math.log(this.cur.zoom) + (Math.log(Math.max(1e-6, tv)) - Math.log(this.cur.zoom)) * a);
        else this.cur[k] += (tv - this.cur[k]) * a;
      }
      return this.cur;
    }
    dispose() { this._off.forEach((f) => f()); }
  }

  SV.Camera = { defaults, schema, Camera };
})();
