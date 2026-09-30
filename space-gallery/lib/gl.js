// Мини-хелперы WebGL1: программы с кешем uniform'ов, полноэкранный треугольник, текстуры.
(function () {
  const SV = (window.SV = window.SV || {});
  const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

  function shader(gl, type, src, name) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s) || '';
      // печатаем строки вокруг ошибки — иначе в огромном шейдере не найти
      const m = /0:(\d+)/.exec(log), lines = src.split('\n'), n = m ? +m[1] : 0;
      console.error(name + ':\n' + log + '\n' + lines.slice(Math.max(0, n - 4), n + 3).map((l, i) => (n - 3 + i) + ': ' + l).join('\n'));
      throw new Error('Ошибка компиляции шейдера ' + name + ': ' + log.split('\n')[0]);
    }
    return s;
  }

  // Программа: p.set('uName', число|массив), p.m3(name, arr9), p.v4a(name, flatArray), p.tex(name, unit, tex)
  function program(gl, fs, name, vs) {
    const p = gl.createProgram();
    gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, vs || VS, name + '.vs'));
    gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, fs, name + '.fs'));
    gl.bindAttribLocation(p, 0, 'a');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Ошибка линковки ' + name + ': ' + gl.getProgramInfoLog(p));
    const loc = {}, L = (n) => (n in loc ? loc[n] : (loc[n] = gl.getUniformLocation(p, n)));
    return {
      id: p,
      use() { gl.useProgram(p); return this; },
      set(n, v) {
        const l = L(n); if (l === null) return this;
        if (typeof v === 'number' || typeof v === 'boolean') gl.uniform1f(l, +v);
        else if (v.length === 2) gl.uniform2fv(l, v);
        else if (v.length === 3) gl.uniform3fv(l, v);
        else gl.uniform4fv(l, v);
        return this;
      },
      m3(n, v) { const l = L(n); if (l !== null) gl.uniformMatrix3fv(l, false, v); return this; },
      v4a(n, v) { const l = L(n); if (l !== null) gl.uniform4fv(l, v); return this; },
      tex(n, unit, t) { const l = L(n); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); if (l !== null) gl.uniform1i(l, unit); return this; },
    };
  }

  // Один большой треугольник на весь экран
  function drawQuad(gl) {
    if (!gl._svQuad) {
      gl._svQuad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, gl._svQuad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, gl._svQuad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // Текстура из пикселей/картинки/канваса. o: {w,h,data,src,filter:'linear'|'nearest'}
  function texture(gl, o) {
    const t = gl.createTexture(), f = o.filter === 'nearest' ? gl.NEAREST : gl.LINEAR;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    if (o.src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, o.src);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, o.w, o.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, o.data || null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  // Картинка из data URI -> Promise<Image>
  function image(src) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('Не удалось декодировать изображение'));
      im.src = src;
    });
  }

  // Строковые хелперы для матриц 3x3 (column-major, как ждёт GL)
  const m3 = {
    cols: (a, b, c) => [a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]],
    mul(A, B) { // A*B
      const r = new Array(9);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[j * 3 + i] = A[i] * B[j * 3] + A[3 + i] * B[j * 3 + 1] + A[6 + i] * B[j * 3 + 2];
      return r;
    },
    rot(axis, a) { // поворот вокруг оси 0=x 1=y 2=z
      const c = Math.cos(a), s = Math.sin(a);
      if (axis === 0) return [1, 0, 0, 0, c, s, 0, -s, c];
      if (axis === 1) return [c, 0, -s, 0, 1, 0, s, 0, c];
      return [c, s, 0, -s, c, 0, 0, 0, 1];
    },
  };

  const hex3 = (h) => { const n = parseInt(String(h).replace('#', ''), 16) || 0; return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((x) => Math.pow(x, 2.2)); };

  SV.gl = { program, drawQuad, texture, image, m3, hex3, VS };
})();
