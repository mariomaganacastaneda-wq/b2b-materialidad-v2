# 09 - Theme y Branding Dinámico

## Concepto

El sistema implementa **branding dinámico por organización**: cada empresa puede personalizar los colores de la interfaz, logo y nombre comercial. El tema se aplica usando **CSS custom properties** (variables CSS) que se actualizan en runtime.

---

## Regla 60-30-10

El diseño sigue la regla clásica de distribución de color:

| Proporción | Rol | Variables CSS | Uso |
|-----------|-----|---------------|-----|
| **60%** | Neutrales | `--bg-60`, `--border-60`, `--text-light-60`, `--text-dark-60` | Fondo, bordes, texto |
| **30%** | Primario | `--primary-30`, `--primary-light-30`, `--primary-dark-30`, `--primary-glow` | Botones, links, acentos |
| **10%** | Acento | `--accent-10`, `--secondary-10` | Highlights, CTAs, estados |

---

## Variables CSS

### Neutrales (60%)
| Variable | Default | Descripción |
|----------|---------|-------------|
| `--bg-60` | `#0f172a` | Fondo general (dark mode) |
| `--border-60` | `#334155` | Color de bordes |
| `--text-light-60` | `#94a3b8` | Texto secundario |
| `--text-dark-60` | `#ffffff` | Texto principal |

### Primario (30%)
| Variable | Default | Descripción |
|----------|---------|-------------|
| `--primary-30` | `#06b6d4` | Color primario base (cyan) |
| `--primary-light-30` | `#22d3ee` | Variante clara |
| `--primary-dark-30` | `#0891b2` | Variante oscura |
| `--primary-glow` | `#06b6d44d` | Glow/sombra (30% opacidad) |

### Acento (10%)
| Variable | Default | Descripción |
|----------|---------|-------------|
| `--accent-10` | `#FFC107` | Color de acento (amber) |
| `--secondary-10` | `#929292` | Color secundario |

### Semánticos
| Variable | Default | Descripción |
|----------|---------|-------------|
| `--color-success` | `#10b981` | Éxito (emerald) |
| `--color-error` | `#ef4444` | Error (red) |
| `--color-warning` | `#f59e0b` | Advertencia (amber) |
| `--color-info` | `#17A2B8` | Información (teal) |

### Compatibilidad (aliases)
| Variable | Apunta a |
|----------|---------|
| `--primary-base` | `--primary-30` |
| `--primary-light` | `--primary-light-30` |
| `--accent-color` | `--accent-10` |
| `--primary-color` | `--primary-30` |
| `--logo-url` | URL del logotipo |

---

## Cómo se aplica el tema

### Hook `useTheme` (App.tsx)

```typescript
const useTheme = (org: Organization) => {
  useEffect(() => {
    if (org) {
      const root = document.documentElement;

      // Lee colores de org.theme_config (JSONB)
      const primaryBase = org.theme_config?.primary_color || '#06b6d4';
      // ... más colores

      // Aplica al :root
      root.style.setProperty('--primary-30', primaryBase);
      // ... más variables

      // Logo dinámico
      if (org.logo_url) {
        root.style.setProperty('--logo-url', `url(${org.logo_url})`);
      }

      // Título dinámico
      document.title = `${org.brand_name || org.name} | B2B Materialidad`;
    }
  }, [org]);
};
```

### Flujo:
```
Usuario selecciona organización
    │
    ▼
org.theme_config (JSONB de Supabase)
    │
    ▼
useTheme(org) → Aplica CSS variables a :root
    │
    ▼
Toda la UI refleja los colores de la organización
```

---

## Configuración por Organización

### Tabla `organizations.theme_config` (JSONB)

```json
{
  "primary_color": "#06b6d4",
  "primary_light": "#22d3ee",
  "primary_dark": "#0891b2",
  "accent_color": "#FFC107",
  "secondary_color": "#929292",
  "bg_general": "#0f172a",
  "text_dark": "#ffffff",
  "text_light": "#94a3b8",
  "border_color": "#334155",
  "color_success": "#10b981",
  "color_error": "#ef4444",
  "color_warning": "#f59e0b",
  "color_info": "#17A2B8"
}
```

### Campos adicionales de branding:
| Campo | Descripción |
|-------|-------------|
| `organizations.brand_name` | Nombre comercial (mostrado en título) |
| `organizations.logo_url` | URL del logotipo (mostrado en sidebar) |
| `organizations.primary_color` | Color primario rápido (legacy) |

---

## Clases CSS Globales (index.css)

### Botones
| Clase | Uso |
|-------|-----|
| `.btn-primary` | Botón principal (usa `--primary-30`) |
| `.btn-secondary` | Botón secundario (usa `--secondary-10`) |
| `.btn-accent` | Botón de acento (usa `--accent-10`) |
| `.btn-danger` | Botón de peligro (usa `--color-error`) |

### Cards y Contenedores
| Clase | Uso |
|-------|-----|
| `.card` | Contenedor con borde y fondo |
| `.card-header` | Header de card con gradiente |
| `.sidebar` | Panel lateral de navegación |

### Badges de Estado
| Clase | Color | Uso |
|-------|-------|-----|
| `.badge-success` | Verde | Estado exitoso |
| `.badge-warning` | Amarillo | Estado pendiente |
| `.badge-error` | Rojo | Estado error |
| `.badge-info` | Cyan | Estado informativo |

### Tablas
| Clase | Uso |
|-------|-----|
| `.table` | Tabla base con estilo |
| `.table-striped` | Filas alternadas |
| `.table-hover` | Resaltado al hover |

---

## Modo Oscuro

El sistema está diseñado en **dark mode por defecto**:
- Fondo: `#0f172a` (Slate 900)
- Texto: `#ffffff` (blanco)
- Bordes: `#334155` (Slate 700)
- Cards: Semi-transparentes con backdrop-filter

No hay toggle light/dark mode; el diseño es exclusivamente dark.

---

## Ejemplo Visual

```
┌──────────────────────────────────────────────┐
│ 🏢 [Logo]  Empresa ABC                 [👤]  │ ← brand_name + logo_url
│──────────────────────────────────────────────│
│ ■ Dashboard    │  Tablero Materialidad       │
│ ■ Materialidad │  ┌──────────────────────┐   │
│ ■ Proformas    │  │ Stats en PRIMARY     │   │ ← --primary-30
│ ■ Facturas     │  │ ████████ $1.2M       │   │
│ ■ OC           │  └──────────────────────┘   │
│ ■ Evidencia    │                              │
│ ■ Contratos    │  ┌──────┐ ┌──────┐          │
│ ■ Catálogos    │  │ PEND │ │ ✅OK │          │ ← badges semánticos
│ ■ Config       │  └──────┘ └──────┘          │
│ ■ Seguridad    │                              │
│────────────────│  [+ Nueva Proforma]          │ ← btn-accent
│ FONDO: bg-60   │                              │ ← --bg-60
└──────────────────────────────────────────────┘
```
