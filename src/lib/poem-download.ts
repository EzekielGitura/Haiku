import { koreanEndearment, type Poem } from "./poem-rules";
import { CLOUD_PATHS, DAY_SKY_COLORS } from "./sky-art";

export const POEM_DOWNLOAD_MESSAGE = "here’s today’s haiku babygirl 🫠";

const WIDTH = 1080;
const HEIGHT = 1350;
const SERIF = '"Cormorant Garamond", Georgia, serif';
const SANS = '"DM Sans", sans-serif';
const KOREAN = '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
const INK = "#304962";
const SOFT_INK = "#485a72";
const BORDER = "#aecbe0";

async function prepareFonts(poem: Poem) {
  if (!document.fonts) return;
  // Use the page's fonts when available, with a bounded wait for offline saves.
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.allSettled([
        document.fonts.load(`400 84px ${SERIF}`, "For you, Silvia."),
        document.fonts.load(
          `500 54px ${SERIF}`,
          [poem.line_one, poem.line_two, poem.line_three].join(" "),
        ),
        document.fonts.load(`italic 400 26px ${SERIF}`, "my gentle surrender"),
        document.fonts.load(`400 24px ${SANS}`, POEM_DOWNLOAD_MESSAGE),
      ]),
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, 2500);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function drawCloud(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  opacity: number,
) {
  context.save();
  context.translate(x, y);
  context.scale(width / 600, width / 600);
  context.globalAlpha = opacity;
  const shade = context.createLinearGradient(300, 40, 300, 230);
  shade.addColorStop(0, DAY_SKY_COLORS.cloud);
  shade.addColorStop(1, `${DAY_SKY_COLORS.cloudShade}8f`);
  context.fillStyle = shade;
  context.fill(new Path2D(CLOUD_PATHS.cumulus));
  context.strokeStyle = DAY_SKY_COLORS.cloud;
  context.lineWidth = 12;
  context.lineCap = "round";
  context.globalAlpha = opacity * 0.45;
  context.stroke(new Path2D(CLOUD_PATHS.cumulusHighlights));
  context.restore();
}

function drawCirrus(context: CanvasRenderingContext2D, x: number, y: number, width: number) {
  context.save();
  context.translate(x, y);
  context.scale(width / 600, width / 600);
  context.strokeStyle = DAY_SKY_COLORS.cloud;
  context.lineCap = "round";
  CLOUD_PATHS.cirrus.forEach((path, index) => {
    context.lineWidth = [11, 6, 3][index]!;
    context.globalAlpha = [0.25, 0.19, 0.13][index]!;
    context.stroke(new Path2D(path));
  });
  context.restore();
}

function drawSky(context: CanvasRenderingContext2D) {
  const sky = context.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, DAY_SKY_COLORS.top);
  sky.addColorStop(0.49, DAY_SKY_COLORS.middle);
  sky.addColorStop(1, DAY_SKY_COLORS.horizon);
  context.fillStyle = sky;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  const sunlight = context.createRadialGradient(868, 325, 40, 868, 325, 160);
  sunlight.addColorStop(0, "#ffebb754");
  sunlight.addColorStop(1, "#ffebb700");
  context.fillStyle = sunlight;
  context.fillRect(708, 165, 320, 320);
  context.fillStyle = DAY_SKY_COLORS.sun;
  context.beginPath();
  context.arc(868, 325, 58, 0, Math.PI * 2);
  context.fill();

  drawCirrus(context, -100, 30, 650);
  drawCirrus(context, 540, 170, 650);
  drawCirrus(context, 80, 1000, 750);
  drawCloud(context, -230, 300, 610, 0.6);
  drawCloud(context, 800, 490, 580, 0.5);
  drawCloud(context, -130, 1010, 720, 0.7);
  drawCloud(context, 620, 1145, 680, 0.76);

  // Match the soft atmospheric wash layered over the website's daytime sky.
  const atmosphere = context.createLinearGradient(0, 0, 0, HEIGHT);
  atmosphere.addColorStop(0, "#faf4ee80");
  atmosphere.addColorStop(0.4, "#faf4ee57");
  atmosphere.addColorStop(1, "#faf4ee0a");
  context.fillStyle = atmosphere;
  context.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawHeart(context: CanvasRenderingContext2D, x: number, y: number, size = 25) {
  context.save();
  context.translate(x - size / 2, y - size / 2);
  context.scale(size / 24, size / 24);
  context.strokeStyle = SOFT_INK;
  context.lineWidth = 1;
  context.stroke(
    new Path2D(
      "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z",
    ),
  );
  context.restore();
}

function drawPaper(context: CanvasRenderingContext2D) {
  context.save();
  context.shadowColor = "#233e851a";
  context.shadowBlur = 65;
  context.shadowOffsetY = 22;
  context.fillStyle = "#fdfcf8ed";
  context.beginPath();
  context.roundRect(90, 440, 900, 570, 10);
  context.fill();
  context.restore();
  context.strokeStyle = "#ffffff";
  context.lineWidth = 1.5;
  context.stroke();

  context.strokeStyle = BORDER;
  context.lineWidth = 1;
  for (const [x, y, directionX, directionY] of [
    [115, 465, 1, 1],
    [965, 465, -1, 1],
    [115, 985, 1, -1],
    [965, 985, -1, -1],
  ]) {
    context.beginPath();
    context.moveTo(x! + directionX! * 35, y!);
    context.lineTo(x!, y!);
    context.lineTo(x!, y! + directionY! * 35);
    context.stroke();
  }
}

/** A self-contained, static PNG: no image service, animation, or remote image assets. */
export async function createPoemImage(poem: Poem, dateLabel: string): Promise<Blob> {
  await prepareFonts(poem);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image downloads are unavailable in this browser.");

  drawSky(context);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = SOFT_INK;
  context.font = `400 15px ${SANS}`;
  context.fillText("A LITTLE POEM, JUST FOR YOU", WIDTH / 2, 125);
  context.fillStyle = INK;
  context.font = `400 84px ${SERIF}`;
  context.fillText("For you, Silvia.", WIDTH / 2, 213);
  const endearment = koreanEndearment();
  context.font = `400 25px ${KOREAN}`;
  context.fillText(endearment.korean, WIDTH / 2, 294);
  context.fillStyle = SOFT_INK;
  context.font = `italic 400 26px ${SERIF}`;
  context.fillText(endearment.translation, WIDTH / 2, 336);

  drawPaper(context);
  context.fillStyle = SOFT_INK;
  context.font = `400 17px ${SANS}`;
  context.fillText(dateLabel.toUpperCase(), WIDTH / 2, 510);
  context.beginPath();
  context.moveTo(444, 560);
  context.lineTo(507, 560);
  context.moveTo(573, 560);
  context.lineTo(636, 560);
  context.strokeStyle = BORDER;
  context.stroke();
  drawHeart(context, WIDTH / 2, 560);

  const lines = [poem.line_one ?? "", poem.line_two ?? "", poem.line_three ?? ""];
  context.font = `500 54px ${SERIF}`;
  const longestLine = Math.max(...lines.map((line) => context.measureText(line).width));
  const fontSize = Math.min(54, (54 * 760) / (longestLine || 1));
  context.font = `500 ${fontSize}px ${SERIF}`;
  context.fillStyle = INK;
  lines.forEach((line, index) => context.fillText(line, WIDTH / 2, 660 + index * 83));
  context.fillStyle = SOFT_INK;
  context.font = `400 25px ${KOREAN}`;
  context.fillText("언제나 너를 사랑해", WIDTH / 2, 926);
  context.font = `400 12px ${SANS}`;
  context.fillText("5 · 7 · 5", 910, 970);

  drawHeart(context, WIDTH / 2, 1100, 22);
  context.fillStyle = INK;
  context.font = `400 24px ${SANS}`;
  context.fillText(POEM_DOWNLOAD_MESSAGE, WIDTH / 2, 1160);
  context.font = `italic 400 25px ${SERIF}`;
  context.fillStyle = SOFT_INK;
  context.fillText("Three little lines. An endless amount of love.", WIDTH / 2, 1206);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Your poem image could not be created. Please try again."));
    }, "image/png");
  });
}

export async function downloadPoem(poem: Poem, dateLabel: string): Promise<void> {
  const blob = await createPoemImage(poem, dateLabel);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `for-silvia-${poem.day || "welcome"}.png`;
  document.body.append(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    // Leave time for mobile browsers to finish handing the image to Downloads.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
