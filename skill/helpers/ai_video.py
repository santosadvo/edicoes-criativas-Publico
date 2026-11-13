"""Generate a short illustrative clip with Veo (Gemini API) — text or image to video.

PHASE 2 helper, the moving counterpart of ai_images.py: same key
(GEMINI_API_KEY in the skill's .env, billing enabled), same rules about what not
to ask for. Video is billed PER SECOND and costs many times an image, so this is
for the one or two windows where motion earns it — never a default.

The cheapest call is the default: the lite model, 4 seconds, 720p. A clip takes
minutes, not seconds; the helper waits and prints progress.

Usage:
    # animate an image that was already approved (the usual case)
    python helpers/ai_video.py "the banknotes burst outward, slow motion" \
        --image <edit>/remotion/public/ai/04-pulverizar.png \
        --out <edit>/remotion/public/ai/04-pulverizar.mp4

    # from text alone
    python helpers/ai_video.py "an empty bank vault, camera slowly pushing in" --out vault.mp4

    python helpers/ai_video.py --list-models
"""
from __future__ import annotations

import argparse
import base64
import mimetypes
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ai_images import API, api_key, call, load_env  # noqa: E402

DEFAULT_MODEL = "veo-3.1-lite-generate-preview"
# Motion-only direction: with --image the picture already carries the look.
DEFAULT_LOOK = "Cinematic, smooth natural motion, no text, no captions, no logos."


def video_models(key: str) -> list[str]:
    out, token = [], ""
    while True:
        page = call(f"{API}/models?pageSize=200" + (f"&pageToken={token}" if token else ""), key)
        for m in page.get("models", []):
            name = m.get("name", "").split("/", 1)[-1]
            if "predictLongRunning" in m.get("supportedGenerationMethods", []):
                out.append(name)
        token = page.get("nextPageToken", "")
        if not token:
            return sorted(out)


def start(prompt: str, key: str, model: str, image: Path | None, aspect: str,
          seconds: int, resolution: str) -> str:
    inst: dict = {"prompt": prompt}
    params = {"aspectRatio": aspect, "durationSeconds": seconds, "resolution": resolution}
    url = f"{API}/models/{model}:predictLongRunning"
    if not image:
        return call(url, key, {"instances": [inst], "parameters": params})["name"]
    mime = mimetypes.guess_type(image.name)[0] or "image/png"
    data = base64.b64encode(image.read_bytes()).decode()
    # The image field has had two spellings across API versions; try the current
    # one and fall back, rather than pin a shape that a preview model may drop.
    shapes = [{"bytesBase64Encoded": data, "mimeType": mime},
              {"inlineData": {"mimeType": mime, "data": data}}]
    last: RuntimeError | None = None
    for shape in shapes:
        try:
            return call(url, key, {"instances": [{**inst, "image": shape}], "parameters": params})["name"]
        except RuntimeError as e:
            if " 400" not in str(e):
                raise
            last = e
    raise last  # type: ignore[misc]


def wait(op: str, key: str, timeout: int) -> dict:
    t0 = time.time()
    while True:
        data = call(f"{API}/{op}", key)
        if data.get("done"):
            if data.get("error"):
                raise RuntimeError(f"geração falhou: {data['error'].get('message', data['error'])}")
            return data.get("response", {})
        if time.time() - t0 > timeout:
            raise RuntimeError(f"passou de {timeout}s sem terminar — operação {op}")
        print(f"  gerando… {int(time.time() - t0)}s", flush=True)
        time.sleep(10)


def video_uri(resp: dict) -> str:
    gen = resp.get("generateVideoResponse") or resp
    samples = gen.get("generatedSamples") or gen.get("generatedVideos") or []
    for s in samples:
        uri = (s.get("video") or {}).get("uri")
        if uri:
            return uri
    # filtered output comes back "done" with no sample — say why if the API did
    why = gen.get("raiMediaFilteredReasons") or gen.get("raiMediaFilteredCount")
    raise RuntimeError(f"nenhum vídeo na resposta ({why or 'motivo não informado'}) — reescreva o prompt")


def download(uri: str, key: str, dest: Path) -> None:
    req = urllib.request.Request(uri, headers={"x-goog-api-key": key})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            blob = r.read()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"download devolveu {e.code}") from e
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(blob)


def main() -> None:
    ap = argparse.ArgumentParser(description="Gera um clipe curto com o Veo.")
    ap.add_argument("prompt", nargs="?", help="o que acontece na cena (movimento, câmera)")
    ap.add_argument("--image", type=Path, help="imagem de partida (image-to-video)")
    ap.add_argument("--out", type=Path, help="arquivo .mp4 de saída")
    ap.add_argument("--aspect", default="16:9", choices=["16:9", "9:16"])
    ap.add_argument("--seconds", type=int, default=4, choices=[4, 6, 8])
    ap.add_argument("--resolution", default="720p", choices=["720p", "1080p"])
    ap.add_argument("--model", default=load_env("GEMINI_VIDEO_MODEL") or DEFAULT_MODEL)
    ap.add_argument("--look", default=DEFAULT_LOOK)
    ap.add_argument("--timeout", type=int, default=600)
    ap.add_argument("--list-models", action="store_true")
    args = ap.parse_args()

    key = api_key()
    if args.list_models:
        print("\n".join(video_models(key)) or "nenhum modelo de vídeo liberado para esta chave")
        return
    if not (args.prompt and args.out):
        ap.error("passe um prompt e --out")
    if args.image and not args.image.exists():
        sys.exit(f"imagem não encontrada: {args.image}")

    try:
        op = start(f"{args.prompt.strip()} {args.look}".strip(), key, args.model,
                   args.image, args.aspect, args.seconds, args.resolution)
        print(f"operação {op} ({args.model}, {args.seconds}s, {args.resolution})", flush=True)
        download(video_uri(wait(op, key, args.timeout)), key, args.out)
        print(f"ok   {args.out}")
    except RuntimeError as e:
        sys.exit(f"FALHOU: {e}")


if __name__ == "__main__":
    main()
