# Instrucciones del Proyecto — B2B Materialidad

## Idioma
- Siempre responder en español (preguntas de confirmación, explicaciones y comunicación).

## Principios de trabajo del agente (método "Karpathy CLAUDE.md")

Antes de escribir o modificar código, seguir estos 4 principios. **Refuerzan las reglas existentes, no las sustituyen.**

1. **Pensar antes de codear** — razonar el plan y los supuestos antes de tocar código; no asumir.
2. **Priorizar la simplicidad** — la solución más simple que funcione; no sobre-ingenierizar.
3. **Cambios quirúrgicos** — tocar lo mínimo y preciso; no reescribir de más.
4. **Ejecución orientada a la meta** — no perder el objetivo; verificar el resultado contra él (ligado a `/verificacion`).

> **Nota (B2B):** "cambios quirúrgicos" aplica también a git — paths explícitos, **nunca `git add .`/`-A`** (repo público con auto-deploy, riesgo de filtrar secretos/datos fiscales); "pensar antes" incluye validar el build local (`cd web && npx vite build`) antes de cualquier push a `main`. El "10x" del nombre es marketing; la ganancia real medible es mejor calidad de código y menos errores.

## Contexto

Sistema B2B de materialidad fiscal mexicana (CFDI, OC/Proforma, facturación electrónica, Constancias de Situación Fiscal).
Stack: React + TypeScript + Vite + Supabase (Postgres + RLS) + Clerk auth + n8n para automatizaciones.
Repo público: `mariomaganacastaneda-wq/b2b-materialidad-v2` con auto-deploy a Vercel en push a `main`.

## 🔎 Graphify — usar primero para navegar el código (grafo AST-only)

Este proyecto tiene un knowledge graph en **`graphify-out/graph.json`** (en la raíz del repo). **ANTES de Grep, Read masivo o Search** sobre el código, invoca `mcp__graphify__query_graph` con la pregunta en lenguaje natural y parte de los nodos que devuelva (cita `source_file:line`). Cae a Grep/Read solo si el grafo no cubre el dominio.

- El grafo es **AST-only** (`graphify update .`, solo estructura de código, **sin LLM, transferencia cero**). Para refrescar usa **siempre** `graphify update .` — NO `extract`, para no reenviar nada a APIs externas (aunque el `.graphifyignore` ya excluye datos fiscales/CSF/proformas).
- El `.graphifyignore` es **maximalista**: excluye `csf_backup/`, `Archivos_pruebas*/`, `*.xml/*.pdf/*.xlsx`, sub-repos (`mcp_excalidraw/`, `clerk-mcp/`, `temp_antigravity_kit/`), `scripts/etl/` y patrones PII (RFC, etc.). No relajar.
- **Se mantiene fresco solo:** hook git `post-commit` + `/cierre` (`update`) + hook SessionStart de frescura.

## Agentes y Skills

- **Custom locales** (`.claude/agents/`): `n8n-builder` (workflows n8n) · `docs-sync` (docs en `docs/sistema/`) · `oc-tester` (probar workflow OC/Proforma vía curl, verificar aritmética) · `oc-workflow-optimizer` (coordinar optimización del workflow OC) · `proforma-deleter` (eliminar proformas verificando dependencias fiscales).
- **21 agentes Antigravity** y **27 skills metodológicas** (`/nombre-skill`) llegan vía junctions del kit `sistema_Graphify` y **ya aparecen listados en el contexto de cada sesión**. Catálogos: `_Sistema/sistema_Graphify/docs/AGENTES_CATALOGO.md` y `SKILLS_CATALOGO.md`.
- **`/verificacion` es OBLIGATORIO** antes de declarar completitud.

## Supabase MCP

- **SOLO `mcp__supabase__*`** (MCP local en `.mcp.json`). Apunta a B2B Materialidad: `ywovtkubsanalddsdedi`.
- **NUNCA `mcp__claude_ai_Supabase__*`**.

## n8n MCP

- Usar el MCP HTTP oficial (instance-level), `type: http` → `https://n8n-n8n.5gad6x.easypanel.host/mcp-server/http`.
- Tools `mcp__n8n__*`: `search_nodes`, `get_sdk_reference`, `search_workflows`, `create_workflow_from_code`, etc.
- Patrón: `_Sistema/sistema_Graphify/canonical/graphify-config/MCP_N8N_INTEGRACION.md`.

## Reglas de Git (CRÍTICAS — proyecto público con auto-deploy Vercel)

- **NUNCA `git add .` ni `git add -A`** — riesgo de subir `.env.local` (`VERCEL_OIDC_TOKEN`, Clerk keys, Supabase keys) o `.mcp.json` (tokens). Usar siempre paths explícitos.
- **Antes de cualquier push a `main`**: validar local `cd web && npx vite build` (replica el build de Vercel) — TS errors abortan el deploy.
- **Pre-commit checklist completo**: `_Sistema/sistema_Graphify/canonical/graphify-config/PRE_COMMIT_CHECKLIST.md` (secretos, .gitignore, repos anidados).
- **Encoding**: UTF-8 — mantener `.editorconfig` y `.gitattributes`.

## Datos fiscales sensibles (NO commitear)

Archivos en raíz que NO deben subirse a GitHub: PDFs de Constancias de Situación Fiscal (CSF) de clientes, CFDIs (`.xml`), `Archivos_pruebas/`. Verificar `.gitignore` antes de agregar cualquier carpeta nueva.

## Protocolo de Colaboración (kit `sistema_Graphify` vía junctions)

- `.agent/` y `.claude/skills/` son **junctions al kit canónico**: editarlos **afecta a TODOS los proyectos**. Para customización local usar `.claude/agents/` (5 agentes custom locales). `.agent_overlay/` = legacy del proyecto.
- **Al iniciar sesión**: leer `WORKLOG.md`. **Al finalizar trabajo significativo**: actualizarlo.
- **Anti-redundancia**: antes de crear skill/agente, revisar los catálogos del kit.
- **TASKS cross-proyecto**: `_Sistema/sistema_Graphify/workspace_compartido/TASKS.md`.
- **Tokens**: viven en `_Sistema/.secrets/.env` — NUNCA hardcoded en código rastreado.
