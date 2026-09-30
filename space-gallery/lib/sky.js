// Общий шейдер неба для всех визуализаций: карта Млечного Пути (3 мипа по размеру пикселя), каталог HYG
// (ячейки 1°x1°, 16 звёзд, вторая копия в повёрнутой системе у полюсов), процедурные слабые звёзды 10–20m,
// туманности и галактики в их реальных координатах. Функция GLSL: vec3 skyColor(dir, ex, ey) — dir в
// галактической системе, ex/ey — приращение направления на один пиксель по x/y (для размера пикселя и PSF).
(function () {
  const SV = (window.SV = window.SV || {});
  const G = SV.gl;
  const D2R = Math.PI / 180;
  const EQ2GAL = [[-0.0548755604, -0.8734370902, -0.4838350155], [0.4941094279, -0.444829630, 0.7469822445], [-0.867666149, -0.1980763734, 0.4559837762]];
  const eq2gal = (v) => EQ2GAL.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
  const radec = (raH, de) => { const a = raH * 15 * D2R, d = de * D2R; return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)]; };

  // Туманности и галактики: RA (ч), Dec (°), радиус (°), тип, позиционный угол (°), сжатие, сила, «дыра», цвет
  // типы: 0 эмиссионная HII, 1 отражательная, 2 спиральная галактика, 3 Магелланово облако, 4 дуга (петля Барнарда),
  //       5 комплекс ρ Змееносца, 6 туманность Гама
  const OBJECTS = [
    ['Туманность Ориона', 5.588, -5.39, 0.75, 0, 20, 0.85, 2.6, 0, 0],
    ['Петля Барнарда', 5.62, -1.8, 7.2, 4, 10, 0.9, 0.55, 0, 0],
    ['Розетка', 6.54, 4.95, 0.7, 0, 0, 1, 1.4, 0.38, 0],
    ['Лагуна', 18.06, -24.38, 0.6, 0, 80, 0.55, 1.9, 0, 0],
    ['Трёхраздельная', 18.04, -23.03, 0.22, 0, 0, 0.9, 1.5, 0, 1],
    ['Омега', 18.35, -16.17, 0.3, 0, 30, 0.6, 1.6, 0, 0],
    ['Орёл', 18.31, -13.78, 0.35, 0, 0, 0.9, 1.3, 0.15, 0],
    ['Туманность Киля', 10.73, -59.87, 1.3, 0, 40, 0.7, 2.4, 0, 0],
    ['Северная Америка', 20.98, 44.33, 1.15, 0, 0, 0.9, 1.4, 0, 0],
    ['Пеликан', 20.85, 44.35, 0.55, 0, 40, 0.8, 1.0, 0, 0],
    ['Плеяды', 3.79, 24.12, 0.9, 1, 0, 1, 1.0, 0, 0],
    ['ρ Змееносца', 16.43, -23.45, 3.0, 5, 0, 1, 1.1, 0, 0],
    ['Антарес', 16.49, -26.43, 1.4, 1, 0, 1, 0.9, 0, 1],
    ['Туманность Гама', 8.5, -43.0, 18, 6, 0, 1, 0.45, 0, 0],
    ['M31 Андромеда', 0.712, 41.27, 1.6, 2, 38, 0.32, 1.4, 0, 0],
    ['M33 Треугольник', 1.564, 30.66, 0.45, 2, 23, 0.65, 0.7, 0, 0],
    ['Большое Магелланово Облако', 5.39, -69.76, 4.8, 3, 0, 0.8, 1.2, 0, 0],
    ['Малое Магелланово Облако', 0.877, -72.83, 2.3, 3, 45, 0.6, 0.8, 0, 1],
  ];
  const NOBJ = OBJECTS.length;

  // Упаковка объектов в массивы uniform: центр/радиус, большая ось, малая ось, параметры
  function packObjects() {
    const a = [], b = [], c = [], d = [];
    for (const o of OBJECTS) {
      const [, ra, de, R, type, pa, asp, str, hole, cm] = o;
      const cE = radec(ra, de), cg = eq2gal(cE);
      // локальный базис в экваториальной системе: восток и север
      const east = [-Math.sin(ra * 15 * D2R), Math.cos(ra * 15 * D2R), 0];
      const north = [cE[1] * east[2] - cE[2] * east[1], cE[2] * east[0] - cE[0] * east[2], cE[0] * east[1] - cE[1] * east[0]];
      const p = pa * D2R, maj = [0, 1, 2].map((i) => Math.sin(p) * east[i] + Math.cos(p) * north[i]);
      const min = [0, 1, 2].map((i) => Math.cos(p) * east[i] - Math.sin(p) * north[i]);
      const mg = eq2gal(maj), ng = eq2gal(min);
      a.push(cg[0], cg[1], cg[2], R * D2R);
      b.push(mg[0], mg[1], mg[2], Math.cos(Math.min(R * 1.6 + 0.5, 60) * D2R));
      c.push(ng[0], ng[1], ng[2], type);
      d.push(asp, str, hole, cm);
    }
    return { a, b, c, d };
  }

  const GLSL = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
const float PI=3.14159265,D2R=.01745329;
uniform sampler2D uMap0,uMap1,uMap2,uCell0,uCell1;
uniform vec3 uMapW;           // ширины мипов (без 2 пикселей паддинга)
uniform float uTexel0;        // угол одного текселя мипа 0, рад
uniform mat3 uBandRot;
uniform float uPx,uExp,uIL,uAng0;
uniform float uBand,uBandW,uBandS,uCore,uDust,uDetail,uWarm,uHa,uHaze;
uniform float uNebA,uGalA,uNebB,uStarB,uStarD,uStarF,uStarS,uSharp;
uniform float uShowMW,uShowSt,uShowObj;
uniform vec4 uO0[${NOBJ}],uO1[${NOBJ}],uO2[${NOBJ}],uO3[${NOBJ}];

// ---------- хеши и шум ----------
float h12(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
vec4 h42(vec2 p){vec4 q=fract(vec4(p.xyxy)*vec4(.1031,.1030,.0973,.1099));q+=dot(q,q.wzxy+33.33);return fract((q.xxyz+q.yzzw)*q.zywx);}
float h13(vec3 q){q=fract(q*.1031);q+=dot(q,q.zyx+31.32);return fract((q.x+q.y)*q.z);}
float vn3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(h13(i),h13(i+vec3(1,0,0)),f.x),mix(h13(i+vec3(0,1,0)),h13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h13(i+vec3(0,0,1)),h13(i+vec3(1,0,1)),f.x),mix(h13(i+vec3(0,1,1)),h13(i+1.),f.x),f.y),f.z);}
float fbm3(vec3 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vn3(p);p=p*2.03+vec3(17.1,3.7,9.2);a*=.5;}return s*1.0667;}
float vn2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h12(i),h12(i+vec2(1,0)),f.x),mix(h12(i+vec2(0,1)),h12(i+1.),f.x),f.y);}
const mat2 RM=mat2(1.6,1.2,-1.2,1.6);
float fbm2(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vn2(p);p=RM*p+3.1;a*=.5;}return s*1.032;}
float rid2(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){float n=1.-abs(vn2(p)*2.-1.);s+=a*n*n;p=RM*p+1.7;a*=.5;}return s*1.032;}
// доменно-искажённый fbm — рваные волокнистые края вместо «гуаши»
float wfbm(vec2 p,float s){vec2 q=vec2(fbm2(p+s),fbm2(p+vec2(5.2,1.3)-s));return fbm2(p+2.4*q+s*1.7);}
float luma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}

// ---------- карта Млечного Пути ----------
vec3 mapTex(sampler2D s,vec2 uv,float w){uv.x=fract(uv.x);return pow(texture2D(s,vec2((uv.x*w+1.)/(w+2.),uv.y)).rgb,vec3(2.2));}
float gYlo;   // низкочастотная яркость полосы (для плотности звёзд и Hα)
vec3 band(vec3 d,float ang){
  vec3 q=uBandRot*d;
  float l=atan(q.y,q.x),b=asin(clamp(q.z,-1.,1.));
  // масштаб узора; у антицентра плавно возвращаемся к l=±π, чтобы не было шва
  float wl=smoothstep(.55*PI,PI,abs(l));l=mix(l/uBandS,l,wl);
  b/=uBandS*uBandW;float fade=1.-smoothstep(1.45,1.5707,abs(b));b=clamp(b,-1.5707,1.5707);
  vec2 uv=vec2(.5-l/(2.*PI),.5-b/PI);
  float t=log2(max(ang/(uTexel0*uBandS),1e-6))*.5;  // log4 футпринта пикселя в текселях мипа 0
  vec3 lo=mapTex(uMap2,uv,uMapW.z),c;
  if(t<=0.)c=mapTex(uMap0,uv,uMapW.x);
  else if(t<1.)c=mix(mapTex(uMap0,uv,uMapW.x),mapTex(uMap1,uv,uMapW.y),t);
  else if(t<2.)c=mix(mapTex(uMap1,uv,uMapW.y),lo,t-1.);
  else c=lo;
  float Y=luma(c),Yl=luma(lo);gYlo=Yl*fade;
  // контраст пыли относительно гладкого уровня
  c*=pow(clamp(Y/max(Yl,1e-5),.03,3.),uDust-1.);
  // мелкая деталь при увеличении: зерно неразрешённых звёзд и тонкие пылевые прожилки
  float mg=smoothstep(-.3,1.6,-t)*uDetail;
  if(mg>0.){
    vec3 p=q*2600./uBandS;
    float g=fbm3(p),f=vn3(p*4.3),r=1.-abs(fbm3(p*.6+3.)*2.-1.);
    float dusty=clamp(1.-Y/max(Yl,1e-5),0.,1.)+.25;
    c*=max(0.,1.+mg*((g-.5)*.8+(f-.5)*.35-dusty*.9*smoothstep(.72,.95,r)));
  }
  // яркое ядро (балдж) и тёплый тон
  float core=exp(-(l*l/.07+b*b/.028));
  c*=1.+(uCore-1.)*core;
  c*=mix(vec3(.94,.98,1.07),vec3(1.1,.97,.82),uWarm);
  // широкое розовое свечение Hα вдоль полосы
  float ha=uHa*Yl*(.25+1.1*fbm3(q*7.))*exp(-b*b/.018)*(.5+.5*smoothstep(1.9,.3,abs(l)));
  c+=ha*vec3(1.,.22,.36)*.9;
  return c*uBand*fade;
}

// ---------- туманности и галактики ----------
// emission (rgb) и поглощение (a) для объекта i в нормированных координатах p (радиус объекта = 1)
vec4 nebEmission(vec2 p,float hole,float cm,float s){
  float r=length(p);
  float edge=r*(.72+.56*fbm2(p*2.3+s));               // рваная граница
  float env=exp(-edge*edge*2.4)*(1.-smoothstep(.75,1.05,edge));
  if(hole>0.)env*=smoothstep(hole*.55,hole*1.2,r*(.85+.3*vn2(p*6.+s)));
  float n=wfbm(p*2.6,s),rg=rid2(p*3.7+n*1.6+s);
  float fil=pow(rg,3.);
  float dens=env*(.25+.95*n*n+.9*fil);
  vec3 ha=vec3(1.,.14,.2)*dens;                           // красные Hα края
  float oc=env*env*smoothstep(.45,.95,n)*(1.-smoothstep(0.,.75,r));
  vec3 o3=vec3(.2,.85,.8)*oc*.55;                         // бирюзовое [OIII] ядро
  vec3 refl=vec3(.35,.55,1.)*env*cm*smoothstep(.1,.7,p.y+.3*n)*.9; // голубая отражательная часть
  float veins=smoothstep(.58,.9,rid2(p*5.2+s*3.1))*env*(.6+.4*n);  // тёмные пылевые прожилки
  return vec4((ha+o3+refl)*(1.-veins*.85),veins*.75);
}
vec4 reflNeb(vec2 p,float cm,float s){
  float r=length(p);
  float w=fbm2(vec2(p.x*1.4,p.y*5.)+s)*.7+fbm2(p*3.+s)*.5;   // вытянутые волокна
  float env=exp(-r*r*2.2)*(1.-smoothstep(.7,1.05,r*(.8+.4*vn2(p*3.+s))));
  vec3 col=mix(vec3(.38,.56,1.),vec3(1.,.72,.38),cm);
  return vec4(col*env*w*w*1.6,0.);
}
vec4 galaxy(vec2 p,float s){                              // p уже растянут по сжатию
  float r=length(p);
  float bul=exp(-r/.045)*1.8+exp(-r/.12)*.5,disk=exp(-r/.28);
  float ang=atan(p.y,p.x),arm=.5+.5*sin(2.*ang-9.*log(r+.05)+fbm2(p*6.+s)*2.);
  float lanes=smoothstep(.55,.95,arm)*smoothstep(.05,.25,r)*smoothstep(1.1,.4,r);
  vec3 c=vec3(1.,.84,.64)*bul+vec3(.85,.88,1.)*disk*(.55+.6*fbm2(p*14.+s));
  c+=vec3(1.,.3,.45)*disk*smoothstep(.8,.95,vn2(p*22.+s))*.8;
  c*=1.-lanes*.55;
  return vec4(c*(1.-smoothstep(.75,1.1,r)),lanes*disk*.3);
}
vec4 magellan(vec2 p,float cm,float s){
  float r=length(p);
  vec2 bp=vec2(p.x*.45,p.y*1.4);
  float bar=exp(-dot(bp,bp)*6.);
  float cl=wfbm(p*2.2,s),body=exp(-r*r*2.6)*(1.-smoothstep(.7,1.05,r*(.8+.4*cl)));
  vec3 c=vec3(.88,.9,1.)*(body*(.35+cl*cl*1.4)+bar*.9);
  vec2 dor=p-vec2(.28,.18);                               // 30 Золотой Рыбы
  c+=vec3(1.,.25,.35)*(exp(-dot(dor,dor)*260.)*1.6*(1.-cm)+body*smoothstep(.75,.95,vn2(p*16.+s))*.7);
  return vec4(c,0.);
}
vec4 arcNeb(vec2 p,float s){
  float r=length(p),a=atan(p.y,p.x);
  float rr=r+.08*(fbm2(p*3.+s)-.5);
  float ring=exp(-pow((rr-.86)/.07,2.))*smoothstep(-.6,.5,cos(a-.3));
  return vec4(vec3(1.,.15,.22)*ring*(.3+1.4*pow(rid2(p*6.+s),2.)),0.);
}
vec4 rhoOph(vec2 p,float s){
  float r=length(p),n=wfbm(p*2.,s);
  float env=exp(-r*r*2.)*(1.-smoothstep(.7,1.05,r*(.8+.4*n)));
  vec3 c=vec3(.35,.5,1.)*exp(-dot(p-vec2(.05,.2),p-vec2(.05,.2))*18.)*1.5
        +vec3(1.,.75,.35)*exp(-dot(p-vec2(.1,-.55),p-vec2(.1,-.55))*14.)*1.3
        +vec3(1.,.18,.25)*exp(-dot(p-vec2(-.35,-.2),p-vec2(-.35,-.2))*10.)*.9;
  float dust=smoothstep(.45,.85,rid2(vec2(p.x*1.3-p.y*.6,p.y*2.)*2.4+s))*env;
  return vec4(c*env*(.4+n)*(1.-dust*.8),dust*.8);
}
vec4 gumNeb(vec2 p,float s){
  float r=length(p);
  float shell=exp(-pow((r-.75)/.25,2.))*(1.-smoothstep(.95,1.1,r));
  return vec4(vec3(1.,.2,.28)*shell*pow(rid2(p*4.+s),3.)*.6,0.);
}
float gAbs;
vec3 objects(vec3 d){
  vec3 acc=vec3(0.);gAbs=0.;
  for(int i=0;i<${NOBJ};i++){
    vec4 A=uO0[i],B=uO1[i],C=uO2[i],P=uO3[i];
    float cd=dot(d,A.xyz);
    if(cd<B.w)continue;
    float ty=C.w,gal=(ty>1.5&&ty<3.5)?1.:0.,amt=mix(uNebA,uGalA,gal);
    if(amt<=0.)continue;
    vec2 p=vec2(dot(d,B.xyz),dot(d,C.xyz))/cd/tan(A.w);  // гномоническая проекция, радиус = 1
    p.y/=P.x;
    if(dot(p,p)>1.6)continue;
    float s=float(i)*7.31;vec4 e;
    if(ty<.5)e=nebEmission(p,P.z,P.w,s);
    else if(ty<1.5)e=reflNeb(p,P.w,s);
    else if(ty<2.5)e=galaxy(p,s);
    else if(ty<3.5)e=magellan(p,P.w,s);
    else if(ty<4.5)e=arcNeb(p,s);
    else if(ty<5.5)e=rhoOph(p,s);
    else e=gumNeb(p,s);
    acc+=e.rgb*P.y*amt*mix(uNebB,1.,gal)*.09;
    gAbs=max(gAbs,e.a*min(amt,1.));
  }
  return acc;
}

// ---------- звёзды ----------
float erf_(float x){float s=sign(x);x=abs(x);float t=1./(1.+.3275911*x);
  return s*(1.-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*exp(-x*x));}
// интеграл гауссианы по площади пикселя (а не значение в центре) — звезда не мерцает при движении
float boxG(float x,float k){return .5*(erf_((x+.5)*k)-erf_((x-.5)*k));}
vec3 gEx,gEy;float gG11,gG12,gG22,gDet,gAng,gSig,gPkMin,gBoost;
void pixelBasis(vec3 ex,vec3 ey){
  gEx=ex;gEy=ey;gG11=dot(ex,ex);gG12=dot(ex,ey);gG22=dot(ey,ey);gDet=max(gG11*gG22-gG12*gG12,1e-30);
  gAng=sqrt(max(gG11,gG22));
  gSig=max(mix(1.05,.5,uSharp)*uStarS*uPx,mix(.62,.42,uSharp));  // сигма ядра в пикселях сцены
  gPkMin=.0012/max(uExp,1e-3);
  // точечные источники ярче при увеличении (как на длиннофокусном снимке), мягко
  gBoost=pow(clamp(uAng0/(gAng/uPx),.05,400.),.85);
}
vec3 bvCol(float bv){
  vec3 c=bv<.6?mix(vec3(.78,.86,1.),vec3(1.,.97,.92),smoothstep(-.3,.6,bv)):mix(vec3(1.,.97,.92),vec3(1.,.78,.58),smoothstep(.6,1.9,bv));
  return mix(vec3(luma(c)),c,.8)/max(luma(c),.01);
}
float magFlux(float m){return .3*pow(10.,-.4*.8*(m-6.));}
// вклад одной звезды: A — поток, dv — (направление звезды - направление пикселя) в той же системе
float starPix(vec3 dv,float A,float rcap){
  vec2 r=vec2(dot(dv,gEx),dot(dv,gEy)),o=vec2(gG22*r.x-gG12*r.y,gG11*r.y-gG12*r.x)/gDet; // смещение в пикселях
  A=A*gBoost;A=A/sqrt(1.+A/40.);                          // мягкое насыщение ярких
  float sg=gSig*(1.+.16*log2(1.+A));                       // яркие немного крупнее
  float k=.70710678/sg,r2=dot(o,o);
  float pk=A*boxG(0.,k)*boxG(0.,k);
  if(pk<gPkMin*.25)return 0.;
  float rm=min(sg*(3.5+2.5*log2(1.+A)),rcap);
  if(r2>rm*rm)return 0.;
  float g=boxG(o.x,k)*boxG(o.y,k);
  float gm=sg*2.,m=.4775/(gm*gm)*pow(1.+r2/(gm*gm),-2.5); // крылья Мофата (β=2.5, нормированы)
  float v=A*(.9*g+.1*m)*(1.-smoothstep(rm*.5,rm,sqrt(r2)));
  return v*smoothstep(gPkMin*.25,gPkMin*1.5,pk);          // плавное появление слабых
}
vec3 sph(vec2 lb){float c=cos(lb.y);return vec3(c*cos(lb.x),c*sin(lb.x),sin(lb.y));}
// Каталог HYG: ячейки 1°x1°, по 16 ярчайших звёзд, в каждой ячейке звёзды отсортированы по яркости
vec3 hyg(sampler2D tex,vec3 v){
  vec2 cp=vec2(atan(v.y,v.x),asin(clamp(v.z,-1.,1.)))/D2R+vec2(180.,90.);
  vec2 ci=floor(cp),cf=cp-ci,nb=vec2(cf.x<.5?-1.:1.,cf.y<.5?-1.:1.);
  float rcap=.35*D2R/gAng;vec3 acc=vec3(0.);
  for(int n=0;n<4;n++){
    vec2 cc=ci+vec2(n==1||n==3?nb.x:0.,n>=2?nb.y:0.);
    if(cc.y<0.||cc.y>179.)continue;
    cc.x=mod(cc.x+360.,360.);
    for(int k=0;k<16;k++){
      vec4 t=texture2D(tex,vec2((cc.x*16.+float(k)+.5)/5760.,(cc.y+.5)/180.));
      if(t.b>.998)break;
      float A=magFlux(t.b*12.75-1.5)*uStarB;
      if(A*gBoost<gPkMin*.3)break;                          // дальше только слабее
      vec3 sv=sph((cc+(t.rg*255.+.5)/256.)*D2R-vec2(PI,PI*.5));
      float c=starPix(sv-v,A,rcap);
      if(c>0.)acc+=bvCol(t.a*3.-.5)*c;
    }
  }
  return acc;
}
// Процедурный слой слабых звёзд: ячейки cd градусов, 0–1 звезда в ячейке, мягкий порог плотности
vec3 procLayer(vec3 v,float cd,float m0,float m1,float p0,float dens,float seed){
  float cpx=cd*D2R/gAng;                                  // размер ячейки в пикселях
  float fa=smoothstep(4.,9.,cpx);if(fa<=0.)return vec3(0.);
  vec2 cp=(vec2(atan(v.y,v.x),asin(clamp(v.z,-1.,1.)))/D2R+vec2(180.,90.))/cd;
  vec2 ci=floor(cp),cf=cp-ci,nb=vec2(cf.x<.5?-1.:1.,cf.y<.5?-1.:1.);
  float N=floor(360./cd+.5),rcap=cpx*.5;vec3 acc=vec3(0.);
  for(int n=0;n<4;n++){
    vec2 cc=ci+vec2(n==1||n==3?nb.x:0.,n>=2?nb.y:0.);
    cc.x=mod(cc.x+N,N);
    vec4 h=h42(cc+seed);
    vec2 lb=(cc+h.yz)*cd-vec2(180.,90.);
    float p=p0*dens*cos(lb.y*D2R);
    float w=clamp((p-h.x)/.08+.5,0.,1.)*fa;
    if(w<=0.)continue;
    float m=mix(m0,m1,pow(h.w,.45));
    float c=starPix(sph(lb*D2R)-v,magFlux(m)*uStarF*uStarB,rcap);
    if(c>0.)acc+=bvCol(fract(h.x*17.3+h.w*5.1)*1.9-.2)*c*w;
  }
  return acc;
}
vec3 stars(vec3 v,float wp){
  vec3 s=vec3(0.);
  float dens=clamp(.18+2.6*sqrt(gYlo/.08),.12,4.)*uStarD;
  if(wp<1.){vec3 a=hyg(uCell0,v);
    a+=procLayer(v,.8,10.,12.5,.55,dens,1.)+procLayer(v,.3,12.,15.,.5,dens,2.)+procLayer(v,.12,14.,17.,.45,dens,3.)
      +procLayer(v,.04,16.,19.,.4,dens,4.)+procLayer(v,.015,18.,20.5,.35,dens,5.);
    s+=a*(1.-wp);}
  if(wp>0.){vec3 u=v.yzx,a=hyg(uCell1,u);                // повёрнутая система у полюсов
    vec3 e1=gEx,e2=gEy;gEx=gEx.yzx;gEy=gEy.yzx;
    a=hyg(uCell1,u)+procLayer(u,.8,10.,12.5,.55,dens,11.)+procLayer(u,.3,12.,15.,.5,dens,12.)+procLayer(u,.12,14.,17.,.45,dens,13.)
      +procLayer(u,.04,16.,19.,.4,dens,14.)+procLayer(u,.015,18.,20.5,.35,dens,15.);
    gEx=e1;gEy=e2;s+=a*wp;}
  return s;
}

// ---------- итог ----------
vec3 skyColor(vec3 d,vec3 ex,vec3 ey){
  pixelBasis(ex,ey);gYlo=0.;
  vec3 c=vec3(0.);
  if(uShowMW>.5)c+=band(d,gAng);
  else{vec3 q=uBandRot*d;gYlo=luma(mapTex(uMap2,vec2(.5-atan(q.y,q.x)/(2.*PI),.5-asin(clamp(q.z,-1.,1.))/PI),uMapW.z));}
  // неровное слабое свечение фона
  c+=(.0012+.006*uHaze)*(.55+.9*fbm3(d*2.2))*vec3(.8,.87,1.)+uHaze*.003*vec3(.9,.85,.75)*fbm3(d*.9+4.);
  vec3 ob=vec3(0.);gAbs=0.;
  if(uShowObj>.5)ob=objects(d);
  if(uShowSt>.5){float wp=smoothstep(.7,.84,abs(d.z));c+=stars(d,wp);}
  return c*(1.-gAbs)+ob;
}
void svInterlace(){if(uIL>0.&&abs(mod(floor(gl_FragCoord.y),2.)-(uIL-1.))>.5)discard;}
// тон-маппинг с мягким плечом, гамма и дизеринг против полос
vec3 svFinish(vec3 c){
  c=max(c*uExp,0.);
  c=1.-exp(-c*(1.+c*.08));
  c=pow(c,vec3(1./2.2));
  float n=h12(gl_FragCoord.xy+fract(uExp*13.))+h12(gl_FragCoord.yx*1.37)-1.;
  return c+n/255.;
}
`;

  // Значения по умолчанию для параметров неба (виз-ции переопределяют)
  const P0 = {
    showMW: true, showStars: true, showObj: true, band: 1, bandW: 1, bandS: 1, bandRot: 0, bandTilt: 0, core: 1.6, dust: 1.35,
    detail: 0.7, warm: 0.55, ha: 0.35, nebA: 1, galA: 1, nebB: 1, starB: 1, starD: 1, starF: 1, starSize: 1, sharp: 0.7, haze: 0.3, exposure: 1,
  };

  // Загрузка ресурсов (один раз на контекст): мипы карты с паддингом по долготе, ячейки звёзд двух систем
  function init(gl) {
    if (gl._svSky) return gl._svSky;
    gl._svSky = (async () => {
      const D = SV.data || {};
      if (!D.starmap || !D.hyg) throw new Error('Нет данных неба (lib/data/*.js)');
      const mips = [], ws = [];
      for (const src of D.starmap.mips) {
        const im = await G.image(src), w = im.width, h = im.height;
        const cv = document.createElement('canvas'); cv.width = w + 2; cv.height = h;
        const x = cv.getContext('2d');
        x.drawImage(im, 1, 0);
        x.drawImage(im, w - 1, 0, 1, h, 0, 0, 1, h);        // паддинг: шов у антицентра без артефактов
        x.drawImage(im, 0, 0, 1, h, w + 1, 0, 1, h);
        mips.push(G.texture(gl, { src: cv })); ws.push(w);
      }
      const cells = buildCells(D.hyg);
      return {
        mips, ws, cell0: G.texture(gl, { w: 5760, h: 180, data: cells[0], filter: 'nearest' }),
        cell1: G.texture(gl, { w: 5760, h: 180, data: cells[1], filter: 'nearest' }), obj: packObjects(),
      };
    })();
    return gl._svSky;
  }

  // Раскладка каталога по ячейкам 1°x1°: R,G — положение в ячейке, B — звёздная величина, A — B-V.
  // Система 1 — галактическая; система 2 — повёрнутая (x'=y, y'=z, z'=x), чтобы у полюсов ячейки не вырождались.
  function buildCells(H) {
    const bin = atob(H.b64), n = H.n, out = [];
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    for (let f = 0; f < 2; f++) {
      const tex = new Uint8Array(5760 * 180 * 4), cnt = new Uint8Array(360 * 180);
      for (let i = 3; i < tex.length; i += 4) tex[i - 1] = 255;  // пустые слоты: B=255
      for (let i = 0; i < n; i++) {
        const o = i * 6, l = ((bytes[o] | (bytes[o + 1] << 8)) / 65536) * 2 * Math.PI, b = ((bytes[o + 2] | (bytes[o + 3] << 8)) / 65535 - 0.5) * Math.PI;
        let x = Math.cos(b) * Math.cos(l), y = Math.cos(b) * Math.sin(l), z = Math.sin(b);
        if (f) { const t = x; x = y; y = z; z = t; }
        const lon = (Math.atan2(y, x) / D2R + 180) % 360, lat = Math.asin(Math.max(-1, Math.min(1, z))) / D2R + 90;
        const ci = Math.min(359, Math.floor(lon)), cj = Math.min(179, Math.floor(lat)), c = cj * 360 + ci;
        if (cnt[c] >= 16) continue;
        const p = (cj * 5760 + ci * 16 + cnt[c]++) * 4;
        tex[p] = Math.min(255, Math.floor((lon - ci) * 256)); tex[p + 1] = Math.min(255, Math.floor((lat - cj) * 256));
        tex[p + 2] = bytes[o + 4]; tex[p + 3] = bytes[o + 5];
      }
      out.push(tex);
    }
    return out;
  }

  // Установка uniform'ов неба. P — параметры (см. P0), f — кадр из Renderer (uPx), ang0 — эталонный угол CSS-пикселя
  function bind(prog, res, P, f) {
    P = Object.assign({}, P0, P);
    const on = (v) => (v ? 1 : 0);
    prog.tex('uMap0', 0, res.mips[0]).tex('uMap1', 1, res.mips[1]).tex('uMap2', 2, res.mips[2]).tex('uCell0', 3, res.cell0).tex('uCell1', 4, res.cell1);
    prog.set('uMapW', res.ws).set('uTexel0', (2 * Math.PI) / res.ws[0]);
    prog.m3('uBandRot', G.m3.mul(G.m3.rot(0, -P.bandTilt * D2R), G.m3.rot(2, -P.bandRot * D2R)));
    prog.set('uPx', f.uPx).set('uExp', P.exposure).set('uIL', f.interlace || 0).set('uAng0', 0.0011);
    prog.set('uBand', P.band).set('uBandW', Math.max(0.05, P.bandW)).set('uBandS', Math.max(0.05, P.bandS)).set('uCore', P.core)
      .set('uDust', P.dust).set('uDetail', P.detail).set('uWarm', P.warm).set('uHa', P.ha).set('uHaze', P.haze)
      .set('uNebA', P.nebA).set('uGalA', P.galA).set('uNebB', P.nebB).set('uStarB', P.starB).set('uStarD', P.starD)
      .set('uStarF', P.starF).set('uStarS', P.starSize).set('uSharp', P.sharp)
      .set('uShowMW', on(P.showMW)).set('uShowSt', on(P.showStars)).set('uShowObj', on(P.showObj));
    prog.v4a('uO0', res.obj.a).v4a('uO1', res.obj.b).v4a('uO2', res.obj.c).v4a('uO3', res.obj.d);
  }

  // экваториальные -> галактические (для таймлапса)
  SV.Sky = { GLSL, P0, init, bind, OBJECTS, EQ2GAL, eq2gal, radec };
})();
