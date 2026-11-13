"""Generate illustrative images with Gemini for the split-screen inserts.

PHASE 2 helper — the AI alternative to pexels_search.py. Use it when the user
ticked "Imagens por IA" on the Estilo tab (`elements.imagesAI`): instead of
searching a stock site for something close to what is being said, you write a
prompt for exactly the image the line needs.

Needs GEMINI_API_KEY (env or .env at the edvid repo root). The key comes from
Google AI Studio (https://aistudio.google.com/apikey) — it is NOT the Gemini app
subscription: that one pays for the chat app, this one is billed per image on a
Google Cloud project. Image models usually need billing enabled on the project.

The split layouts show the art in a 1080x750 band, so the default aspect is 3:2
(the closest the API offers); the template cover-crops the rest.

Usage:
    # one image
    python helpers/ai_images.py "close-up of a phone showing a bank transfer alert" \
        --out <edit>/remotion/public/ai/alerta.png

    # several, one consistent look — plan.json is [{"name": "...", "prompt": "..."}]
    python helpers/ai_images.py --plan plan.json --out-dir <edit>/remotion/public/ai

    # which image models this key can call
    python helpers/ai_images.py --list-models

Prompts work best in English, describing a SCENE (subject, setting, light,
framing) rather than a concept. Never ask for readable text, logos or a real
person's likeness — see the track reference.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_MODEL = "gemini-2.5-flash-image"
ASPECTS = ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"]
# Appended to every prompt so a batch reads as one art direction, not N stock hits.
DEFAULT_LOOK = (
    "Cinematic photograph, dramatic low-key lighting, shallow depth of field, "
    "muted colour palette, realistic. No text, no captions, no logos, no watermarks."
)
EXT = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}


def load_env(name: str) -> str:
    for candidate in [Path(__file__).resolve().parent.parent / ".env", Path(".env")]:
        if candidate.exists():
            for line in candidate.read_text().splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                if k.strip() == name and v.strip():
                    return v.strip().strip('"').strip("'")
    return os.environ.get(name, "")


def api_key() -> str:
    key = load_env("GEMINI_API_KEY")
    if not key:
        sys.exit(
            "GEMINI_API_KEY não encontrada no .env da skill nem no ambiente.\n"
            "Crie uma em https://aistudio.google.com/apikey e grave em "
            f"{Path(__file__).resolve().parent.parent / '.env'} como GEMINI_API_KEY=...\n"
            "(A assinatura do app Gemini não vale como chave de API.)"
        )
    return key


def call(url: str, key: str, body: dict | None = None, timeout: int = 180) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"x-goog-api-key": key, "Content-Type": "application/json"},
        method="POST" if body is not None else "GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        try:
            detail = json.loads(detail)["error"]["message"]
        except (ValueError, KeyError, TypeError):
            detail = detail[:400]
        raise RuntimeError(f"Gemini devolveu {e.code}: {detail}") from e


def image_models(key: str) -> list[str]:
    """Models this key can call that produce images through generateContent."""
    out, token = [], ""
    while True:
        page = call(f"{API}/models?pageSize=200" + (f"&pageToken={token}" if token else ""), key)
        for m in page.get("models", []):
            name = m.get("name", "").split("/", 1)[-1]
            if "image" in name and "generateContent" in m.get("supportedGenerationMethods", []):
                out.append(name)
        token = page.get("nextPageToken", "")
        if not token:
            return sorted(out)


def generate(prompt: str, key: str, model: str, aspect: str, look: str) -> tuple[bytes, str]:
    body = {
        "contents": [{"parts": [{"text": f"{prompt.strip()} {look}".strip()}]}],
        "generationConfig": {
            "responseModalities": ["IMAGE"],
            "imageConfig": {"aspectRatio": aspect},
        },
    }
    data = call(f"{API}/models/{model}:generateContent", key, body)
    for cand in data.get("candidates", []):
        for part in (cand.get("content") or {}).get("parts", []):
            inline = part.get("inlineData") or part.get("inline_data")
            if inline and inline.get("data"):
                mime = inline.get("mimeType") or inline.get("mime_type") or "image/png"
                return base64.b64decode(inline["data"]), mime
    # No image came back: a safety block or a text-only answer. Say which.
    reason = (data.get("promptFeedback") or {}).get("blockReason") or next(
        (c.get("finishReason") for c in data.get("candidates", []) if c.get("finishReason")), "")
    raise RuntimeError(f"nenhuma imagem na resposta ({reason or 'motivo não informado'}) — reescreva o prompt")


def save(blob: bytes, mime: str, dest: Path) -> Path:
    # the API picks the format; keep the name the caller asked for, fix the suffix
    dest = dest.with_suffix(EXT.get(mime, ".png"))
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(blob)
    return dest


def main() -> None:
    ap = argparse.ArgumentParser(description="Gera imagens ilustrativas com o Gemini.")
    ap.add_argument("prompt", nargs="?", help="descrição da cena (uma imagem)")
    ap.add_argument("--out", type=Path, help="arquivo de saída (uma imagem)")
    ap.add_argument("--plan", type=Path, help='JSON: [{"name": "...", "prompt": "..."}]')
    ap.add_argument("--out-dir", type=Path, help="pasta de saída (com --plan)")
    ap.add_argument("--aspect", default="3:2", choices=ASPECTS)
    ap.add_argument("--model", default=load_env("GEMINI_IMAGE_MODEL") or DEFAULT_MODEL)
    ap.add_argument("--look", default=DEFAULT_LOOK, help="direção de arte comum a todas")
    ap.add_argument("--list-models", action="store_true")
    args = ap.parse_args()

    key = api_key()
    if args.list_models:
        models = image_models(key)
        print("\n".join(models) if models else "nenhum modelo de imagem liberado para esta chave")
        return

    if args.plan:
        if not args.out_dir:
            ap.error("--plan precisa de --out-dir")
        jobs = [(j["prompt"], args.out_dir / j["name"]) for j in json.loads(args.plan.read_text())]
    elif args.prompt and args.out:
        jobs = [(args.prompt, args.out)]
    else:
        ap.error("passe um prompt com --out, ou --plan com --out-dir")

    failed = 0
    for prompt, dest in jobs:
        try:
            # A freshly billed project answers 429 "free tier" from some servers
            # and 200 from others for a while — seen on the first day of a key.
            # So a 429 is retried before it is believed.
            for attempt in range(4):
                try:
                    blob, mime = generate(prompt, key, args.model, args.aspect, args.look)
                    break
                except RuntimeError as e:
                    if " 429" not in str(e) or attempt == 3:
                        raise
                    time.sleep(6 * (attempt + 1))
            print(f"ok   {save(blob, mime, dest)}", flush=True)
        except RuntimeError as e:
            failed += 1
            print(f"FALHOU {dest.name}: {e}")
            # No quota at all is not a per-image failure: the project has no
            # billing, so every job would fail the same way. Stop and say so.
            if " 429" in str(e) and "limit: 0" in str(e):
                print("A chave funciona, mas o projeto não tem cota para gerar imagem "
                      "(camada gratuita = 0). Ative o faturamento do projeto em "
                      "https://aistudio.google.com/apikey e rode de novo.")
                break
            # a wrong model name fails every job the same way — name the fix once
            if " 404" in str(e) or "not found" in str(e).lower():
                try:
                    print("modelos de imagem desta chave: " + (", ".join(image_models(key)) or "nenhum"))
                except RuntimeError:
                    pass
                break
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
