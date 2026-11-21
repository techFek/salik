import { Human } from "./human.esm.js";

const host = window.SalikDetector || { ready() {}, result(id, json) { console.log(id, json); }, failed(m) { console.warn(m); } };

const human = new Human({
  modelBasePath: "./models/",
  backend: "webgl",
  debug: false,
  cacheSensitivity: 0,
  filter: { enabled: false },
  face: {
    enabled: true,
    detector: { enabled: true, modelPath: "blazeface.json", maxDetected: 8, minConfidence: 0.3, rotation: false, return: false },
    mesh: { enabled: false }, iris: { enabled: false }, emotion: { enabled: false },
    description: { enabled: true, modelPath: "faceres.json", minConfidence: 0.1 },
    antispoof: { enabled: false }, liveness: { enabled: false }, attention: { enabled: false }
  },
  body: { enabled: false }, hand: { enabled: false }, object: { enabled: false },
  gesture: { enabled: false }, segmentation: { enabled: false }
});

/* nsfwjs MobileNetV2Mid (MIT, graph model) on Human's own TensorFlow.js: Drawing, Hentai, Neutral, Porn, Sexy. */
let nsfwModel = null;
async function loadNsfw() {
  if (!nsfwModel) nsfwModel = await human.tf.loadGraphModel("./models/nsfw.json");
  return nsfwModel;
}
async function classifyNsfw(img) {
  const model = await loadNsfw();
  const tf = human.tf;
  const out = tf.tidy(() => {
    const x = tf.reshape(tf.image.resizeBilinear(tf.div(tf.cast(tf.browser.fromPixels(img), "float32"), 255), [224, 224], true), [1, 224, 224, 3]);
    return model.predict(x);
  });
  const p = await out.data();
  out.dispose();
  const r = (v) => Number(v.toFixed(2));
  return { drawing: r(p[0]), hentai: r(p[1]), neutral: r(p[2]), porn: r(p[3]), sexy: r(p[4]) };
}

let busy = false;
window.salikDetect = async function (id, dataUrl, opts) {
  opts = opts || { faces: true };
  if (busy) { host.result(id, JSON.stringify({ busy: true })); return; }
  busy = true;
  try {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const t0 = performance.now();
    let faces = [];
    if (opts.faces) {
      const r = await human.detect(img);
      faces = (r.face || []).map((f) => ({
        gender: f.gender, genderScore: Number((f.genderScore || 0).toFixed(2)),
        score: Number((f.score || 0).toFixed(2)), box: (f.boxRaw || []).map((v) => Number(v.toFixed(3)))
      }));
    }
    const nsfw = opts.nsfw ? await classifyNsfw(img) : null;
    host.result(id, JSON.stringify({ faces, nsfw, ms: Math.round(performance.now() - t0) }));
  } catch (e) {
    host.result(id, JSON.stringify({ error: String(e && e.message || e) }));
  } finally {
    busy = false;
  }
};

(async () => {
  try {
    const want = new URLSearchParams(location.search);
    if (want.get("faces") !== "0") { await human.load(); await human.warmup(); }
    else await human.init();
    if (want.get("nsfw") === "1") await loadNsfw();
    host.ready(JSON.stringify({ backend: human.tf.getBackend() }));
  } catch (e) {
    host.failed(String(e && e.message || e));
  }
})();
