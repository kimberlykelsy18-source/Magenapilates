import { useEffect, useRef, useState } from 'react';
import '../styles/intro.css';

interface IntroAnimationProps {
  onComplete: () => void;
}

const SEQ = [
  { word:'POWERHOUSE', fx:'slam',    bg:'#1A1614', color:'#F8F4EF',            size:'clamp(38px,9.5vw,112px)',  weight:'800', serif:false, italic:false, dur:1800, label:'Core Foundation' },
  { word:'breathe',    fx:'blur',    bg:'#1A1614', color:'#C4A07A',            size:'clamp(52px,13vw,148px)',   weight:'300', serif:true,  italic:true,  dur:1800, label:null },
  { word:'CONTROL',   fx:'drop',    bg:'#1A1614', color:'#F8F4EF',            size:'clamp(38px,9vw,108px)',    weight:'700', serif:false, italic:false, dur:1800, label:'Contrology Method' },
  { word:'align',     fx:'split',   bg:'#1A1614', color:'transparent', stroke:'#F8F4EF', size:'clamp(48px,12vw,142px)', weight:'800', serif:false, italic:false, dur:1800, label:null },
  { word:'FLOW',      fx:'skew',    bg:'#1A1614', color:'#C4A07A',            size:'clamp(68px,17vw,200px)',   weight:'900', serif:false, italic:false, dur:1600, label:null },
  { word:'PRECISION', fx:'type',    bg:'#1A1614', color:'#F8F4EF',            size:'clamp(24px,5.5vw,68px)',   weight:'200', serif:false, italic:false, dur:2000, label:'Every Movement Counts' },
  { word:'STRENGTH',  fx:'glitch',  bg:'#EDEAE4', color:'#1A1614',            size:'clamp(36px,8.5vw,102px)',  weight:'900', serif:false, italic:false, dur:1800, label:null },
  { word:'lengthen',  fx:'tall',    bg:'#1A1614', color:'#C4A07A',            size:'clamp(40px,9.5vw,112px)',  weight:'300', serif:true,  italic:true,  dur:1800, label:null },
  { word:'REFORM',    fx:'wipe',    bg:'#B08848', color:'#1A1614',            size:'clamp(46px,11vw,130px)',   weight:'900', serif:false, italic:false, dur:1600, label:null },
  { word:'CONTROLOGY',fx:'scramble',bg:'#1A1614', color:'#F8F4EF',            size:'clamp(26px,6.5vw,76px)',   weight:'400', serif:false, italic:false, dur:2000, label:'The Original Name for Pilates' },
  { word:'brand',     fx:'brand',   bg:'#1A1614', color:'#F8F4EF',            size:'clamp(56px,13vw,150px)',   weight:'400', serif:true,  italic:true,  dur:3500, label:null },
] as const;

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#@&%$!0123456789';

export function IntroAnimation({ onComplete }: IntroAnimationProps) {
  const introRef   = useRef<HTMLDivElement>(null);
  const wdRef      = useRef<HTMLDivElement>(null);
  const ibgRef     = useRef<HTMLDivElement>(null);
  const hCntRef    = useRef<HTMLDivElement>(null);
  const hLblRef    = useRef<HTMLDivElement>(null);
  const progRef    = useRef<HTMLDivElement>(null);
  const hTimeRef   = useRef<HTMLDivElement>(null);
  const bcanvasRef = useRef<HTMLCanvasElement>(null);
  const grainRef   = useRef<HTMLCanvasElement>(null);

  const doneRef    = useRef(false);
  const bgRafRef   = useRef<number | null>(null);
  const actxRef    = useRef<AudioContext | null>(null);
  const soundOnRef = useRef(false);
  const skipFnRef  = useRef<() => void>(() => {});

  const [soundLabel, setSoundLabel] = useState<'Enable sound' | 'Sound on' | 'Sound off'>('Enable sound');
  const [soundIcon, setSoundIcon]   = useState('🔇');

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const intro   = introRef.current!;
    const wd      = wdRef.current!;
    const ibg     = ibgRef.current!;
    const hCnt    = hCntRef.current!;
    const hLbl    = hLblRef.current!;
    const prog    = progRef.current!;
    const hTime   = hTimeRef.current!;
    const bc      = bcanvasRef.current!;
    const gc      = grainRef.current!;
    const bx      = bc.getContext('2d')!;
    const gx      = gc.getContext('2d')!;

    // ── Resize canvases ──
    const resizeC = () => { gc.width = innerWidth; gc.height = innerHeight; bc.width = innerWidth; bc.height = innerHeight; };
    resizeC();
    window.addEventListener('resize', resizeC);

    // ── Grain loop ──
    let lgT = 0;
    let grainRaf: number;
    const drawGrain = (ts: number) => {
      grainRaf = requestAnimationFrame(drawGrain);
      if (ts - lgT < 55) return; lgT = ts;
      const im = gx.createImageData(gc.width, gc.height);
      const d = im.data;
      for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255 | 0; d[i] = d[i+1] = d[i+2] = v; d[i+3] = 255; }
      gx.putImageData(im, 0, 0);
    };
    grainRaf = requestAnimationFrame(drawGrain);

    // ── Audio ──
    const ac = () => { if (!actxRef.current) actxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)(); return actxRef.current; };
    const noise = (vol: number, lo: number, hi: number, dur: number, t: number) => {
      const c = ac(), buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
      const s = c.createBufferSource(); s.buffer = buf;
      const f = c.createBiquadFilter(); f.type = 'bandpass';
      f.frequency.setValueAtTime(lo, t); f.frequency.linearRampToValueAtTime(hi, t + dur * 0.6); f.Q.value = 0.8;
      const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.03); g.gain.linearRampToValueAtTime(0, t + dur);
      s.connect(f); f.connect(g); g.connect(c.destination); s.start(t); s.stop(t + dur);
    };
    const tone = (freq: number, type: OscillatorType, vol: number, atk: number, dec: number, t: number) => {
      const c = ac(), o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + atk); g.gain.exponentialRampToValueAtTime(0.001, t + atk + dec);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + atk + dec + 0.05);
    };
    const snd = () => soundOnRef.current;
    const SND: Record<string, () => void> = {
      slam:     () => { if (!snd()) return; const t = ac().currentTime; noise(0.55, 60, 300, 0.35, t); tone(52, 'sine', 0.4, 0.01, 0.3, t); },
      blur:     () => { if (!snd()) return; const t = ac().currentTime; noise(0.3, 350, 1100, 0.9, t); },
      drop:     () => { if (!snd()) return; const t = ac().currentTime; [0,.06,.12,.18,.24,.30].forEach(d => noise(0.45, 1800, 4200, 0.04, t + d)); },
      split:    () => { if (!snd()) return; const t = ac().currentTime; [523,659,784].forEach((f,i) => tone(f, 'sine', 0.11, 0.01, 1.1, t + i * 0.1)); },
      skew:     () => { if (!snd()) return; const t = ac().currentTime; noise(0.4, 200, 3200, 0.65, t); tone(42, 'sine', 0.38, 0.02, 0.6, t); },
      type:     () => {},
      glitch:   () => { if (!snd()) return; const t = ac().currentTime; [0,.07,.14,.22].forEach(d => noise(0.3, 800, 3800, 0.05, t + d)); },
      tall:     () => { if (!snd()) return; const t = ac().currentTime; noise(0.28, 600, 2200, 0.5, t); tone(110, 'triangle', 0.18, 0.01, 0.4, t); },
      wipe:     () => { if (!snd()) return; const t = ac().currentTime; noise(0.42, 300, 4200, 0.6, t); },
      scramble: () => { if (!snd()) return; const t = ac().currentTime; for (let i = 0; i < 6; i++) noise(0.18, 1200, 4200, 0.08, t + i * 0.08); },
      brand:    () => { if (!snd()) return; const t = ac().currentTime; [130,196,261,392,523].forEach((f,i) => tone(f, 'sine', 0.17, 0.02, 1.9, t + i * 0.06)); noise(0.14, 400, 1100, 0.5, t); },
    };

    // ── Background canvas patterns ──
    const stopBg = () => { if (bgRafRef.current) { cancelAnimationFrame(bgRafRef.current); bgRafRef.current = null; } };
    let bgStart = 0;
    const runBg = (drawFn: (x: CanvasRenderingContext2D, w: number, h: number, t: number) => void) => {
      stopBg(); bgStart = performance.now();
      const loop = (ts: number) => { bgRafRef.current = requestAnimationFrame(loop); drawFn(bx, bc.width, bc.height, (ts - bgStart) / 1000); };
      loop(bgStart);
    };
    const BG: Array<(x: CanvasRenderingContext2D, w: number, h: number, t: number) => void> = [
      (x,w,h,t) => { x.clearRect(0,0,w,h); const cx=w/2,cy=h/2,n=20; for(let i=0;i<n;i++){const a=(i/n)*Math.PI*2+(t*.15);const spd=1+((i*7)%3)*.5;const r0=60,r1=r0+((t*spd*140)%(Math.min(w,h)*.55));x.beginPath();x.moveTo(cx+Math.cos(a)*r0,cy+Math.sin(a)*r0);x.lineTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);x.strokeStyle=`rgba(248,244,239,${.035+.02*Math.sin(t*1.5+i)})`;x.lineWidth=.8;x.stroke();}},
      (x,w,h,t) => { x.clearRect(0,0,w,h); const cx=w/2,cy=h/2,max=Math.min(w,h)*.55; for(let i=0;i<7;i++){const phase=(t*.22+i/7)%1;const r=phase*max;const a=(1-phase)*(1-phase)*.09;x.beginPath();x.arc(cx,cy,r,0,Math.PI*2);x.strokeStyle=`rgba(196,160,122,${a})`;x.lineWidth=1;x.stroke();}},
      (x,w,h,t) => { x.clearRect(0,0,w,h); const gap=48,r=1.2;const ox=(t*8)%gap; for(let xi=0;xi<w+gap;xi+=gap)for(let yi=0;yi<h+gap;yi+=gap){const dx=xi-ox-w/2,dy=yi-h/2;const d=Math.sqrt(dx*dx+dy*dy);const a=Math.max(0,.055-.00006*d+.018*Math.sin(t*.8+d*.012));x.beginPath();x.arc(xi-ox,yi,r,0,Math.PI*2);x.fillStyle=`rgba(248,244,239,${a})`;x.fill();}},
      (x,w,h,t) => { x.clearRect(0,0,w,h); const cy=h/2,n=14; for(let i=0;i<n;i++){const frac=(i/(n-1))-.5;const base=cy+frac*h*.8;const pull=Math.sin(t*.6)*frac*h*.3;const y=base-pull;const a=.06-.06*Math.abs(frac)+.02*Math.sin(t+i);x.beginPath();x.moveTo(0,y);x.lineTo(w,y);x.strokeStyle=`rgba(248,244,239,${Math.max(0,a)})`;x.lineWidth=.6;x.stroke();}},
      (x,w,h,t) => { x.clearRect(0,0,w,h); [{a:.06,f:.006,spd:.7,col:'196,160,122'},{a:.04,f:.009,spd:1.1,col:'248,244,239'},{a:.05,f:.004,spd:.5,col:'196,160,122'}].forEach(({a,f,spd,col})=>{x.beginPath();for(let xi=0;xi<=w;xi+=2){const yi=h/2+Math.sin(xi*f+t*spd)*h*a;xi===0?x.moveTo(xi,yi):x.lineTo(xi,yi);}x.strokeStyle=`rgba(${col},.06)`;x.lineWidth=1;x.stroke();});},
      (x,w,h,t) => { x.clearRect(0,0,w,h); const cx=w/2,cy=h/2;x.strokeStyle='rgba(248,244,239,.05)';x.lineWidth=.5;x.beginPath();x.moveTo(0,cy);x.lineTo(w,cy);x.stroke();x.beginPath();x.moveTo(cx,0);x.lineTo(cx,h);x.stroke();const R=Math.min(w,h)*.28,n=36;for(let i=0;i<n;i++){const a=(i/n)*Math.PI*2+t*.4;const len=i%6===0?16:8;x.beginPath();x.moveTo(cx+Math.cos(a)*R,cy+Math.sin(a)*R);x.lineTo(cx+Math.cos(a)*(R-len),cy+Math.sin(a)*(R-len));x.strokeStyle=`rgba(196,160,122,${i%6===0?.1:.05})`;x.lineWidth=.7;x.stroke();}const pr=(3+Math.sin(t*2)*.8);x.beginPath();x.arc(cx,cy,pr,0,Math.PI*2);x.fillStyle='rgba(196,160,122,.12)';x.fill();},
      (x,w,h,t) => { x.clearRect(0,0,w,h); [{x:.1,y:.15,w:.22,h:.7},{x:.45,y:.05,w:.12,h:.9},{x:.7,y:.2,w:.18,h:.6}].forEach((r,i)=>{const shift=Math.sin(t*.5+i*1.2)*0.04;x.fillStyle=`rgba(26,22,20,${.06+.02*Math.sin(t+i)})`;x.fillRect((r.x+shift)*w,r.y*h,r.w*w,r.h*h);});},
      (x,w,h,t) => { x.clearRect(0,0,w,h); const n=18,gap=w/n; for(let i=0;i<n;i++){const xi=gap*(i+.5);const phase=(t*.35+i/n)%1;const len=phase*h*.85;const a=(1-phase)*.07;x.beginPath();x.moveTo(xi,h);x.lineTo(xi,h-len);x.strokeStyle=`rgba(196,160,122,${a})`;x.lineWidth=.7;x.stroke();}},
      (x,w,h,t) => { x.clearRect(0,0,w,h); const stripe=90,speed=60;const off=(t*speed)%(stripe*2);for(let xi=-h;xi<w+h;xi+=stripe*2){x.beginPath();x.moveTo(xi+off,0);x.lineTo(xi+off+h,h);x.lineTo(xi+off+h+stripe,h);x.lineTo(xi+off+stripe,0);x.closePath();x.fillStyle='rgba(26,22,20,.07)';x.fill();}},
      (x,w,h,t) => { x.clearRect(0,0,w,h); const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#&'; for(let i=0;i<40;i++){const sx=((i*137.508)%1)*w;const sy=((i*97.3)%1)*h;const drift=Math.sin(t*.3+i)*.8;x.font=`${8+((i*13)%8)}px monospace`;x.fillStyle=`rgba(248,244,239,${.03+.02*Math.sin(t*.5+i)})`;x.fillText(chars[(i+Math.floor(t*.5+i*.3))%chars.length],sx,sy+drift);}},
      (x,w,h,t) => { x.clearRect(0,0,w,h); const cx=w/2,cy=h/2;[.18,.28,.38,.5,.64].forEach((frac,i)=>{const r=Math.min(w,h)*frac;const a=.04+.02*Math.sin(t*.3+i);x.beginPath();x.arc(cx,cy,r,0,Math.PI*2);x.strokeStyle=`rgba(196,160,122,${a})`;x.lineWidth=.6;x.stroke();});const arcR=Math.min(w,h)*.38;x.beginPath();x.arc(cx,cy,arcR,t*.2,t*.2+Math.PI*.6);x.strokeStyle='rgba(196,160,122,.12)';x.lineWidth=1.2;x.stroke();for(let i=0;i<12;i++){const a2=(i/12)*Math.PI*2+t*.15;const pr=Math.min(w,h)*(.44+.06*Math.sin(t*.4+i));const px=cx+Math.cos(a2)*pr,py=cy+Math.sin(a2)*pr;x.beginPath();x.arc(px,py,1.5,0,Math.PI*2);x.fillStyle=`rgba(196,160,122,${.12+.06*Math.sin(t+i)})`;x.fill();}},
    ];

    // ── Word styling ──
    const styleWd = (sc: typeof SEQ[number]) => {
      wd.style.cssText = [
        `font-size:${sc.size}`,
        `font-weight:${sc.weight}`,
        `font-family:${sc.serif ? "Georgia,'Times New Roman',serif" : 'inherit'}`,
        `font-style:${sc.italic ? 'italic' : 'normal'}`,
        `color:${sc.color}`,
        `-webkit-text-stroke:${'stroke' in sc && sc.stroke ? '2px ' + sc.stroke : '0'}`,
        `letter-spacing:${sc.fx === 'type' ? '.05em' : '.015em'}`,
        `line-height:1`,
      ].join(';');
    };

    // ── Effects ──
    const FX: Record<string, (sc: typeof SEQ[number]) => void> = {
      slam:  sc => { wd.innerHTML = `<span class="mp-fx-slam">${sc.word}</span>`; },
      blur:  sc => { wd.innerHTML = `<span class="mp-fx-blur">${sc.word}</span>`; },
      skew:  sc => { wd.innerHTML = `<span class="mp-fx-skew">${sc.word}</span>`; },
      wipe:  sc => { wd.innerHTML = `<span class="mp-fx-wipe">${sc.word}</span>`; },
      glitch:sc => { wd.innerHTML = `<span class="mp-fx-glitch">${sc.word}</span>`; },
      drop:  sc => {
        wd.innerHTML = sc.word.split('').map((c,i) => `<span class="mp-dl" style="transition-delay:${i*48}ms">${c}</span>`).join('');
        requestAnimationFrame(() => wd.querySelectorAll('.mp-dl').forEach(e => e.classList.add('mp-land')));
      },
      tall:  sc => {
        wd.innerHTML = sc.word.split('').map((c,i) => `<span class="mp-tl" style="transition-delay:${i*52}ms">${c}</span>`).join('');
        requestAnimationFrame(() => wd.querySelectorAll('.mp-tl').forEach(e => e.classList.add('mp-up')));
      },
      split: sc => {
        const base = [`font-size:${sc.size}`,`font-weight:${sc.weight}`,`color:transparent`,`letter-spacing:.015em`,`line-height:1`,`white-space:nowrap`].join(';');
        const stroke = 'stroke' in sc ? sc.stroke : '#F8F4EF';
        const vis  = [`font-size:${sc.size}`,`font-weight:${sc.weight}`,`color:${sc.color}`,`-webkit-text-stroke:2px ${stroke}`,`letter-spacing:.015em`,`line-height:1`,`white-space:nowrap`].join(';');
        wd.style.cssText = 'position:relative;text-align:center;line-height:1;';
        wd.innerHTML = `<div class="mp-sw" id="mp-sw"><div style="${base}">${sc.word}</div><div class="mp-sh mp-sh-t"><div class="mp-sh-ti" style="${vis}">${sc.word}</div></div><div class="mp-sh mp-sh-b"><div class="mp-sh-bi" style="${vis}">${sc.word}</div></div></div>`;
        requestAnimationFrame(() => document.getElementById('mp-sw')?.classList.add('mp-go'));
      },
      type: sc => {
        const text = sc.word, spd = Math.max(55, Math.floor((sc.dur * 0.7) / text.length));
        let i = 0;
        const cur = `<span class="mp-cur" style="color:#C4A07A">|</span>`;
        const iv = setInterval(() => {
          if (doneRef.current) { clearInterval(iv); return; }
          wd.innerHTML = text.substring(0, i) + cur;
          if (soundOnRef.current && i > 0) { const t = ac().currentTime; noise(0.12, 2200, 5000, 0.035, t); }
          i++; if (i > text.length) clearInterval(iv);
        }, spd);
      },
      scramble: sc => {
        const text = sc.word.toUpperCase(), dur = sc.dur * 0.72, t0 = Date.now();
        const iv = setInterval(() => {
          if (doneRef.current) { clearInterval(iv); return; }
          const p = (Date.now() - t0) / dur;
          if (p >= 1) { wd.textContent = text; clearInterval(iv); return; }
          wd.textContent = text.split('').map((c,i) => p > (i / text.length) * 0.72 + 0.28 ? c : CHARS[Math.random() * CHARS.length | 0]).join('');
        }, 42);
      },
      brand: _sc => {
        wd.style.cssText = 'position:relative;text-align:center;line-height:1;display:flex;flex-direction:column;align-items:center;';
        const mkLetters = (word: string, cls = '') => word.split('').map(c => `<span class="mp-bl${cls ? ' ' + cls : ''}"><span class="mp-bl-i">${c}</span></span>`).join('');
        wd.innerHTML = `<div class="mp-brand-main-row">${mkLetters('Magena')}</div><div class="mp-brand-rule" id="mp-brule"></div><div class="mp-brand-sub-row">${mkLetters('Pilates','mp-bl-sub')}</div>`;
        wd.querySelectorAll('.mp-brand-main-row .mp-bl').forEach((el, i) => setTimeout(() => el.classList.add('mp-show'), i * 80));
        setTimeout(() => { document.getElementById('mp-brule')?.classList.add('mp-expand'); }, 550);
        wd.querySelectorAll('.mp-brand-sub-row .mp-bl').forEach((el, i) => setTimeout(() => el.classList.add('mp-show'), 700 + i * 70));
      },
    };

    // ── Reveal transition ──
    const totalDur = SEQ.reduce((a, s) => a + s.dur, 0) + 200;
    const triggerReveal = () => {
      if (doneRef.current) return; doneRef.current = true;
      stopBg(); bx.clearRect(0, 0, bc.width, bc.height);
      wd.classList.add('mp-exit');
      setTimeout(() => { ibg.style.opacity = '0'; gc.style.opacity = '0'; }, 120);
      setTimeout(() => { intro.classList.add('mp-open'); }, 480);
      setTimeout(() => { intro.classList.add('mp-gone'); setTimeout(onComplete, 400); }, 1600);
    };

    const skip = () => {
      if (doneRef.current) return; doneRef.current = true;
      stopBg(); bx.clearRect(0, 0, bc.width, bc.height);
      wd.classList.add('mp-exit');
      ibg.style.transition = 'opacity 0.3s ease'; ibg.style.opacity = '0'; gc.style.opacity = '0';
      setTimeout(() => { intro.classList.add('mp-open'); }, 320);
      setTimeout(() => { intro.classList.add('mp-gone'); setTimeout(onComplete, 400); }, 1380);
    };
    skipFnRef.current = skip;

    // ── Scene runner ──
    const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
    const runScene = async (idx: number) => {
      if (doneRef.current) return;
      const sc = SEQ[idx];
      if (idx > 0) { wd.classList.add('mp-exit'); await wait(190); }
      ibg.style.background = sc.bg;
      runBg(BG[idx] || BG[0]);
      hCnt.textContent = `${String(idx + 1).padStart(2, '0')} / ${SEQ.length}`;
      hLbl.textContent = sc.label || ''; hLbl.style.opacity = sc.label ? '1' : '0';
      const elapsed = SEQ.slice(0, idx).reduce((a, s) => a + s.dur, 0);
      prog.style.transition = `width ${sc.dur}ms linear`;
      prog.style.width = ((elapsed + sc.dur) / totalDur * 100) + '%';
      if (sc.fx !== 'split' && sc.fx !== 'brand') styleWd(sc);
      SND[sc.fx]?.();
      FX[sc.fx]?.(sc);
      wd.classList.remove('mp-exit');
      setTimeout(() => { if (doneRef.current) return; idx + 1 < SEQ.length ? runScene(idx + 1) : triggerReveal(); }, sc.dur);
    };

    // ── Timer ──
    let startMs = Date.now();
    const tick = () => { if (doneRef.current) return; const s = (Date.now() - startMs) / 1000 | 0; hTime.textContent = '0' + (s / 60 | 0) + ':' + String(s % 60).padStart(2, '0'); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);

    setTimeout(() => runScene(0), 220);

    return () => {
      doneRef.current = true;
      stopBg();
      cancelAnimationFrame(grainRaf);
      window.removeEventListener('resize', resizeC);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const handleSkip = () => skipFnRef.current();

  const handleToggleSound = () => {
    soundOnRef.current = !soundOnRef.current;
    if (soundOnRef.current) {
      actxRef.current?.resume();
      setSoundIcon('🔊'); setSoundLabel('Sound on');
    } else {
      setSoundIcon('🔇'); setSoundLabel('Sound off');
    }
  };

  return (
    <>
      <div className="mp-intro" ref={introRef}>
        <div id="mp-ibg" ref={ibgRef} />
        <canvas id="mp-bcanvas" ref={bcanvasRef} />
        <canvas id="mp-grain"   ref={grainRef} />

        <div className="mp-ct" />
        <div className="mp-cb" />

        <div className="mp-hud-cnt" ref={hCntRef}>01 / 11</div>
        <div className="mp-hud-lbl" ref={hLblRef} />
        <div className="mp-hud-bl">Magena Pilates</div>
        <div className="mp-hud-br"  ref={hTimeRef}>00:00</div>
        <div className="mp-prog-track"><div id="mp-prog" ref={progRef} /></div>

        <div className="mp-brk mp-brk-tl" />
        <div className="mp-brk mp-brk-tr" />
        <div className="mp-brk mp-brk-bl" />
        <div className="mp-brk mp-brk-br" />

        <div className="mp-stage">
          <div id="mp-wd" ref={wdRef} />
        </div>
      </div>

      <button className="mp-skip-btn" onClick={handleSkip}>Skip <span>→</span></button>
      <button className="mp-snd-btn"  onClick={handleToggleSound}>
        <span>{soundIcon}</span>&nbsp;<span>{soundLabel}</span>
      </button>
    </>
  );
}
