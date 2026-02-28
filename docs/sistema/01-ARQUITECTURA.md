# 01 - Arquitectura del Sistema

## Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| **Frontend** | React | 19.2.0 |
| **Lenguaje** | TypeScript | 5.9.3 |
| **Build Tool** | Vite | 7.2.4 |
| **Routing** | React Router DOM | 7.13.0 |
| **State** | Zustand | 5.0.11 |
| **Iconos** | Lucide React | 0.563.0 |
| **PDF Gen** | jsPDF + jspdf-autotable | - |
| **Excel** | xlsx | 0.18.5 |
| **DB/Backend** | Supabase | 2.95.3 |
| **Auth** | Clerk | 5.60.1 |
| **Deploy** | Vercel | - |
| **Automatización** | n8n | Instancia propia |

---

## Estructura de Carpetas

```
B2B_Materialidad/
├── .agent/                     # Antigravity Kit (agentes IA)
├── .mcp.json                   # Configuración MCP (n8n)
├── .supabase/                  # Config Supabase local
├── clerk-mcp/                  # MCP servidor para Clerk
├── csf_backup/                 # Respaldos de CSF
├── design-system/              # Sistema de diseño
├── docs/                       # Documentación
│   └── sistema/                # ← ESTA documentación
├── n8n-workflows/              # Workflows de automatización
├── scripts/                    # Scripts de utilidad
├── similar_words/              # Análisis similitud (catálogos SAT)
├── supabase/                   # Migraciones y Edge Functions
│   ├── migrations/             # 47 archivos de migración SQL
│   ├── functions/              # 6 Edge Functions
│   └── config.toml             # Config local de Supabase
├── web/                        # APLICACIÓN PRINCIPAL
│   ├── src/
│   │   ├── App.tsx             # Raíz: routing, auth, theme (945 líneas)
│   │   ├── main.tsx            # Entry point
│   │   ├── index.css           # Estilos globales + CSS variables
│   │   ├── lib/
│   │   │   └── supabase.ts     # Cliente Supabase + interceptor JWT
│   │   ├── types/
│   │   │   └── index.ts        # 12 interfaces TypeScript
│   │   ├── components/
│   │   │   ├── accounting/     # 1 componente (BankAccountsManager)
│   │   │   ├── catalogs/       # 7 componentes (SAT)
│   │   │   ├── commercial/     # 2 componentes (Materialidad, Proforma)
│   │   │   └── settings/       # 7 componentes (Config, Roles, Users)
│   │   └── pages/              # 11 páginas
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── vercel.json                 # Config de deploy
└── CLAUDE.md                   # Instrucciones para IA
```

---

## Flujo de Autenticación

```
Usuario
  │
  ▼
Clerk (Login UI)
  │ → Verifica identidad
  ▼
ClerkProvider (VITE_CLERK_PUBLISHABLE_KEY)
  │
  ▼
useAuth() → getToken({ template: 'supabase' })
  │ → Genera JWT con claims de Supabase
  ▼
Custom Fetch Interceptor (lib/supabase.ts)
  │ → Inyecta Authorization: Bearer <jwt> en cada request
  ▼
Supabase Client
  │ → JWT verificado por PostgREST
  │ → RLS aplica según auth.uid()
  ▼
PostgreSQL (Row Level Security activo)
```

### Detalle del flujo en App.tsx:

1. **Línea 312**: Clerk carga el usuario (`useUser()`)
2. **Línea 330-338**: Obtiene JWT con template `supabase`
3. **Línea 370-371**: Inyecta token en headers de Supabase
4. **Línea 374-377**: Sincroniza sesión de Supabase
5. **Línea 401-435**: Verifica/crea perfil en tabla `profiles`
6. **Línea 469-543**: Carga organizaciones filtradas por RLS
7. **Línea 496-509**: Carga permisos del rol del usuario

### Admins Hardcoded (bypass de seguridad):
```
- user_39fz5fO1nTqgiZdV3oBEevy2FfT
- user_39ldmMY70oeZqxolww1N55Ptvw6
```

---

## Deploy (Vercel)

**Archivo**: `vercel.json`

| Config | Valor |
|--------|-------|
| Build command | `cd web && npm install && npm run build` |
| Output directory | `web/dist` |
| Framework | Vite |
| SPA Rewrite | `/(.*) → /index.html` |

### Headers de Seguridad:
- `X-Frame-Options: DENY` (previene clickjacking)
- `X-Content-Type-Options: nosniff` (previene MIME sniffing)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`

---

## Variables de Entorno Requeridas

| Variable | Servicio | Descripción |
|----------|---------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk | Llave pública de autenticación |
| `VITE_SUPABASE_URL` | Supabase | URL del proyecto |
| `VITE_SUPABASE_ANON_KEY` | Supabase | Llave anónima (pública) |
| `N8N_API_URL` | n8n | URL de la instancia n8n (en MCP) |
| `N8N_API_KEY` | n8n | Token JWT para API de n8n (en MCP) |

---

## Dependencias Principales (package.json)

### Runtime
| Paquete | Versión | Uso |
|---------|---------|-----|
| `@clerk/clerk-react` | ^5.60.1 | Autenticación |
| `@supabase/supabase-js` | ^2.95.3 | Cliente DB |
| `react` | ^19.2.0 | UI Framework |
| `react-dom` | ^19.2.0 | DOM rendering |
| `react-router-dom` | ^7.13.0 | Routing SPA |
| `zustand` | ^5.0.11 | State management |
| `jspdf` | - | Generación de PDFs |
| `jspdf-autotable` | - | Tablas en PDFs |
| `xlsx` | ^0.18.5 | Lectura/escritura Excel |
| `lucide-react` | ^0.563.0 | Iconografía |
| `pg` | ^8.19.0 | PostgreSQL driver |
| `pdf-parse` | ^2.4.5 | Parsing de PDFs |

### Dev
| Paquete | Versión | Uso |
|---------|---------|-----|
| `typescript` | ~5.9.3 | Tipado estático |
| `vite` | 7.2.4 | Build + HMR |
| `eslint` | - | Linting |
