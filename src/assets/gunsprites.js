const GUN_FILES = {
  pipe: {
    idle: "./sprites/guns/pipe-idle.png",
    swing0: "./sprites/guns/pipe-swing0.png",
    swing1: "./sprites/guns/pipe-swing1.png",
    swing2: "./sprites/guns/pipe-swing2.png",
  },
  pistol: {
    idle: "./sprites/guns/pistol-idle.png",
    fire: "./sprites/guns/pistol-fire.png",
  },
  shotgun: {
    idle: "./sprites/guns/shotgun-idle.png",
    fire: "./sprites/guns/shotgun-fire.png",
    reload0: "./sprites/guns/shotgun-reload0.png",
    reload1: "./sprites/guns/shotgun-reload1.png",
    reload2: "./sprites/guns/shotgun-reload2.png",
  },
  chaingun: {
    idle: "./sprites/guns/chaingun-idle.png",
    fire: "./sprites/guns/chaingun-fire.png",
  },
};

export function equippedViewId(view) {
  return view.weapon === "pipe" || view.swing > 0 ? "pipe" : view.weapon;
}

/** Which pose of the sheet to show for this weapon and combat state. */
export function pickGunPose(id, view) {
  if (id === "pipe") {
    if (!(view.swing > 0) || !(view.swingTime > 0)) return "idle";
    const t = 1 - view.swing / view.swingTime;
    if (t < 0.33) return "swing0";
    if (t < 0.66) return "swing1";
    return "swing2";
  }
  if (id === "shotgun") {
    if (view.reloading > 0 && view.reloadTime > 0) {
      const t = 1 - view.reloading / view.reloadTime;
      const i = Math.min(2, Math.floor(t * 3));
      return `reload${i}`;
    }
    if (view.cooldown > 0.25) return "fire";
    return "idle";
  }
  if (view.cooldown > 0) return "fire";
  return "idle";
}

export function spriteForView(sprites, view) {
  if (!sprites) return null;
  const id = equippedViewId(view);
  const pose = pickGunPose(id, view);
  const sheet = sprites[id];
  if (!sheet) return null;
  const sprite = sheet[pose] ?? sheet.idle;
  return sprite ? { id, sprite } : null;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`missing gun sprite ${src}`));
    img.src = src;
  });
}

function imageToRgba(img) {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);
  return { width, height, rgba: new Uint8ClampedArray(data) };
}

export async function loadGunSprites() {
  const sprites = {};
  const jobs = [];
  for (const [id, poses] of Object.entries(GUN_FILES)) {
    sprites[id] = {};
    for (const [pose, file] of Object.entries(poses)) {
      jobs.push(
        loadImage(file).then((img) => {
          sprites[id][pose] = imageToRgba(img);
        }),
      );
    }
  }
  await Promise.all(jobs);
  return sprites;
}
