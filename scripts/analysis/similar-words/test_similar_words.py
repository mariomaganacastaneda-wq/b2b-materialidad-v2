"""
===============================================================================
  SEICO B2B - Enriquecimiento MASIVO de similar_words
  Claude Haiku 4.5 + Prompt v4
  53,057 registros del catalogo SAT (cat_cfdi_productos_servicios)
===============================================================================

  Requisitos:
    python -m pip install anthropic httpx python-dotenv

  Configurar:
    $env:ANTHROPIC_API_KEY="sk-ant-..."
    $env:SUPABASE_URL="https://ywovtkubsanalddsdedi.supabase.co"
    $env:SUPABASE_SERVICE_KEY="eyJ..."

  Uso:
    python enriquecer_similar_words.py                # Procesa todo
    python enriquecer_similar_words.py --test 50      # Solo 50 registros de prueba
    python enriquecer_similar_words.py --resume       # Reanuda desde donde se quedo
    python enriquecer_similar_words.py --dry-run      # Solo genera archivos, no actualiza BD
===============================================================================
"""
import os, sys, json, csv, time, re, argparse
from datetime import datetime
from pathlib import Path

try:
    import anthropic
except ImportError:
    print("Ejecuta: python -m pip install anthropic")
    sys.exit(1)

try:
    import httpx
except ImportError:
    print("Ejecuta: python -m pip install httpx")
    sys.exit(1)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# --- Config -------------------------------------------------------------------
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://ywovtkubsanalddsdedi.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

MODEL = "claude-haiku-4-5-20251001"
BATCH_SIZE = 15
MAX_RETRIES = 5
RATE_LIMIT_PAUSE = 1.0
SAVE_EVERY = 100
OUTPUT_DIR = Path(".")
PROGRESS_FILE = OUTPUT_DIR / "progreso_similar_words.json"

# --- Prompt v4 ----------------------------------------------------------------
PROMPT_V4 = """Eres el motor de busqueda de un sistema de facturacion CFDI en Mexico. Tu trabajo: generar las palabras que un vendedor o contador mexicano ESCRIBIRIA en el buscador para encontrar cada clave del catalogo SAT.

PARA CADA REGISTRO genera entre 5 y 8 terminos. Incluye TODOS los tipos que apliquen:

COLOQUIALISMOS MEXICANOS (como le dice la gente en la calle):
  compu, lap, cel, chela, cheve, refri, micro, tele, aire (por aire acondicionado)

MARCAS USADAS COMO SUSTANTIVO (cuando la marca reemplaza al producto):
  laptop, tablet, iPad, iPhone, Uber, Zoom, WhatsApp, Excel, Google

ABREVIACIONES DE FACTURA (como lo escriben rapido en una nota o factura):
  mto., svc., eq., mat., inst., lic., rta. (renta), rep. (reparacion)

BUSQUEDAS REALES (frases cortas que alguien teclearia):
  "renta de software", "reparacion de lap", "servicio tecnico cel"

VARIANTES MEXICANAS (siempre preferir el termino mexicano):
  computadora (NO ordenador), celular (NO movil), lentes (NO gafas), camioneta (NO furgoneta)
  chicharo (NO guisante), elote (NO mazorca), popote (NO pajita), banqueta (NO acera)

REGLAS QUE NO PUEDES ROMPER:
- PROHIBIDO repetir el nombre original del registro como sinonimo. Si el registro se llama "Cerveza", NO pongas "cerveza" como sinonimo. Pon "chela, cheve, birra, cerveza artesanal, cerveza de barril".
- PROHIBIDO repetir el nombre original del registro como sinonimo. Si el registro se llama "Cafe y te", NO pongas "cafe" ni "te" solos. Pon "cafeteria, infusion, cafe molido, cafe soluble, te de hierbas, tisana".
- PROHIBIDO usar terminos de Espana: ordenador, movil, patata, zumo, gafas, vale, tio
- PROHIBIDO incluir productos de OTRA categoria SAT
- Para DIVISION/GROUP: usa terminos amplios del sector
- Para PRODUCT: usa terminos MUY ESPECIFICOS que el vendedor buscaria

Responde UNICAMENTE un JSON array:
[{"code": "12345678", "similar_words": "termino1, termino2, termino3, termino4, termino5"}]"""


# === Supabase REST API (sin SDK) ==============================================

class SupabaseREST:
    """Cliente ligero para Supabase usando httpx directo."""

    def __init__(self, url, key):
        self.url = url.rstrip("/")
        self.headers = {
            "apikey": key,
            "Authorization": "Bearer {}".format(key),
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }
        self.client = httpx.Client(timeout=30.0)

    def fetch_all(self, table, select, order_by="code", page_size=1000):
        """Pagina sobre toda la tabla usando Range headers."""
        all_rows = []
        offset = 0
        while True:
            headers = dict(self.headers)
            headers["Range"] = "{}-{}".format(offset, offset + page_size - 1)
            headers["Prefer"] = "count=exact"
            r = self.client.get(
                "{}/rest/v1/{}".format(self.url, table),
                params={"select": select, "order": order_by},
                headers=headers,
            )
            r.raise_for_status()
            rows = r.json()
            if not rows:
                break
            all_rows.extend(rows)
            offset += page_size
            if len(rows) < page_size:
                break
        return all_rows

    def update(self, table, match_col, match_val, data):
        """UPDATE table SET data WHERE match_col = match_val."""
        r = self.client.patch(
            "{}/rest/v1/{}".format(self.url, table),
            params={"{}".format(match_col): "eq.{}".format(match_val)},
            headers=self.headers,
            json=data,
        )
        r.raise_for_status()
        return True

    def close(self):
        self.client.close()


# === Helpers ==================================================================

def build_user_prompt(batch):
    lines = []
    for rec in batch:
        parent_info = ""
        if rec.get("parent_name"):
            parent_info = " [padre: {}]".format(rec["parent_name"])
        lines.append("{} | {} | {}{}".format(rec["code"], rec["name"], rec["level"], parent_info))
    return "\n".join(lines)


def extract_json_array(text):
    if not text or not text.strip():
        return []
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
        text = text.strip()
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict):
            for key in ["results", "data", "items", "registros", "similar_words"]:
                if key in parsed and isinstance(parsed[key], list):
                    return parsed[key]
    except json.JSONDecodeError:
        pass
    match = re.search(r'\[[\s\S]*\]', text)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return []


def call_haiku(client, batch, attempt=1):
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=3000,
            temperature=0.4,
            system=PROMPT_V4,
            messages=[{"role": "user", "content": build_user_prompt(batch)}],
        )
        content = response.content[0].text
        results = extract_json_array(content)
        if len(results) == 0 and attempt < MAX_RETRIES:
            time.sleep(2)
            return call_haiku(client, batch, attempt + 1)
        return {
            "results": results,
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
        }
    except anthropic.RateLimitError:
        wait = min(60, 5 * attempt)
        print("\n    Rate limit - esperando {}s...".format(wait), end=" ", flush=True)
        time.sleep(wait)
        if attempt < MAX_RETRIES:
            return call_haiku(client, batch, attempt + 1)
        return {"results": [], "input_tokens": 0, "output_tokens": 0, "error": "rate_limit"}
    except Exception as e:
        if attempt < MAX_RETRIES:
            time.sleep(2 ** attempt)
            return call_haiku(client, batch, attempt + 1)
        return {"results": [], "input_tokens": 0, "output_tokens": 0, "error": str(e)}


def load_progress():
    if PROGRESS_FILE.exists():
        with open(str(PROGRESS_FILE), "r", encoding="utf-8") as f:
            return json.load(f)
    return {"processed_codes": {}, "stats": {"input_tokens": 0, "output_tokens": 0, "errors": 0}}


def save_progress(progress):
    with open(str(PROGRESS_FILE), "w", encoding="utf-8") as f:
        json.dump(progress, f, ensure_ascii=False)


def update_supabase_batch(db, results, dry_run=False):
    if dry_run:
        return len(results)
    updated = 0
    for rec in results:
        code = rec.get("code", "")
        sw = rec.get("similar_words", "")
        if code and sw:
            try:
                db.update("cat_cfdi_productos_servicios", "code", code, {"similar_words": sw})
                updated += 1
            except Exception as e:
                print("\n    Error BD {}: {}".format(code, str(e)[:60]))
    return updated


def main():
    parser = argparse.ArgumentParser(description="Enriquecimiento masivo de similar_words")
    parser.add_argument("--test", type=int, help="Solo procesar N registros de prueba")
    parser.add_argument("--resume", action="store_true", help="Reanudar desde progreso guardado")
    parser.add_argument("--dry-run", action="store_true", help="No actualizar Supabase")
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE, help="Registros por llamada")
    args = parser.parse_args()
    batch_size = args.batch_size

    print()
    print("=" * 70)
    print("  SEICO B2B - Enriquecimiento Masivo similar_words")
    print("  Modelo: Claude Haiku 4.5 | Prompt v4")
    print("  {}".format(datetime.now().strftime("%Y-%m-%d %H:%M:%S")))
    if args.test:
        print("  MODO TEST: solo {} registros".format(args.test))
    if args.dry_run:
        print("  MODO DRY-RUN: no actualiza Supabase")
    if args.resume:
        print("  MODO RESUME: reanuda desde progreso guardado")
    print("=" * 70)

    if not ANTHROPIC_API_KEY:
        print('\nERROR: Falta ANTHROPIC_API_KEY')
        print('  $env:ANTHROPIC_API_KEY="sk-ant-..."')
        sys.exit(1)
    if not SUPABASE_SERVICE_KEY:
        print('\nERROR: Falta SUPABASE_SERVICE_KEY')
        print('  $env:SUPABASE_SERVICE_KEY="eyJ..."')
        sys.exit(1)

    # Conectar
    ai = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    db = SupabaseREST(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Extraer registros
    print("\nExtrayendo registros de Supabase...", end=" ", flush=True)
    all_records = db.fetch_all("cat_cfdi_productos_servicios", "code,name,level,parent_code")
    print("{:,} registros".format(len(all_records)))

    # Resolver parent_name
    print("Resolviendo nombres padre...", end=" ", flush=True)
    code_to_name = {r["code"]: r["name"] for r in all_records}
    for rec in all_records:
        pc = rec.get("parent_code")
        rec["parent_name"] = code_to_name.get(pc, "") if pc else ""
    print("OK")

    # Modo test
    if args.test:
        by_level = {}
        for r in all_records:
            by_level.setdefault(r["level"], []).append(r)
        sample = []
        for level in ["DIVISION", "GROUP", "CLASS", "PRODUCT"]:
            items = by_level.get(level, [])
            n = min(len(items), max(2, args.test * len(items) // len(all_records)))
            step = max(1, len(items) // n)
            sample.extend(items[::step][:n])
        all_records = sample[:args.test]
        print("Muestra: {} registros ({} DIV, {} GRP, {} CLS, {} PRD)".format(
            len(all_records),
            sum(1 for r in all_records if r["level"] == "DIVISION"),
            sum(1 for r in all_records if r["level"] == "GROUP"),
            sum(1 for r in all_records if r["level"] == "CLASS"),
            sum(1 for r in all_records if r["level"] == "PRODUCT"),
        ))

    # Progreso
    progress = load_progress() if args.resume else {"processed_codes": {}, "stats": {"input_tokens": 0, "output_tokens": 0, "errors": 0}}

    if args.resume and progress["processed_codes"]:
        before = len(all_records)
        all_records = [r for r in all_records if r["code"] not in progress["processed_codes"]]
        print("Resume: {:,} ya procesados, {:,} pendientes".format(before - len(all_records), len(all_records)))

    if not all_records:
        print("\nTodos los registros ya fueron procesados!")
        sys.exit(0)

    # Batches
    batches = [all_records[i:i + batch_size] for i in range(0, len(all_records), batch_size)]
    total_records = len(all_records)
    total_batches = len(batches)

    print("\nProcesando {:,} registros en {:,} batches de {}...\n".format(
        total_records, total_batches, batch_size))

    processed = 0
    updated_db = 0
    errors = 0
    start_time = time.time()
    all_results = []

    try:
        for i, batch in enumerate(batches):
            pct = (i / total_batches) * 100
            elapsed = time.time() - start_time
            rate = processed / elapsed if elapsed > 0 else 0
            eta = ((total_records - processed) / rate / 60) if rate > 0 else 0

            print("  [{:>5.1f}%] Batch {:,}/{:,} ({} reg)".format(
                pct, i + 1, total_batches, len(batch)), end="", flush=True)
            if i > 0 and eta > 0:
                print(" | ETA: {:.0f}min".format(eta), end="", flush=True)
            print("...", end=" ", flush=True)

            resp = call_haiku(ai, batch)

            if resp.get("error"):
                errors += len(batch)
                progress["stats"]["errors"] += len(batch)
                print("ERROR: {}".format(str(resp["error"])[:60]))
                continue

            results = resp["results"]
            progress["stats"]["input_tokens"] += resp.get("input_tokens", 0)
            progress["stats"]["output_tokens"] += resp.get("output_tokens", 0)

            code_map = {r["code"]: r for r in batch}
            for res in results:
                c = res.get("code", "")
                if c in code_map:
                    res["original_name"] = code_map[c]["name"]
                    res["level"] = code_map[c]["level"]
                    res["parent_name"] = code_map[c].get("parent_name", "")

            n_updated = update_supabase_batch(db, results, dry_run=args.dry_run)
            updated_db += n_updated

            for res in results:
                code = res.get("code", "")
                if code:
                    progress["processed_codes"][code] = res.get("similar_words", "")

            all_results.extend(results)
            processed += len(batch)

            print("{} res | {} upd | {:,} tok".format(
                len(results), n_updated,
                resp.get("input_tokens", 0) + resp.get("output_tokens", 0)))

            if (i + 1) % 10 == 0:
                save_progress(progress)

            if i < total_batches - 1:
                time.sleep(RATE_LIMIT_PAUSE)

    except KeyboardInterrupt:
        print("\n\n  INTERRUMPIDO por usuario. Guardando progreso...")
        save_progress(progress)
        print("  Progreso guardado. Usa --resume para continuar.")

    # Guardar progreso final
    save_progress(progress)

    # Estadisticas
    elapsed = time.time() - start_time
    total_tokens = progress["stats"]["input_tokens"] + progress["stats"]["output_tokens"]
    cost = (progress["stats"]["input_tokens"] / 1e6) * 1.00 + (progress["stats"]["output_tokens"] / 1e6) * 5.00

    print("\n" + "=" * 70)
    print("  RESULTADO FINAL")
    print("=" * 70)
    print("  Registros procesados: {:,}".format(processed))
    print("  Actualizados en BD:   {:,}".format(updated_db))
    print("  Errores:              {:,}".format(errors))
    print("  Tokens totales:       {:,} (in:{:,} out:{:,})".format(
        total_tokens, progress["stats"]["input_tokens"], progress["stats"]["output_tokens"]))
    print("  Costo total:          ${:.2f} USD".format(cost))
    print("  Tiempo:               {:.1f} minutos".format(elapsed / 60))
    if elapsed > 0:
        print("  Velocidad:            {:.1f} reg/s".format(processed / elapsed))
    if args.dry_run:
        print("  ** DRY-RUN: Supabase NO fue actualizado **")
    print("=" * 70)

    # Guardar archivos
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    jp = str(OUTPUT_DIR / "similar_words_{}.json".format(ts))
    with open(jp, "w", encoding="utf-8") as f:
        json.dump({
            "metadata": {
                "model": MODEL,
                "timestamp": datetime.now().isoformat(),
                "total_records": len(all_results),
                "total_tokens": total_tokens,
                "cost_usd": round(cost, 2),
                "elapsed_minutes": round(elapsed / 60, 1),
            },
            "results": all_results,
        }, f, ensure_ascii=False, indent=2)
    print("\nJSON: {}".format(jp))

    cp = str(OUTPUT_DIR / "similar_words_{}.csv".format(ts))
    with open(cp, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["code", "name", "level", "parent_name", "similar_words", "num_synonyms"])
        for res in all_results:
            sw = res.get("similar_words", "")
            ns = len([s.strip() for s in sw.split(",") if s.strip()]) if sw else 0
            w.writerow([res.get("code", ""), res.get("original_name", ""),
                        res.get("level", ""), res.get("parent_name", ""), sw, ns])
    print("CSV:  {}".format(cp))
    print("\nListo!")

    db.close()


if __name__ == "__main__":
    main()