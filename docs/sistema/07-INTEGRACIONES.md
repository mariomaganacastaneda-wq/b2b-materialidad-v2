# 07 - Integraciones Externas

## Visión General

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Clerk   │────▶│ Frontend │────▶│ Supabase │
│  (Auth)  │ JWT │ (React)  │ API │ (DB+RLS) │
└──────────┘     └────┬─────┘     └────┬─────┘
                      │                │
                      ▼                ▼
                 ┌──────────┐    ┌───────────┐
                 │  Vercel  │    │ Edge Funcs │
                 │ (Deploy) │    │ (Deno)    │
                 └──────────┘    └───────────┘
                                       │
                                       ▼
                                 ┌──────────┐
                                 │   n8n    │
                                 │ (Autom.) │
                                 └──────────┘
```

---

## 1. Clerk (Autenticación)

### Qué hace
- Login/Signup de usuarios
- Gestión de sesiones
- Generación de JWT con template personalizado para Supabase

### Configuración
- **Publishable Key**: `VITE_CLERK_PUBLISHABLE_KEY`
- **JWT Template**: `supabase` (configurable en Clerk Dashboard)

### Componentes React utilizados:
```typescript
import {
  SignedIn,        // Wrapper: muestra contenido si está logueado
  SignedOut,       // Wrapper: muestra contenido si NO está logueado
  SignInButton,    // Botón de inicio de sesión
  UserButton,     // Avatar con menú de usuario
  useUser,        // Hook: datos del usuario actual
  useAuth         // Hook: token y funciones de auth
} from '@clerk/clerk-react';
```

### Flujo JWT:
```
useAuth().getToken({ template: 'supabase' })
    → Genera JWT con claims personalizados
    → Se inyecta en cada request a Supabase
    → Supabase verifica JWT y aplica RLS
```

### MCP de Clerk
- **Ubicación**: `clerk-mcp/`
- **Función**: Servidor MCP para gestión administrativa de Clerk
- **Usa**: `CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY`

---

## 2. Supabase (Backend)

### Servicios utilizados

| Servicio | Uso |
|----------|-----|
| **PostgreSQL** | Base de datos principal (26+ tablas) |
| **Auth** | Verificación JWT + RLS (via Clerk JWT) |
| **Storage** | Almacenamiento de archivos (5+ buckets) |
| **Edge Functions** | 6 funciones serverless (Deno) |
| **Realtime** | No utilizado actualmente |

### Cliente Supabase (`lib/supabase.ts`):
```typescript
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: customFetch  // Interceptor que inyecta JWT de Clerk
  }
});
```

### Row Level Security (RLS):
- Habilitado en todas las tablas transaccionales
- Políticas basadas en `auth.uid()` (extraído del JWT)
- Filtrado automático por `organization_id`

### Storage Buckets:
| Bucket | Contenido | Acceso |
|--------|-----------|--------|
| `invoices` | PDFs y XMLs de facturas | Autenticado |
| `contracts` | PDFs de contratos | Autenticado |
| `evidence` | Fotos y documentos | Autenticado |
| `purchase_orders` | PDFs de OC | Autenticado |
| `csf` | Constancias de Situación Fiscal | Autenticado |
| `quotations` | Archivos de proformas | Autenticado |

### Edge Functions:
| Función | Trigger | Descripción |
|---------|---------|-------------|
| `process-purchase-order` | HTTP (n8n) | OCR de OC con IA |
| `process-csf` | HTTP | Extracción datos de CSF |
| `manage-user-access` | HTTP | Control acceso usuario-org |
| `send-proforma` | HTTP | Envío proforma email/WhatsApp |
| `notify-invoice` | HTTP | Notificación estado factura |
| `fix-rls` | HTTP | Correcciones políticas RLS |

---

## 3. n8n (Automatización)

### Instancia
- **URL**: `https://n8n-n8n.5gad6x.easypanel.host`
- **Hosting**: EasyPanel (Docker)
- **Acceso MCP**: Configurado en `.mcp.json`

### Webhooks activos

#### `process-po-pdf`
- **Trigger**: Upload de PDF de Orden de Compra
- **Proceso**: OCR + IA → Extracción de datos → Insert en DB
- **Datos extraídos**:
  - Número de OC, fecha, moneda
  - RFC y nombre del cliente
  - Partidas (clave SAT, cantidad, precio, IVA/IEPS)
  - Mensajes de validación

#### `process-csf`
- **Trigger**: Upload de PDF de Constancia de Situación Fiscal
- **Proceso**: Parsing PDF → Extracción RFC/régimen/actividades → Upsert org

### Configuración MCP:
```json
{
  "mcpServers": {
    "n8n": {
      "command": "npx",
      "args": ["-y", "n8n-mcp@latest"],
      "env": {
        "N8N_API_URL": "https://n8n-n8n.5gad6x.easypanel.host",
        "N8N_API_KEY": "[JWT]"
      }
    }
  }
}
```

---

## 4. Vercel (Deployment)

### Configuración (`vercel.json`):
- **Build**: `cd web && npm install && npm run build`
- **Output**: `web/dist`
- **Framework**: Vite
- **SPA Rewrite**: `/(.*) → /index.html`

### Headers de Seguridad:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`

### Variables de entorno en Vercel:
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## 5. Catálogos SAT

### Fuentes de datos
Los catálogos del SAT se importan mediante migraciones SQL y se mantienen actualizados:

| Catálogo | Tabla | Fuente |
|----------|-------|--------|
| Productos/Servicios CFDI 4.0 | `cat_cfdi_productos_servicios` | Catálogo SAT |
| Regímenes Fiscales | `cat_cfdi_regimenes` | Catálogo SAT |
| Usos de CFDI | `cat_cfdi_usos` | Catálogo SAT |
| Actividades Económicas SCIAN | `cat_economic_activities` | INEGI/SCIAN |
| Lista Negra 69-B | `sat_blacklist` | DOF/SAT |
| Bancos Mexicanos | `cat_mexican_banks` | CNBV |
| Unidades de Medida | (catálogo unidades) | SAT |

### Mapeo inteligente
- **`rel_activity_cps_congruence`**: Conecta actividades económicas con productos SAT
- **`cat_activity_search_tokens`**: Tokens para búsqueda inversa
- **RPC `search_productos_sat`**: Full Text Search semántica

---

## 6. Antigravity Kit

### Ubicación: `.agent/`
- **20 agentes** especializados (frontend, backend, security, etc.)
- **36 skills** modulares
- **11 workflows** (slash commands: /plan, /create, /debug, etc.)
- Diseñado para Gemini, no para Claude Code
