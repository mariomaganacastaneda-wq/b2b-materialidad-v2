# Context7 (MCP) - Catálogo Oficial de Librerías para Agentes (B2B Materialidad)

Este documento centraliza los IDs compatibles con el servidor MCP **Context7**, el cual debe ser utilizado por todos los agentes (claude-agent, @backend-specialist, etc.) para consultar la documentación oficial **antes** de proponer código o refactorizar integraciones principales de la arquitectura B2B Materialidad.

## Reglas de Uso del MCP `context7`
Cuando un agente necesite documentarse sobre una API o SDK de las tecnologías listadas abajo, NO debe usar su conocimiento general, sino que debe:

1. Llamar a la tool `mcp_context7_query-docs`.
2. Usar el `libraryId` exacto que corresponda de esta lista.
3. Formular un `query` específico detallando lo que se busca resolver.

---

### Catálogo de Librerías Aprobadas

#### 1. n8n (Automatización de Workflows)
*   **Library ID (Docs Oficiales):** `/n8n-io/n8n-docs`
*   **Uso Recomendado:** Consultas sobre nodos de base, sintaxis de código en nodos "Code", expresiones, o configuraciones del sistema n8n.
*   **Library ID (Para Código Fuente):** `/n8n-io/n8n`
*   **Library ID (MCP Server Específico):** `/leonardsellem/n8n-mcp-server`

#### 2. Clerk (Identidad y Autenticación)
*   **Library ID (Docs y SDKs Principales):** `/clerk/clerk-docs`
*   **Uso Recomendado:** Búsqueda sobre `@clerk/nextjs`, integraciones con Supabase Auth o middlewares.
*   **Library ID (Específico para SDK JS):** `/clerk/javascript`

#### 3. Supabase (Backend Serverless)
*   **Library ID (General y SQL):** `/supabase/supabase`
*   **Uso Recomendado:** Dudas estructurales, RLS, Storage u operaciones con el cliente SQL puro. (Para cliente JS, usar el de abajo).
*   **Library ID (Cliente JS/TS):** `/supabase/supabase-js`
*   **Uso Recomendado:** Todo lo referente a métodos locales en TypeScript de `@supabase/supabase-js` o Edge Functions usando Deno.

#### 4. React y Next.js (Frontend)
*   **Library ID (Sugerido para App Router):** `/vercel/next.js`
*   **Library ID (React):** `/facebook/react`

---

## Ejemplo de Invocación Correcta
Si el agente busca cómo asignar roles personalizados a un usuario en Clerk, la llamada a la herramienta será:

```json
{
  "libraryId": "/clerk/clerk-docs",
  "query": "How to set user flow or metadata roles in clerk using nextjs and node"
}
```

**ATENCIÓN AGENTES:** El límite máximo de llamadas al `query-docs` por pregunta es de 3. Si después de 3 llamadas no se obtiene contexto útil, se debe proceder informando al usuario o utilizando información preexistente.
