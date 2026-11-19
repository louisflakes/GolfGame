import { exampleHole } from "./core/examples";
import { decodeHole, encodeHole, extractShareCode, shareUrl } from "./core/shareCode";
import type { Hole } from "./core/types";
import { holeLength, parseHole, type Issue } from "./core/validate";
import { FlatHoleView } from "./render/flatHoleView";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const view = new FlatHoleView($("view"));
let currentCode = "";

function status(text: string): void {
  $("status").textContent = text;
}

function renderIssues(errors: Issue[], warnings: Issue[]): void {
  const list = $("issues");
  list.replaceChildren();
  const add = (cls: string, text: string) => {
    const li = document.createElement("li");
    li.className = cls;
    li.textContent = text;
    list.appendChild(li);
  };
  errors.forEach((e) => add("error", `${e.path}: ${e.message}`));
  warnings.forEach((w) => add("warn", `${w.path}: ${w.message}`));
  if (errors.length + warnings.length === 0) add("ok", "No problems found");
}

async function showHole(hole: Hole, warnings: Issue[]): Promise<void> {
  view.setHole(hole);
  $("hole-name").textContent = hole.meta.name;
  const yards = Math.round(holeLength(hole) * 1.0936);
  $("hole-sub").textContent = `Par ${hole.meta.par} · ${Math.round(holeLength(hole))} m (${yards} yd) · ${hole.tees.length} tees`;
  $("hole-desc").textContent = hole.meta.description ?? "";
  renderIssues([], warnings);

  currentCode = await encodeHole(hole);
  $<HTMLTextAreaElement>("code").value = currentCode;
  $("code-info").textContent = `${currentCode.length} characters`;
  history.replaceState(null, "", `#hole=${currentCode}`);
}

async function openCode(text: string): Promise<boolean> {
  const result = await decodeHole(text);
  if (!result.ok) {
    status(result.error);
    renderIssues(result.issues ?? [], []);
    return false;
  }
  await showHole(result.hole, result.warnings);
  status("Hole loaded from share code.");
  return true;
}

async function loadExample(): Promise<void> {
  const { hole, warnings } = parseHole(exampleHole());
  if (hole) await showHole(hole, warnings);
}

$("load-example").addEventListener("click", () => {
  void loadExample().then(() => status("Example hole loaded."));
});
$("open-code").addEventListener("click", () => {
  void openCode($<HTMLTextAreaElement>("paste").value);
});
$("copy-link").addEventListener("click", () => {
  const link = shareUrl(currentCode, location.href);
  navigator.clipboard.writeText(link).then(
    () => status("Link copied."),
    () => status("Couldn't copy. Select the code above instead."),
  );
});

async function start(): Promise<void> {
  const fromUrl = extractShareCode(location.hash);
  if (!(fromUrl && (await openCode(fromUrl)))) await loadExample();
  (window as unknown as { __ready: boolean }).__ready = true;
}

void start();
