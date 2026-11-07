import * as THREE from './vendor/three.module.js';
import { Music } from './music.js';
import { addChristmas, roofTex, valanceTex, floorTex as snowFloorTex } from './xmas.js';

const $ = id => document.getElementById(id);
const APP_ID = 'merry-go-round-chase-kr';
const OMEGA = 0.6;            // carousel speed (rad/s), shared by everyone through the wall clock
const NH = 12, HR = 4.8, FR = 7.6;
const NPC = 'npc';
const params = new URLSearchParams(location.search);
// rooms: the open plaza, or a private 4-digit friend code (?code=4821) that puts friends together
let CODE = (params.get('code') || '').replace(/\D/g, '').slice(0, 4);
if (CODE.length !== 4) CODE = '';
let ROOM = CODE ? `code-${CODE}` : (params.get('room') || 'plaza').slice(0, 32);
let isHost = false;   // I made this code
let seekHost = 0;     // seconds left to find my friend's horse after joining by code
const roomLabel = () => CODE ? `방 코드 ${CODE}` : ROOM === 'plaza' ? '광장' : `방 ${ROOM}`;
const newCode = () => String(1000 + Math.floor(Math.random() * 9000));
function inviteURL() {
  const u = new URL(location.href);
  u.search = CODE ? `?code=${CODE}` : ROOM === 'plaza' ? '' : `?room=${encodeURIComponent(ROOM)}`; u.hash = '';
  return u.href;
}
const wallT = () => (Date.now() / 1000) % 100000;

// ---------------------------------------------------------------- renderer
const canvas = $('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10142a);
scene.fog = new THREE.Fog(0x10142a, 24, 62);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.fov = w < h ? 68 : 55; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

scene.add(new THREE.HemisphereLight(0x8a7bb0, 0x2a1a20, 0.75));
const warm = new THREE.PointLight(0xffc06a, 1.6, 32, 1.6); warm.position.set(0, 6, 0); scene.add(warm);
const moon = new THREE.DirectionalLight(0xb8c4ff, 0.35); moon.position.set(-10, 20, 8); scene.add(moon);

function canvasTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  return t;
}
const floorTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#3a3040'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    g.fillStyle = (x + y) % 2 ? '#463a4d' : '#3d3244'; g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
  }
}, 18, 18);
const stripeTex = canvasTex(512, 64, (g, w, h) => {
  for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#f3e6c8' : '#c8352a'; g.fillRect(i * w / 16, 0, w / 16 + 1, h); }
});

const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshLambertMaterial({ map: (snowFloorTex.repeat.set(18, 18), snowFloorTex) }));
ground.rotation.x = -Math.PI / 2; scene.add(ground);

// ---------------------------------------------------------------- carousel
const spin = new THREE.Group(); scene.add(spin);
const gold = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: .7, roughness: .35, emissive: 0x3a2608 });
const cream = new THREE.MeshLambertMaterial({ color: 0xf3e6c8 });
const base = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.8, 0.5, 48), new THREE.MeshLambertMaterial({ color: 0x6b3a2a }));
base.position.y = 0.25; scene.add(base);
const deck = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.4, 0.12, 48), new THREE.MeshLambertMaterial({ color: 0x8a5a3a }));
deck.position.y = 0.56; spin.add(deck);
const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 5.2, 16),
  new THREE.MeshStandardMaterial({ color: 0xead9b0, metalness: .55, roughness: .3, emissive: 0x3a2a10 }));
pillar.position.y = 3.1; spin.add(pillar);
const valance = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.6, 0.8, 48, 1, true),
  new THREE.MeshLambertMaterial({ map: valanceTex, side: THREE.DoubleSide, transparent: true, alphaTest: 0.5 }));
valance.position.y = 5.45; spin.add(valance);
const roof = new THREE.Mesh(new THREE.ConeGeometry(7, 2.6, 48, 1, true), new THREE.MeshLambertMaterial({ map: roofTex, side: THREE.DoubleSide }));
roof.position.y = 7.2; spin.add(roof);
const finial = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), gold); finial.position.y = 8.6; spin.add(finial);

const bulbGeo = new THREE.SphereGeometry(0.09, 8, 6);
const bulbMatA = new THREE.MeshBasicMaterial({ color: 0xffd27a }), bulbMatB = new THREE.MeshBasicMaterial({ color: 0xffd27a });
const nB = 96, m4 = new THREE.Matrix4();
const bulbsA = new THREE.InstancedMesh(bulbGeo, bulbMatA, nB / 2), bulbsB = new THREE.InstancedMesh(bulbGeo, bulbMatB, nB / 2);
for (let i = 0; i < nB; i++) {
  const a = i / nB * Math.PI * 2, ring = i % 3;
  const r = [6.65, 6.65, 4.4][ring], y = [5.15, 5.85, 6.6][ring];
  m4.makeTranslation(r * Math.cos(a), y, r * Math.sin(a));
  (i % 2 ? bulbsB : bulbsA).setMatrixAt(i >> 1, m4);
}
spin.add(bulbsA, bulbsB);
const xmasTick = addChristmas(scene, spin, [bulbMatA, bulbMatB]);

const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
function makeHorse(color) {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color }), mane = new THREE.MeshLambertMaterial({ color: 0x5a3a24 });
  g.add(box(1.4, 0.5, 0.42, m));
  const neck = box(0.3, 0.7, 0.3, m); neck.position.set(0.6, 0.4, 0); neck.rotation.z = -0.5; g.add(neck);
  const head = box(0.5, 0.26, 0.26, m); head.position.set(0.9, 0.72, 0); head.rotation.z = -0.3; g.add(head);
  const mn = box(0.12, 0.6, 0.12, mane); mn.position.set(0.5, 0.5, 0); mn.rotation.z = -0.5; g.add(mn);
  const tail = box(0.1, 0.5, 0.1, mane); tail.position.set(-0.78, -0.05, 0); tail.rotation.z = 0.6; g.add(tail);
  const saddle = box(0.45, 0.08, 0.46, new THREE.MeshLambertMaterial({ color: 0xc8352a })); saddle.position.y = 0.28; g.add(saddle);
  for (const [x, z, rz] of [[0.5, .13, -.6], [0.5, -.13, .4], [-0.5, .13, .5], [-0.5, -.13, -.3]]) {
    const leg = box(0.12, 0.6, 0.12, m); leg.position.set(x, -0.45, z); leg.rotation.z = rz; g.add(leg);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 5.2, 8), gold); pole.position.set(0.05, 0.6, 0); g.add(pole);
  return g;
}
const horses = [];
const horseColors = [0xf7f1e6, 0xe9d7b8, 0xf7f1e6, 0x5b4636, 0xf7f1e6, 0xd8c3a0];
for (let i = 0; i < NH; i++) {
  const a = i / NH * Math.PI * 2;
  const holder = new THREE.Group();
  holder.position.set(HR * Math.cos(a), 0, -HR * Math.sin(a));
  holder.rotation.y = a + Math.PI / 2;
  const h = makeHorse(horseColors[i % horseColors.length]);
  holder.add(h); spin.add(holder);
  horses.push({ h, phase: i * 1.3 });
}

// fence + park dressing
const rail = new THREE.Mesh(new THREE.TorusGeometry(FR, 0.06, 6, 96), gold); rail.rotation.x = Math.PI / 2; rail.position.y = 1.05; scene.add(rail);
const rail2 = rail.clone(); rail2.position.y = 0.35; scene.add(rail2);
const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 6), cream, 60);
for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2; m4.makeTranslation(FR * Math.cos(a), 0.55, FR * Math.sin(a)); posts.setMatrixAt(i, m4); }
scene.add(posts);
const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff0c8 }), poleMat = new THREE.MeshLambertMaterial({ color: 0x1d1a24 });
for (let i = 0; i < 6; i++) {
  const a = i / 6 * Math.PI * 2 + 0.3, r = 15;
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 4, 8), poleMat); p.position.set(r * Math.cos(a), 2, r * Math.sin(a)); scene.add(p);
  const l = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), lampMat); l.position.set(r * Math.cos(a), 4.1, r * Math.sin(a)); scene.add(l);
}
const starGeo = new THREE.BufferGeometry(), sp = [];
for (let i = 0; i < 400; i++) {
  const a = Math.random() * Math.PI * 2, e = 0.15 + Math.random() * 1.2, R = 90;
  sp.push(R * Math.cos(e) * Math.cos(a), R * Math.sin(e), R * Math.cos(e) * Math.sin(a));
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, fog: false })));

// ---------------------------------------------------------------- people
function makePerson(o) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: o.skin || 0xf0c8a8 });
  const coat = new THREE.MeshLambertMaterial({ color: o.coat });
  const pants = new THREE.MeshLambertMaterial({ color: o.pants || 0x22243a });
  const hair = new THREE.MeshLambertMaterial({ color: o.hair || 0x1a1210 });
  const shoeM = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const legs = [], arms = [];
  const upper = new THREE.Group(); upper.position.y = 0.9; g.add(upper);   // everything above the hips
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(0.15 * s, 0.9, 0);
    const leg = box(0.22, 0.9, 0.24, pants); leg.position.y = -0.45; hip.add(leg);
    const shoe = box(0.24, 0.12, 0.34, shoeM); shoe.position.set(0, -0.88, 0.06); hip.add(shoe);
    g.add(hip); legs.push(hip);
    const sh = new THREE.Group(); sh.position.set(0.4 * s, 0.72, 0);
    const arm = box(0.18, 0.7, 0.2, coat); arm.position.y = -0.33; sh.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), skin); hand.position.y = -0.72; sh.add(hand);
    upper.add(sh); arms.push(sh);
  }
  const torso = box(0.64, 0.82, 0.38, coat); torso.position.y = 0.4; upper.add(torso);
  if (o.long) { const hem = box(0.7, 0.4, 0.42, coat); hem.position.y = 0.82; g.add(hem); }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), skin); head.position.y = 1.08; upper.add(head);
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  hairM.position.y = 1.1; hairM.rotation.x = -0.25; upper.add(hairM);
  if (o.longHair) { const back = box(0.5, 0.6, 0.12, hair); back.position.set(0, 0.85, -0.2); upper.add(back); }
  const sm = new THREE.MeshLambertMaterial({ color: o.scarf || 0xf2ede6 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.08, 6, 12), sm); ring.rotation.x = Math.PI / 2; ring.position.y = 0.82; upper.add(ring);
  const scarf = new THREE.Group(); scarf.position.set(0.12, 0.8, -0.18);
  const tail = box(0.16, 0.06, 0.7, sm); tail.position.z = -0.35; scarf.add(tail); upper.add(scarf);
  return { g, upper, legs, arms, scarf };
}
const blobGeo = new THREE.CircleGeometry(0.55, 20);
const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .35 });

const COATS = [0x4a4038, 0x2f5a7a, 0x6b4a8a, 0x3a6a4a, 0x8a5a2a, 0x7a2a4a, 0x2a2a3a, 0x5a6a7a, 0xb0603a];
const SCARVES = [0xf2ede6, 0xffcf6b, 0x9ad0ff, 0xff9a9a, 0xc8f0b0];
function hash(s) { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }

const labels = $('labels');
const players = new Map();
function makeEntity(id, name, o = {}) {
  const hv = hash(id);
  const e = {
    id, name, role: 'chase', horse: -1, self: !!o.self, npc: !!o.npc,
    x: 0, z: 0, face: 0, tx: 0, tz: 0, tf: 0, vx: 0, vz: 0, spd: 0, walk: 0, wave: 0, rest: false, restK: 0, bubbleT: 0, fresh: true,
    wp: new THREE.Vector3(),
  };
  e.person = makePerson({
    coat: o.coat ?? COATS[hv % COATS.length], scarf: o.scarfColor ?? SCARVES[hv % SCARVES.length],
    longHair: o.longHair ?? hv % 3 === 0, long: o.long, pants: o.pants,
  });
  e.blob = new THREE.Mesh(blobGeo, blobMat); e.blob.rotation.x = -Math.PI / 2; e.blob.position.y = 0.02; scene.add(e.blob);
  e.tag = document.createElement('div'); e.tag.className = 'tag' + (e.self ? ' me' : '');
  e.bubble = document.createElement('div'); e.bubble.className = 'bubble'; e.bubble.hidden = true;
  labels.append(e.tag, e.bubble);
  scene.add(e.person.g);
  players.set(id, e);
  setName(e, name);
  return e;
}
function setName(e, name) { e.name = name; e.tag.textContent = e.self ? `${name} (나)` : name; }
function removeEntity(id) {
  const e = players.get(id); if (!e) return;
  e.person.g.parent?.remove(e.person.g); scene.remove(e.blob); e.tag.remove(); e.bubble.remove();
  players.delete(id);
}
function setRole(e, role, horse) {
  e.role = role; e.horse = role === 'ride' ? horse : -1;
  const p = e.person;
  e.tag.classList.toggle('rider', role === 'ride');
  if (role === 'ride' && horses[horse]) {
    horses[horse].h.add(p.g);
    p.g.rotation.set(0, Math.PI / 2, 0); p.g.position.set(-0.05, -0.62, 0); p.g.scale.setScalar(0.9);
    p.legs.forEach((l, i) => { l.rotation.set(-1.25, 0, (i ? -1 : 1) * 0.35); });
    p.scarf.rotation.x = 0.3;
    p.upper.rotation.set(0, 0, 0); p.upper.position.y = 0.9; e.rest = false; e.restK = 0;
    e.blob.visible = false;
  } else {
    e.role = 'chase';
    scene.add(p.g); p.g.scale.setScalar(1); p.g.rotation.set(0, e.face, 0);
    p.legs.forEach(l => l.rotation.set(0, 0, 0));
    p.arms.forEach(a => a.rotation.set(0, 0, 0));
    p.upper.rotation.set(0, 0, 0); p.upper.position.y = 0.9; e.restK = 0;
    e.blob.visible = true;
  }
}

// the house rider who is always there
const npc = makeEntity(NPC, '빨간 코트', { npc: true, coat: 0xe0412f, pants: 0x2a3a6a, longHair: true, long: true, scarfColor: 0xe0412f });
setRole(npc, 'ride', 0);

// me
let myName = '';
try { myName = localStorage.getItem('mgr-name') || ''; } catch (e) {}
$('nameIn').value = myName;
const me = makeEntity('self', myName || '나', { self: true });
{ const a = Math.random() * Math.PI * 2; me.x = 9.5 * Math.cos(a); me.z = 9.5 * Math.sin(a); }
setRole(me, 'chase');
me.person.g.visible = false; me.blob.visible = false; me.tag.hidden = true;
let joined = false;

// ---------------------------------------------------------------- network
let net = null;
const onlineEl = $('online');
function updateOnline() {
  if (!net) { onlineEl.textContent = navigator.onLine === false ? '오프라인 · 혼자 모드' : '연결 중…'; return; }
  // people who are actually in the park vs. people still on the entry screen (connected, not yet joined)
  const inPark = [...players.values()].filter(p => !p.self && !p.npc).length;
  const waiting = Math.max(0, net.peers.size - inPark);
  const playing = inPark + (joined ? 1 : 0);
  onlineEl.textContent = `${roomLabel()} · ${playing}명 플레이 중`
    + (waiting ? ` · ${waiting}명 입장 화면` : '')
    + (!inPark && !waiting ? ' (다른 사람을 찾는 중…)' : '');
}
function myState() {
  return { n: me.name, r: me.role, h: me.horse, x: +me.x.toFixed(2), z: +me.z.toFixed(2), f: +me.face.toFixed(2), w: me.wave > 0 ? 1 : 0, rs: me.rest ? 1 : 0, hc: isHost ? 1 : 0 };
}
async function connect() {
  try {
    const T = await import('./vendor/trystero.js');
    const room = T.joinRoom({
      appId: APP_ID,
      // mobile carriers often block direct peer links; a TURN relay carries the traffic then
      turnConfig: [{
        urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'],
        username: 'openrelayproject', credential: 'openrelayproject',
      }],
    }, ROOM, {
      onJoinError: d => { console.warn('peer join error', d); showToast('다른 사람과 직접 연결이 안 돼요 (네트워크 차단). 와이파이를 바꿔 보세요', 4); },
    });
    net = { room, selfId: T.selfId, peers: new Set(),
      st: room.makeAction('st'), sh: room.makeAction('sh'), rp: room.makeAction('rp'), ev: room.makeAction('ev') };
    net.st.onMessage = (d, { peerId }) => onState(peerId, d);
    net.sh.onMessage = (d, { peerId }) => onShout(peerId, d);
    net.rp.onMessage = (d, { peerId }) => onReply(peerId, d);
    net.ev.onMessage = d => { if (d && d.a && d.b) celebrate(String(d.a).slice(0, 10), String(d.b).slice(0, 10)); };
    room.onPeerJoin = id => { net.peers.add(id); if (joined) net.st.send(myState(), { target: id }); updateOnline(); };
    room.onPeerLeave = id => { net.peers.delete(id); removeEntity(id); updateOnline(); };
    window.__mgr = { net, players };
    updateOnline();
  } catch (err) {
    console.warn('멀티플레이 연결 실패, 혼자 모드로 진행', err);
    onlineEl.textContent = '혼자 모드 (연결 실패)';
  }
}
async function switchRoom(code) {
  CODE = code; ROOM = `code-${code}`;
  try { history.replaceState(null, '', `?code=${code}`); } catch (e) {}
  if (net) { try { net.room.leave(); } catch (e) {} }
  for (const id of [...players.keys()]) if (id !== 'self' && id !== NPC) removeEntity(id);
  net = null; updateOnline(); renderRoomInfo();
  await connect();
}
const send = (k, d) => { try { if (net && joined) net[k].send(d); } catch (e) {} };

function onState(pid, d) {
  if (typeof d !== 'object' || !d) return;
  let e = players.get(pid);
  const name = String(d.n || '손님').slice(0, 10);
  if (!e) e = makeEntity(pid, name);
  if (e.name !== name) setName(e, name);
  const role = d.r === 'ride' && d.h >= 1 && d.h < NH ? 'ride' : 'chase';
  if (role !== e.role || (role === 'ride' && d.h !== e.horse)) {
    if (role === 'chase') { e.x = e.tx = +d.x || 9; e.z = e.tz = +d.z || 0; }
    setRole(e, role, d.h);
  }
  e.tx = +d.x || 0; e.tz = +d.z || 0; e.tf = +d.f || 0; e.wave = d.w ? 1 : 0; e.rest = !!d.rs; e.host = !!d.hc;
  if (e.fresh) { e.x = e.tx; e.z = e.tz; e.face = e.tf; e.fresh = false; }
  updateOnline();
}
function entityByNetId(id) { return id === NPC ? npc : (net && id === net.selfId ? me : players.get(id)); }

function onShout(pid, d) {
  const e = players.get(pid); if (!e) return;
  bubble(e, String(d.text || '').slice(0, 40), 2.2);
  if (net && d.to === net.selfId && me.role === 'ride') {
    lastAsker = { id: pid, name: e.name };
    const a = $('asked'); a.textContent = `${e.name}님이 "너 나 좋아 싫어?!" 라고 물었어요`; a.classList.add('hot');
    clearTimeout(askT); askT = setTimeout(() => a.classList.remove('hot'), 6000);
  }
}
function onReply(pid, d) {
  const e = d.npc ? npc : players.get(pid); if (!e) return;
  bubble(e, String(d.text || '').slice(0, 40), 2.4, true);
  if (net && d.to === net.selfId && /좋아/.test(d.text) && !gotYes(e)) showBanner(`${e.name}: 좋아!`, '울타리 밖까지 들렸어요', 2.4);
}

// ---------------------------------------------------------------- UI
const banner = $('banner'), toast = $('toast');
let bannerT = 0, toastT = 0, lastAsker = null, askT = 0, loveT = 0;

// ---- love event: a chaser who gets YES_GOAL answers of "좋아" from the same rider announces it to everyone
const YES_GOAL = 10;
const yesCount = new Map(), pending = new Set();
function gotYes(rider) {
  const key = rider.npc ? NPC : rider.id;
  if (!pending.has(key)) return false;          // only an answer to my own shout counts, once per shout
  pending.delete(key);
  const n = (yesCount.get(key) || 0) + 1;
  if (n >= YES_GOAL) {
    yesCount.delete(key);
    celebrate(me.name, rider.name);
    send('ev', { a: me.name, b: rider.name });
    return true;
  }
  yesCount.set(key, n);
  showToast(`${rider.name}님의 확답 ${n} / ${YES_GOAL}`, 2);
  return false;
}
function celebrate(a, b) {
  showBanner('', '회전목마가 두 사람을 축하하고 있어요', 6);
  const nw = t => { const sp = document.createElement('span'); sp.style.whiteSpace = 'nowrap'; sp.textContent = t; return sp; };
  banner.prepend(nw(`${a}님과`), ' ', nw(`${b}님이`), ' ', nw('사랑에 빠지셨습니다'));
  toast.hidden = true; toastT = 0;
  banner.classList.add('love'); loveT = 6;
  const rain = $('hearts'); rain.textContent = '';
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (let i = 0; i < 36; i++) {
      const h = document.createElement('span'); h.textContent = '♥';
      h.style.left = Math.random() * 100 + '%';
      h.style.fontSize = 14 + Math.random() * 26 + 'px';
      h.style.animationDelay = Math.random() * 2.5 + 's';
      h.style.animationDuration = 3 + Math.random() * 2 + 's';
      rain.append(h);
    }
  }
  rain.hidden = false;
}
function showBanner(big, small, sec) {
  banner.textContent = big;
  if (small) { const s = document.createElement('small'); s.textContent = small; banner.append(s); }
  banner.classList.remove('love'); banner.hidden = false; bannerT = sec;
}
function showToast(t, sec = 2) { toast.textContent = t; toast.hidden = false; toastT = sec; }
function bubble(e, text, sec, reply) { e.bubble.textContent = text; e.bubble.classList.toggle('r', !!reply); e.bubble.hidden = false; e.bubbleT = sec; }

function renderRoomInfo() {
  $('roomInfo').textContent = CODE
    ? `들어갈 방: 방 코드 ${CODE}${isHost ? ' (내가 만든 방)' : ''}. 같은 코드로 들어온 사람끼리 만나요.`
    : '코드 없이 들어가면 모두가 모이는 광장으로 가요.';
  if (!lastAsker) $('asked').textContent = CODE
    ? `짝 코드 ${CODE} · 친구가 이 코드로 들어오면 바로 옆에서 시작해요`
    : '밖에서 누가 부르면 여기에 이름이 떠요';
}
$('codeIn').value = CODE;
renderRoomInfo();
async function copyInvite(prefix) {
  const url = inviteURL();
  try { await navigator.clipboard.writeText(url); showToast(`${prefix}링크를 복사했어요. 친구에게 보내 주세요`, 3); }
  catch (e) { showToast(`${prefix}${url}`, 5); }
}
$('newCode').addEventListener('click', () => {
  const c = newCode(); $('codeIn').value = c; isHost = true;
  switchRoom(c); copyInvite(`방 코드 ${c} · `);
});
$('codeIn').addEventListener('input', () => { const v = $('codeIn').value.replace(/\D/g, '').slice(0, 4); $('codeIn').value = v; });

function pickHorse() {
  const taken = new Set([0]);
  for (const p of players.values()) if (!p.self && p.role === 'ride') taken.add(p.horse);
  const free = []; for (let i = 1; i < NH; i++) if (!taken.has(i)) free.push(i);
  return free.length ? free[Math.floor(Math.random() * free.length)] : -1;
}
function becomeRider() {
  const h = pickHorse();
  if (h < 0) { showToast('빈 목마가 없어요. 잠시 뒤에 다시 시도해 주세요'); return false; }
  setRole(me, 'ride', h); refreshControls(); send('st', myState());
  showBanner('탑승!', '밖에서 부르면 대답해 주세요', 1.8);
  return true;
}
function becomeChaser() {
  if (me.role === 'ride') {
    me.person.g.getWorldPosition(me.wp);
    const a = Math.atan2(me.wp.z, me.wp.x); me.x = 9 * Math.cos(a); me.z = 9 * Math.sin(a);
  }
  setRole(me, 'chase'); refreshControls(); send('st', myState());
}
function refreshControls() {
  const ride = me.role === 'ride';
  $('chaseCtl').hidden = ride; $('rideCtl').hidden = !ride; $('meters').hidden = ride;
  $('switchRole').textContent = ride ? '내리기' : '회전목마 타기';
}

$('joinForm').addEventListener('submit', ev => {
  ev.preventDefault();
  const role = ev.submitter?.value || 'chase';
  let name = $('nameIn').value.trim().slice(0, 10);
  if (!name) name = '손님' + Math.floor(1000 + Math.random() * 9000);
  try { localStorage.setItem('mgr-name', name); } catch (e) {}
  setName(me, name);
  const code = $('codeIn').value.replace(/\D/g, '');
  if (code.length === 4 && code !== CODE) { isHost = false; switchRoom(code); }
  else if (code.length > 0 && code.length !== 4) { showToast('친구 코드는 숫자 4자리예요'); return; }
  if (code.length === 4 && !isHost && role === 'chase') seekHost = 10;
  joined = true;
  me.person.g.visible = true; me.tag.hidden = false; me.blob.visible = true;
  updateOnline();
  $('intro').hidden = true;
  if (role === 'ride' && becomeRider()) {} else { becomeChaser(); showBanner('달려!', '목마 위 이름을 보고 쫓아가세요', 1.8); }
  send('st', myState());
});
$('switchRole').addEventListener('click', () => { if (!joined) return; me.role === 'ride' ? becomeChaser() : becomeRider(); });
$('share').addEventListener('click', async () => {
  if (!CODE) {           // in the open plaza: make a private room for me and my friends first
    const c = newCode(); isHost = true; $('codeIn').value = c;
    await switchRoom(c);
    showBanner(`방 코드 ${c}`, '친구가 이 코드로 들어오면 같은 방에서 만나요', 3);
  }
  copyInvite(`방 코드 ${CODE} · `);
});
const musicBtn = $('music');
musicBtn.addEventListener('click', () => { const on = Music.toggle(); musicBtn.textContent = on ? '음악 끄기' : '음악 켜기'; });

// rider controls
document.querySelectorAll('.reply').forEach(b => b.addEventListener('click', () => {
  const say = b.dataset.say;
  const text = lastAsker ? `${lastAsker.name}, ${say}` : say;
  bubble(me, text, 2.4, true);
  send('rp', { text, to: lastAsker?.id });
}));
$('wave').addEventListener('click', () => { me.wave = 2.5; send('st', myState()); });

// chaser controls
const keys = {};
let joyX = 0, joyY = 0, sprintHeld = false;
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  keys[e.code] = true; if (e.code === 'Space') { e.preventDefault(); shout(); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
const joy = $('joy'), knob = $('knob');
let joyId = null;
function joyMove(e) {
  const r = joy.getBoundingClientRect(), R = r.width / 2;
  let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
  const d = Math.hypot(dx, dy), max = R - 10;
  if (d > max) { dx *= max / d; dy *= max / d; }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  joyX = dx / max; joyY = dy / max;
}
joy.addEventListener('pointerdown', e => { joyId = e.pointerId; joy.setPointerCapture(e.pointerId); joyMove(e); });
joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) joyMove(e); });
const joyEnd = e => { if (e.pointerId !== joyId) return; joyId = null; joyX = joyY = 0; knob.style.transform = ''; };
joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);
const runBtn = $('run');
runBtn.addEventListener('pointerdown', e => { sprintHeld = true; runBtn.classList.add('on'); runBtn.setPointerCapture(e.pointerId); });
const runEnd = () => { sprintHeld = false; runBtn.classList.remove('on'); };
runBtn.addEventListener('pointerup', runEnd); runBtn.addEventListener('pointercancel', runEnd);
$('rest').addEventListener('pointerdown', e => {
  e.preventDefault();
  if (!joined || me.role !== 'chase') return;
  me.rest = !me.rest; me.vx = me.vz = 0; send('st', myState());
});
// pointerdown, not click: a phone only fires click for a lone finger, so it never arrives while the other thumb is on the joystick
$('shout').addEventListener('pointerdown', e => { e.preventDefault(); shout(); });

const yesOf = key => yesCount.get(key) || 0;
function riderNear(px, pz) {
  const pr = Math.hypot(px, pz), ap = Math.atan2(pz, px);
  let best = null, bg = Math.max(0.28, 0.5 - yesOf(focusKey) * 0.022);  // "beside" gets narrower as you close in
  if (pr > 11.5) return null;
  for (const p of players.values()) {
    if (p.role !== 'ride' || p.self) continue;
    const g = Math.abs(wrap(Math.atan2(p.wp.z, p.wp.x) - ap));
    if (g < bg) { bg = g; best = p; }
  }
  return best;
}
let shoutCool = 0;
function shout() {
  if (!joined || me.role !== 'chase' || shoutCool > 0) return;
  shoutCool = 0.8;
  const near = riderNear(me.x, me.z);
  const running = (me.spd || 0) > 2;
  const t = near && running ? near : null;
  const text = t ? `${t.name} 너 나 좋아 싫어?!` : '너 나 좋아 싫어?!';
  bubble(me, text, 2.2);
  send('sh', { text, to: t ? (t.npc ? NPC : t.id) : null });
  if (t) { focusKey = t.npc ? NPC : t.id; pending.add(focusKey); }
  if (t && t.npc) {
    setTimeout(() => {
      const n = yesOf(NPC);
      const yes = Math.random() < 0.2 + n * 0.07;          // she warms up as confirmations pile up
      const pool = yes ? ['좋아!', '좋아, 따라와 봐!', '좋아… 아마도'] : ['몰라~', '싫어!', '한 바퀴만 더!', '뭐야 진짜~'];
      const text2 = `${me.name}, ${pool[Math.floor(Math.random() * pool.length)]}`;
      bubble(npc, text2, 2.2, true); send('rp', { text: text2, npc: 1 });
      if (yes) gotYes(npc); else pending.delete(NPC);
    }, 600);
  } else if (near && !running) {
    if (near.npc) { bubble(npc, '안 들려~ 같이 달려야지!', 1.8, true); send('rp', { text: '안 들려~ 같이 달려야지!', npc: 1 }); }
    showToast('멈춰 있으면 안 들려요. 옆에서 같이 달리며 외쳐 보세요', 2);
  } else if (!near) {
    showToast('목마 옆에 붙어서 외쳐야 이름이 붙어요', 1.6);
  }
}

// ---------------------------------------------------------------- loop
const clock = new THREE.Clock();
const camPos = new THREE.Vector3(18, 6, 6), camLook = new THREE.Vector3(), tmp = new THREE.Vector3(), fwd = new THREE.Vector3();
let stamina = 100, sendT = 0, conflictT = 0, focusKey = NPC;
const yesBar = document.querySelector('#heart > i'), yesLbl = $('yesLbl'), stamBar = document.querySelector('#stam > i'), hintEl = $('hint');
function wrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

function place(el, v, dy, maxD) {
  if (el.hidden) return;
  tmp.copy(v); tmp.y += dy;
  const d = tmp.distanceTo(camera.position);
  tmp.project(camera);
  if (tmp.z > 1 || d > maxD) { el.style.visibility = 'hidden'; return; }
  el.style.visibility = 'visible';
  el.style.transform = `translate(${(tmp.x * .5 + .5) * innerWidth}px,${(-tmp.y * .5 + .5) * innerHeight}px) translate(-50%,-100%)`;
}

function animateWalker(e, dt, speed) {
  const p = e.person;
  e.walk += speed * dt * 1.6;
  e.restK += ((e.rest && speed < 1 ? 1 : 0) - e.restK) * Math.min(1, dt * 6);
  const rk = e.restK, wk = 1 - rk;
  const k = Math.min(1, speed / 5), sw = Math.sin(e.walk) * k * 0.9;
  // panting: hands on knees, back heaving fast
  const pant = Math.sin(performance.now() / 1000 * 8.5 + e.walk);
  p.upper.rotation.x = rk * (0.62 + pant * 0.07);
  p.upper.position.y = 0.9 - rk * 0.1 + rk * pant * 0.02;
  p.legs[0].rotation.x = sw * wk - rk * 0.22; p.legs[1].rotation.x = -sw * wk + rk * 0.08;
  p.arms[0].rotation.x = -sw * wk - rk * 0.55; p.arms[1].rotation.x = sw * wk - rk * 0.55;
  p.arms[0].rotation.z = -rk * 0.12; p.arms[1].rotation.z = rk * 0.12;
  p.g.position.set(e.x, Math.abs(Math.cos(e.walk)) * k * 0.12 * wk, e.z);
  p.scarf.rotation.x = 0.2 + Math.min(1, speed / 8) * 1.1 + Math.sin(performance.now() / 70) * 0.08 * k + rk * 0.6;
  const df = wrap(e.face - p.g.rotation.y); p.g.rotation.y += df * Math.min(1, dt * 12);
  e.blob.position.set(e.x, 0.02, e.z);
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05), t = wallT();
  Music.update();
  xmasTick(dt);

  spin.rotation.y = (t * OMEGA) % (Math.PI * 2);
  horses.forEach(o => { o.h.position.y = 1.55 + Math.sin(t * 2.2 + o.phase) * 0.35; });
  const on = Math.floor(t / 0.35) % 2;
  const hi = loveT > 0 ? 0xff7ab0 : 0xffe2a0, lo = loveT > 0 ? 0x8a2050 : 0x8a6020;
  bulbMatA.color.setHex(on ? hi : lo); bulbMatB.color.setHex(on ? lo : hi);
  if (loveT > 0) { loveT -= dt; if (loveT <= 0) { $('hearts').hidden = true; banner.classList.remove('love'); } }

  // rider world positions
  for (const p of players.values()) if (p.role === 'ride') p.person.g.getWorldPosition(p.wp);

  // joined by a friend's code: start right outside their horse
  if (seekHost > 0 && joined && me.role === 'chase') {
    seekHost -= dt;
    let f = null;
    for (const p of players.values()) if (!p.self && !p.npc && p.role === 'ride' && (!f || p.host)) f = p;
    if (f && (f.wp.x || f.wp.z)) {
      const a = Math.atan2(f.wp.z, f.wp.x) + 0.18;
      me.x = 9 * Math.cos(a); me.z = 9 * Math.sin(a); me.vx = me.vz = 0;
      camPos.set(me.x * 1.9, 5.2, me.z * 1.9);
      seekHost = 0; showToast(`${f.name}님 바로 옆에서 시작해요. 같이 달리며 외쳐 보세요!`, 3);
    } else if (seekHost <= 0) showToast('친구가 아직 목마에 안 탔어요. 탑승하면 이름표를 따라가세요', 3);
  }

  // --- me as chaser
  if (joined && me.role === 'chase') {
    let ix = joyX, iy = joyY;
    if (keys.KeyA || keys.ArrowLeft) ix -= 1; if (keys.KeyD || keys.ArrowRight) ix += 1;
    if (keys.KeyW || keys.ArrowUp) iy -= 1; if (keys.KeyS || keys.ArrowDown) iy += 1;
    const mag = Math.min(1, Math.hypot(ix, iy));
    if (mag > 0.1 && me.rest) { me.rest = false; send('st', myState()); }
    const sprinting = (sprintHeld || keys.ShiftLeft || keys.ShiftRight) && stamina > 0 && mag > 0.1;
    const drain = 24 * (1 + yesOf(focusKey) * 0.06);
    stamina = sprinting ? Math.max(0, stamina - drain * dt) : Math.min(100, stamina + (me.rest ? 34 : 14) * dt);
    const speed = sprinting ? 10.5 : 6.2;
    camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    const rx = -fwd.z, rz = fwd.x;
    let mx = rx * ix - fwd.x * iy, mz = rz * ix - fwd.z * iy;
    const ml = Math.hypot(mx, mz) || 1; mx = mx / ml * mag * speed; mz = mz / ml * mag * speed;
    me.vx += (mx - me.vx) * Math.min(1, dt * 10); me.vz += (mz - me.vz) * Math.min(1, dt * 10);
    me.x += me.vx * dt; me.z += me.vz * dt;
    let pr = Math.hypot(me.x, me.z);
    const rMin = FR + 0.6, rMax = 27;
    if (pr < rMin) { me.x *= rMin / pr; me.z *= rMin / pr; pr = rMin; }
    if (pr > rMax) { me.x *= rMax / pr; me.z *= rMax / pr; pr = rMax; }
    const s = Math.hypot(me.vx, me.vz);
    if (s > 0.3) me.face = Math.atan2(me.vx, me.vz);
    me.spd = s;
    animateWalker(me, dt, s);

    const near = riderNear(me.x, me.z);
    hintEl.textContent = me.rest ? '숨 고르는 중… 움직이면 다시 달려요'
      : near && s > 2 ? `지금 ${near.name} 옆이에요. 외쳐 보세요!`
      : near ? '같이 달리면서 외쳐야 들려요'
      : stamina < 15 ? '숨이 차요… 쉬기를 눌러 체력을 채우세요' : '목마 위 이름표를 따라 달리세요';
    const fe = entityByNetId(focusKey) || npc, fn = yesOf(focusKey);
    yesLbl.textContent = `확답 ${fn}/${YES_GOAL}`; yesLbl.title = fe.name;
    yesBar.style.width = fn / YES_GOAL * 100 + '%'; stamBar.style.width = stamina + '%';

    // camera behind me, looking at the carousel
    const ox = me.x / pr, oz = me.z / pr;
    tmp.set(me.x + ox * 8.5, 5.2, me.z + oz * 8.5); camPos.lerp(tmp, Math.min(1, dt * 4));
    tmp.set(me.x * 0.55, 1.8, me.z * 0.55); camLook.lerp(tmp, Math.min(1, dt * 5));
  } else if (joined && me.role === 'ride') {
    hintEl.textContent = '';
    const r = Math.hypot(me.wp.x, me.wp.z) || 1;
    tmp.set(me.wp.x / r * 15.5, 4.2, me.wp.z / r * 15.5); camPos.lerp(tmp, Math.min(1, dt * 5));
    tmp.copy(me.wp); tmp.y = 2.4; camLook.lerp(tmp, Math.min(1, dt * 6));
  } else {
    // idle orbit behind the join screen
    const a = t * 0.12;
    camPos.set(Math.cos(a) * 17, 6, Math.sin(a) * 17); camLook.set(0, 2.5, 0);
  }
  camera.position.copy(camPos); camera.lookAt(camLook);

  // --- everyone else
  for (const p of players.values()) {
    if (p.self) continue;
    if (p.role === 'chase') {
      const ox = p.x, oz = p.z;
      p.x += (p.tx - p.x) * Math.min(1, dt * 8); p.z += (p.tz - p.z) * Math.min(1, dt * 8);
      const s = Math.hypot(p.x - ox, p.z - oz) / Math.max(dt, 1e-3);
      p.spd += (s - p.spd) * Math.min(1, dt * 6);
      p.face = p.tf;
      animateWalker(p, dt, p.spd);
    }
  }

  // rider arms (wave)
  for (const p of players.values()) {
    if (p.role !== 'ride') continue;
    const waving = p.npc ? (me.role === 'chase' && joined && riderNear(me.x, me.z) === npc) : p.wave > 0;
    const a = p.person.arms;
    // the right hand (arms[0]) is on the outside of the carousel, facing the people running round it
    a[1].rotation.set(-0.6, 0, -0.3);
    a[0].rotation.set(0, 0, waving ? -2.5 + Math.sin(t * 9) * 0.35 : -0.15);   // negative z lifts this arm out to the side
  }
  if (me.wave > 0) { me.wave -= dt; if (me.wave <= 0) send('st', myState()); }

  // labels & bubbles
  for (const p of players.values()) {
    const ride = p.role === 'ride';
    if (ride) tmp.copy(p.wp); else tmp.copy(p.person.g.position);
    const v = tmp.clone();
    if (!p.tag.hidden) place(p.tag, v, ride ? 2.2 : 2.55, ride ? 60 : 30);
    if (p.bubbleT > 0) {
      p.bubbleT -= dt; place(p.bubble, v, ride ? 2.95 : 3.25, 80);
      if (p.bubbleT <= 0) p.bubble.hidden = true;
    }
  }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) banner.hidden = true; }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) toast.hidden = true; }
  if (shoutCool > 0) shoutCool -= dt;

  // network: send my state, settle horse clashes
  conflictT -= dt;
  if (conflictT <= 0 && joined && me.role === 'ride' && net) {
    conflictT = 1;
    for (const p of players.values())
      if (!p.self && p.role === 'ride' && p.horse === me.horse && p.id < net.selfId) {
        const h = pickHorse(); if (h > 0) { setRole(me, 'ride', h); send('st', myState()); } else becomeChaser();
        break;
      }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
refreshControls();
$('chaseCtl').hidden = true; $('rideCtl').hidden = true; $('meters').hidden = true;
requestAnimationFrame(tick);
// a timer instead of the frame loop, so a phone that goes to the background still shows up for others
setInterval(() => { if (joined) send('st', myState()); }, 150);
connect();
