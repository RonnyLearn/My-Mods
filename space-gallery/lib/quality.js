// Общие настройки качества + рендерер: размер канваса, сцена в FBO, апскейл (билинейный/бикубический),
// черезстрочность, лимит FPS, автокачество, bloom на этапе вывода. Не трогает камеру и вид.
(function () {
  const SV = (window.SV = window.SV || {});
  const G = SV.gl;

  const defaults = { res: 100, dpr: 0, mpx: 8, fps: 60, steps: 160, auto: true, autoMin: 50, bicubic: true, interlace: false };
  const presets = {
    economy: { label: 'Эконом', v: { res: 60, dpr: 1, mpx: 2, fps: 30, steps: 80, auto: true, autoMin: 35, bicubic: true, interlace: false } },
    normal: { label: 'Нормально', v: { res: 100, dpr: 0, mpx: 8, fps: 60, steps: 160, auto: true, autoMin: 50, bicubic: true, interlace: false } },
    high: { label: 'Высоко', v: { res: 100, dpr: 0, mpx: 16, fps: 60, steps: 240, auto: true, autoMin: 70, bicubic: true, interlace: false } },
    ultra: { label: 'Ультра', v: { res: 150, dpr: 0, mpx: 24, fps: 60, steps: 320, auto: false, autoMin: 80, bicubic: true, interlace: false } },
    extreme: { label: 'Экстрим 4K+', v: { res: 200, dpr: 0, mpx: 36, fps: 145, steps: 420, auto: false, autoMin: 100, bicubic: true, interlace: false } },
  };
  // Декларативное описание раздела панели. Ключи живут в пространстве 'q' (общем для всех визуализаций).
  const schema = {
    title: 'Качество', ns: 'q', open: false, items: [
      { type: 'presets', presets },
      { key: 'res', type: 'slider', label: 'Разрешение сцены', min: 25, max: 200, step: 1, unit: '%' },
      { key: 'dpr', type: 'select', label: 'Плотность пикселей', options: [[0, 'Авто'], [1, '×1'], [1.5, '×1.5'], [2, '×2'], [3, '×3'], [4, '×4']] },
      { key: 'mpx', type: 'slider', label: 'Предел канваса', min: 1, max: 36, step: 0.5, unit: ' Мп' },
      { key: 'fps', type: 'slider', label: 'Лимит FPS', min: 5, max: 145, step: 1, fmt: (v) => (v >= 145 ? 'макс' : v) },
      { key: 'steps', type: 'slider', label: 'Шаги луча', min: 32, max: 600, step: 1, hint: 'Чёрная дыра: точность геодезических' },
      { key: 'auto', type: 'toggle', label: 'Автокачество' },
      { key: 'autoMin', type: 'slider', label: 'Нижняя граница', min: 25, max: 100, step: 1, unit: '%' },
      { key: 'bicubic', type: 'toggle', label: 'Бикубический апскейл' },
      { key: 'interlace', type: 'toggle', label: 'Черезстрочность' },
    ],
  };

  // --- шейдер вывода: апскейл + bloom ---
  const PRESENT = `precision highp float;
uniform sampler2D uTex;uniform vec2 uSrc,uDst;uniform float uCubic,uBloom;
vec3 T(vec2 p){return texture2D(uTex,p/uSrc).rgb;}
// Catmull-Rom за 9 билинейных выборок
vec3 cubic(vec2 uv){
  vec2 sp=uv*uSrc,t1=floor(sp-.5)+.5,f=sp-t1;
  vec2 w0=f*(-.5+f*(1.-.5*f)),w1=1.+f*f*(-2.5+1.5*f),w2=f*(.5+f*(2.-1.5*f)),w3=f*f*(-.5+.5*f);
  vec2 w12=w1+w2,t0=t1-1.,t3=t1+2.,t12=t1+w2/w12;
  vec3 c=T(vec2(t0.x,t0.y))*w0.x*w0.y+T(vec2(t12.x,t0.y))*w12.x*w0.y+T(vec2(t3.x,t0.y))*w3.x*w0.y
        +T(vec2(t0.x,t12.y))*w0.x*w12.y+T(vec2(t12.x,t12.y))*w12.x*w12.y+T(vec2(t3.x,t12.y))*w3.x*w12.y
        +T(vec2(t0.x,t3.y))*w0.x*w3.y+T(vec2(t12.x,t3.y))*w12.x*w3.y+T(vec2(t3.x,t3.y))*w3.x*w3.y;
  return max(c,0.);
}
void main(){
  vec2 uv=gl_FragCoord.xy/uDst;
  vec3 c=uCubic>.5?cubic(uv):texture2D(uTex,uv).rgb;
  if(uBloom>0.){ // дешёвый bloom: два кольца выборок по ярким областям
    vec3 b=vec3(0.);float r=uSrc.y*.012;
    for(int i=0;i<16;i++){float a=float(i)*2.39996,k=float(i/8+1);
      vec3 s=texture2D(uTex,uv+vec2(cos(a),sin(a))*r*k*k/uSrc).rgb;b+=max(s-.55,0.)/k;}
    c+=b*uBloom*.12;
  }
  gl_FragColor=vec4(c,1.);
}`;

  class Renderer {
    constructor(canvas, gl) {
      this.c = canvas; this.gl = gl; this.q = Object.assign({}, defaults);
      this.scale = 1; this.fbo = null; this.tex = null; this.fw = 0; this.fh = 0; this.parity = 0;
      this.last = 0; this.acc = 0; this.win = []; this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      this.prog = G.program(gl, PRESENT, 'present');
      this.forced = null; // {w,h} для снимков
    }
    config(q) {
      this.q = Object.assign({}, defaults, q);
      const top = Math.max(0.05, this.q.res / 100);
      if (!this.q.auto || !(this.scale > 0) || this.scale > top) this.scale = top;
    }
    // Пора ли рисовать кадр (лимит FPS). Небольшой допуск, чтобы 60 на 60 Гц не терял кадры.
    due(now) {
      if (this.q.fps >= 145) return true;
      const iv = 1000 / this.q.fps;
      if (now - this.last >= iv - 2) { this.last = Math.max(this.last + iv, now - iv); return true; }
      return false;
    }
    // Автокачество: следим за интервалом кадров и плавно меняем масштаб сцены между autoMin и res.
    feedback(dtMs) {
      const q = this.q, top = q.res / 100;
      if (!q.auto) { this.scale = top; return; }
      this.win.push(dtMs); if (this.win.length < 20) return;
      const avg = this.win.reduce((a, b) => a + b) / this.win.length; this.win.length = 0;
      const target = 1000 / Math.min(q.fps >= 145 ? 60 : q.fps, 60);
      const lo = Math.min(q.autoMin / 100, top);
      if (avg > target * 1.3) this.scale = Math.max(lo, this.scale * 0.88);
      else if (avg < target * 1.08) this.scale = Math.min(top, this.scale * 1.05);
    }
    // Размер канваса по CSS-размеру, плотности пикселей и пределу в мегапикселях
    begin() {
      const gl = this.gl, q = this.q, c = this.c;
      let cw, ch, cssW, cssH;
      if (this.forced) { cssW = cw = this.forced.w; cssH = ch = this.forced.h; }
      else {
        cssW = Math.max(1, c.clientWidth); cssH = Math.max(1, c.clientHeight);
        let dpr = q.dpr > 0 ? q.dpr : window.devicePixelRatio || 1;
        const lim = q.mpx * 1e6;
        if (cssW * cssH * dpr * dpr > lim) dpr = Math.sqrt(lim / (cssW * cssH));
        cw = Math.max(1, Math.round(cssW * dpr)); ch = Math.max(1, Math.round(cssH * dpr));
      }
      if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
      let s = this.scale;
      let sw = Math.max(16, Math.round(cw * s)), sh = Math.max(16, Math.round(ch * s));
      const k = Math.min(1, this.maxTex / Math.max(sw, sh)); sw = Math.floor(sw * k); sh = Math.floor(sh * k);
      const direct = sw === cw && sh === ch && !q.interlace;
      if (!direct && (sw !== this.fw || sh !== this.fh)) this._alloc(sw, sh);
      gl.bindFramebuffer(gl.FRAMEBUFFER, direct ? null : this.fbo);
      gl.viewport(0, 0, sw, sh);
      this.parity ^= 1;
      this.frame = { w: sw, h: sh, cw, ch, cssW, cssH, uPx: sw / cssW, direct, interlace: q.interlace ? 1 + this.parity : 0, steps: q.steps };
      return this.frame;
    }
    _alloc(w, h) {
      const gl = this.gl;
      if (this.tex) { gl.deleteTexture(this.tex); gl.deleteFramebuffer(this.fbo); }
      this.tex = G.texture(gl, { w, h });
      this.fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      this.fw = w; this.fh = h;
    }
    // Вывод сцены на канвас. post: {bloom}
    end(post) {
      const gl = this.gl, f = this.frame, bloom = (post && post.bloom) || 0;
      if (f.direct && !bloom) return;
      if (f.direct) { // нужен bloom, а рисовали прямо в канвас: копируем в FBO и выводим
        if (f.w !== this.fw || f.h !== this.fh) this._alloc(f.w, f.h);
        gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, f.w, f.h);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, f.cw, f.ch);
      const up = f.w < f.cw * 0.999;
      this.prog.use().tex('uTex', 0, this.tex).set('uSrc', [f.w, f.h]).set('uDst', [f.cw, f.ch])
        .set('uCubic', this.q.bicubic && up ? 1 : 0).set('uBloom', bloom);
      G.drawQuad(gl);
    }
  }

  SV.Quality = { defaults, presets, schema, Renderer };
})();
