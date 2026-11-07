// Christmas dressing for the carousel and the plaza: scalloped cream-and-gold canopy, garland with
// ornaments and bows, hanging globe lamps, a star on top, decorated trees, and falling snow.
import * as THREE from './vendor/three.module.js';

const GOLD = new THREE.MeshStandardMaterial({ color: 0xe0b354, metalness: .75, roughness: .3, emissive: 0x4a3008 });
const PINE = new THREE.MeshLambertMaterial({ color: 0x1f5a35 });
const PINE_DARK = new THREE.MeshLambertMaterial({ color: 0x174a2b });
const RED = new THREE.MeshLambertMaterial({ color: 0xc0202a, emissive: 0x300508 });
const SNOW = new THREE.MeshLambertMaterial({ color: 0xf4f6ff, emissive: 0x30333d });
const GLOW = new THREE.MeshBasicMaterial({ color: 0xfff1d0 });

function tex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// roof: cream panels alternating with deep red, gold seams
export const roofTex = tex(1024, 128, (g, w, h) => {
  const n = 16;
  for (let i = 0; i < n; i++) {
    g.fillStyle = i % 2 ? '#a3141f' : '#f5ead2'; g.fillRect(i * w / n, 0, w / n + 1, h);
    g.fillStyle = '#d9a845'; g.fillRect(i * w / n - 3, 0, 6, h);
  }
});
// valance: cream band with a gold scalloped bottom edge (transparent below the scallops)
export const valanceTex = tex(1024, 128, (g, w, h) => {
  const n = 24, sw = w / n;
  g.fillStyle = '#f5ead2'; g.fillRect(0, 0, w, h * 0.55);
  g.fillStyle = '#d9a845'; g.fillRect(0, h * 0.5, w, 8);
  for (let i = 0; i < n; i++) {
    g.beginPath(); g.ellipse(i * sw + sw / 2, h * 0.55, sw / 2, h * 0.4, 0, 0, Math.PI); g.fillStyle = '#f5ead2'; g.fill();
    g.lineWidth = 6; g.strokeStyle = '#d9a845'; g.stroke();
  }
  g.fillStyle = '#a3141f';
  for (let i = 0; i < n; i += 2) { g.beginPath(); g.arc(i * sw + sw / 2, h * 0.3, 9, 0, Math.PI * 2); g.fill(); }
});
// snowy plaza tiles
export const floorTex = tex(256, 256, (g, w, h) => {
  g.fillStyle = '#4c4a5e'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    g.fillStyle = (x + y) % 2 ? '#5b5970' : '#535166'; g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
  }
  for (let i = 0; i < 140; i++) {
    g.fillStyle = `rgba(240,244,255,${0.12 + Math.random() * 0.3})`;
    g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 0, Math.PI * 2); g.fill();
  }
});

function starShape(R, r) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R;
    i ? s.lineTo(Math.cos(a) * rad, Math.sin(a) * rad) : s.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  return s;
}
const starMat = new THREE.MeshStandardMaterial({ color: 0xffd76a, emissive: 0xffb020, emissiveIntensity: .9, metalness: .4, roughness: .3 });
function makeStar(R) {
  const geo = new THREE.ExtrudeGeometry(starShape(R, R * 0.45), { depth: R * 0.25, bevelEnabled: true, bevelSize: R * 0.06, bevelThickness: R * 0.06, bevelSegments: 1 });
  geo.center();
  return new THREE.Mesh(geo, starMat);
}

function makeBow() {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.06, 6, 10), RED);
    loop.position.x = s * 0.16; loop.scale.y = 0.7; g.add(loop);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.03), RED);
    tail.position.set(s * 0.08, -0.2, 0); tail.rotation.z = s * 0.35; g.add(tail);
  }
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), RED));
  return g;
}

function makeTree(h) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.6, 8), new THREE.MeshLambertMaterial({ color: 0x4a2e1c }));
  trunk.position.y = 0.3; g.add(trunk);
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const r = (1 - i / tiers) * h * 0.38 + 0.25, th = h * 0.36;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, th, 10), i % 2 ? PINE_DARK : PINE);
    cone.position.y = 0.6 + i * h * 0.2 + th / 2; g.add(cone);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, th * 0.35, 10), SNOW);
    cap.position.y = cone.position.y + th * 0.33; g.add(cap);
  }
  const star = makeStar(0.32); star.position.y = 0.6 + (tiers - 1) * h * 0.2 + h * 0.4; g.add(star);
  // fairy lights and baubles spiralling round
  const balls = [0xc0202a, 0xe0b354, 0x2f7ad6, 0xf4f6ff];
  for (let i = 0; i < 26; i++) {
    const f = i / 26, y = 0.9 + f * h * 0.75, r = (1 - f) * h * 0.36 + 0.12, a = f * Math.PI * 7;
    const m = i % 3 === 0 ? new THREE.MeshLambertMaterial({ color: balls[i % 4], emissive: balls[i % 4], emissiveIntensity: .25 }) : GLOW;
    const b = new THREE.Mesh(new THREE.SphereGeometry(i % 3 === 0 ? 0.11 : 0.06, 8, 6), m);
    b.position.set(Math.cos(a) * r, y, Math.sin(a) * r); g.add(b);
  }
  return g;
}

export function addChristmas(scene, spin, bulbMats) {
  // star on top of the carousel
  const topStar = makeStar(0.7); topStar.position.y = 9.25; spin.add(topStar);
  // snow resting on the roof
  const roofSnow = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.2, 32, 1, true), SNOW);
  roofSnow.position.y = 8.0; spin.add(roofSnow);

  // garland with ornaments and bows around the valance
  const garland = new THREE.Mesh(new THREE.TorusGeometry(6.72, 0.17, 6, 96), PINE);
  garland.rotation.x = Math.PI / 2; garland.position.y = 5.92; spin.add(garland);
  const ornGeo = new THREE.SphereGeometry(0.13, 10, 8);
  const ornMats = [RED, GOLD, new THREE.MeshLambertMaterial({ color: 0x2f7ad6, emissive: 0x081a33 })];
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * Math.PI * 2;
    const o = new THREE.Mesh(ornGeo, ornMats[i % 3]);
    o.position.set(Math.cos(a) * 6.82, 5.72 - (i % 2) * 0.12, Math.sin(a) * 6.82); spin.add(o);
  }
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, b = makeBow();
    b.position.set(Math.cos(a) * 6.95, 5.95, Math.sin(a) * 6.95);
    b.rotation.y = -a + Math.PI / 2; spin.add(b);
  }

  // hanging globe lamps under the canopy, like old carousels
  const globeGeo = new THREE.SphereGeometry(0.3, 16, 12), rodGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6);
  for (let i = 0; i < 12; i++) {
    const a = (i + 0.5) / 12 * Math.PI * 2, r = 6.1;
    const rod = new THREE.Mesh(rodGeo, GOLD); rod.position.set(Math.cos(a) * r, 4.8, Math.sin(a) * r); spin.add(rod);
    const gl = new THREE.Mesh(globeGeo, GLOW); gl.position.set(Math.cos(a) * r, 4.4, Math.sin(a) * r); spin.add(gl);
  }

  // extra rings of bulbs on the ceiling, sharing the chase-light materials
  const bulbGeo = new THREE.SphereGeometry(0.07, 6, 5), m4 = new THREE.Matrix4();
  const rings = [[5.6, 5.05, 64], [4.4, 5.05, 52], [3.2, 5.05, 40], [2.0, 5.05, 28]];
  const total = rings.reduce((s, r) => s + r[2], 0);
  const A = new THREE.InstancedMesh(bulbGeo, bulbMats[0], Math.ceil(total / 2)), B = new THREE.InstancedMesh(bulbGeo, bulbMats[1], Math.ceil(total / 2));
  let ia = 0, ib = 0;
  for (const [r, y, n] of rings) for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2; m4.makeTranslation(Math.cos(a) * r, y, Math.sin(a) * r);
    if (i % 2) B.setMatrixAt(ib++, m4); else A.setMatrixAt(ia++, m4);
  }
  A.count = ia; B.count = ib; spin.add(A, B);

  // wreaths on the centre pillar
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2;
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.12, 6, 16), PINE);
    w.position.set(Math.cos(a) * 1.15, 3.6, Math.sin(a) * 1.15); w.rotation.y = -a + Math.PI / 2; spin.add(w);
    const bw = makeBow(); bw.scale.setScalar(0.8); bw.position.set(Math.cos(a) * 1.25, 3.95, Math.sin(a) * 1.25); bw.rotation.y = -a + Math.PI / 2; spin.add(bw);
  }

  // decorated trees around the plaza
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + 0.82, r = 12.5 + (i % 2) * 6;
    const t = makeTree(3.2 + (i % 3) * 0.8); t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); scene.add(t);
  }
  // red bows on the fence posts
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, b = makeBow(); b.scale.setScalar(0.7);
    b.position.set(Math.cos(a) * 7.62, 1.1, Math.sin(a) * 7.62); b.rotation.y = -a + Math.PI / 2; scene.add(b);
  }

  // falling snow
  const N = 1400, pos = new Float32Array(N * 3), speed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - .5) * 60; pos[i * 3 + 1] = Math.random() * 22; pos[i * 3 + 2] = (Math.random() - .5) * 60;
    speed[i] = 0.8 + Math.random() * 1.2;
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const flake = tex(32, 32, (g) => {
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  });
  const snow = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.22, map: flake, transparent: true, depthWrite: false, color: 0xffffff }));
  scene.add(snow);

  let tt = 0;
  return function update(dt) {
    tt += dt;
    topStar.rotation.y = tt * 0.8;
    for (let i = 0; i < N; i++) {
      pos[i * 3 + 1] -= speed[i] * dt;
      pos[i * 3] += Math.sin(tt * 0.7 + i) * 0.25 * dt;
      if (pos[i * 3 + 1] < 0) pos[i * 3 + 1] = 22;
    }
    sg.attributes.position.needsUpdate = true;
  };
}
