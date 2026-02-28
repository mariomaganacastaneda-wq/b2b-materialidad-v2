# 08 - Catálogos SAT

## Visión General

El sistema integra los catálogos oficiales del SAT (Servicio de Administración Tributaria de México) necesarios para la emisión de CFDI 4.0 y el blindaje fiscal.

| Catálogo | Tabla | Registros | Estructura |
|----------|-------|-----------|-----------|
| Productos/Servicios | `cat_cfdi_productos_servicios` | 50,000+ | Jerárquica (4 niveles) |
| Regímenes Fiscales | `cat_cfdi_regimenes` | ~20 | Plana |
| Usos de CFDI | `cat_cfdi_usos` | ~25 | Plana |
| Actividades Económicas | `cat_economic_activities` | ~1,200 | Jerárquica (4 niveles) |
| Lista Negra 69-B | `sat_blacklist` | Variable | Plana |
| Bancos Mexicanos | `cat_mexican_banks` | ~50 | Plana |

---

## 1. Productos y Servicios CFDI 4.0

### Estructura jerárquica

```
DIVISION (2 dígitos)
  └── GROUP (4 dígitos)
        └── CLASS (6 dígitos)
              └── PRODUCT (8 dígitos) ← Clave de facturación
```

### Ejemplo:
```
43000000 - Tecnologías de la Información (DIVISION)
  └── 43230000 - Software (GROUP)
        └── 43231500 - Software funcional (CLASS)
              └── 43231513 - Software de contabilidad (PRODUCT)
```

### Campos por producto:
| Campo | Descripción |
|-------|-------------|
| `code` | Clave SAT (8 dígitos para producto final) |
| `name` | Descripción oficial |
| `level` | DIVISION, GROUP, CLASS, PRODUCT |
| `parent_code` | Código del nivel padre |
| `includes_iva_transfered` | ¿El producto incluye IVA trasladado? |
| `includes_ieps_transfered` | ¿El producto incluye IEPS trasladado? |
| `similar_words` | Palabras clave para búsqueda semántica |
| `similarity_threshold` | Umbral de coincidencia |

### Búsqueda inteligente (RPC)
- **Función**: `search_productos_sat`
- **Tipo**: Full Text Search (FTS) de PostgreSQL
- **Busca en**: código (exacto) + nombre (semántico) + similar_words
- **Ordenamiento**: Relevancia por ts_rank

### Componente: `ProductsServicesTab.tsx`
- Árbol expandible con lazy loading
- Búsqueda dual: por código (numérica) o nombre (semántica)
- Indicadores visuales de IVA/IEPS
- Actividades económicas relacionadas con score

---

## 2. Regímenes Fiscales

### Estructura:
| Campo | Descripción |
|-------|-------------|
| `code` | Código SAT (601, 605, 612, etc.) |
| `name` | Descripción del régimen |
| `applies_to_physical` | ¿Aplica a Persona Física? |
| `applies_to_moral` | ¿Aplica a Persona Moral? |

### Regímenes más comunes:
| Código | Nombre | PF | PM |
|--------|--------|----|----|
| 601 | General de Ley Personas Morales | ❌ | ✅ |
| 603 | Personas Morales con Fines no Lucrativos | ❌ | ✅ |
| 605 | Sueldos y Salarios | ✅ | ❌ |
| 606 | Arrendamiento | ✅ | ❌ |
| 612 | Personas Físicas con Actividades Empresariales y Profesionales | ✅ | ❌ |
| 616 | Sin Obligaciones Fiscales | ✅ | ✅ |
| 621 | Incorporación Fiscal | ✅ | ❌ |
| 625 | Régimen de las Actividades Empresariales con Ingresos a través de Plataformas Tecnológicas | ✅ | ❌ |
| 626 | Régimen Simplificado de Confianza | ✅ | ✅ |

### Uso en el sistema:
- Validación al crear organización
- Asignación múltiple vía `organization_regimes`
- Verificación cruzada con CSF

---

## 3. Usos de CFDI

### Estructura:
| Campo | Descripción |
|-------|-------------|
| `code` | Código SAT (G01, G03, P01, etc.) |
| `name` | Descripción del uso |
| `applies_to_physical` | ¿Aplica a PF? |
| `applies_to_moral` | ¿Aplica a PM? |

### Usos más comunes:
| Código | Nombre | Contexto |
|--------|--------|----------|
| G01 | Adquisición de mercancías | Compra de bienes |
| G02 | Devoluciones, descuentos o bonificaciones | Ajustes |
| G03 | Gastos en general | Uso genérico (más usado) |
| I01 | Construcciones | Inmuebles |
| I02 | Mobiliario y equipo de oficina | Activos fijos |
| I04 | Equipo de computo y accesorios | TI |
| P01 | Por definir | Cuando no se conoce el uso |
| S01 | Sin efectos fiscales | Sin deducción |
| CP01 | Pagos | Complemento de pago |

### Importancia fiscal:
- Un uso incorrecto **invalida la deducibilidad** del gasto
- El sistema muestra alertas cuando el uso no corresponde al tipo de persona

---

## 4. Actividades Económicas (SCIAN)

### Qué es SCIAN
Sistema de Clasificación Industrial de América del Norte. Taxonomía oficial para clasificar actividades económicas.

### Estructura jerárquica:
```
SECTOR (2 dígitos) - ej: 54 Servicios profesionales
  └── SUBSECTOR (3 dígitos) - ej: 541 Servicios profesionales, científicos y técnicos
        └── RAMA (4 dígitos) - ej: 5411 Servicios legales
              └── SUBRAMA (5-6 dígitos) - ej: 54111 Bufetes jurídicos
```

### Campos:
| Campo | Descripción |
|-------|-------------|
| `id` | UUID |
| `code` | Código SCIAN |
| `name` | Nombre de la actividad |
| `level` | SECTOR, SUBSECTOR, RAMA, SUBRAMA |
| `parent_id` | ID del nivel padre |
| `metadata` | JSONB con datos adicionales |
| `description` | Descripción completa |

### Mapeo Actividad → Producto SAT

La tabla `rel_activity_cps_congruence` vincula actividades económicas con productos/servicios SAT:

```
Actividad Económica (SCIAN)
        │
        ├── Score ≥ 1.0 → PRODUCTO PRINCIPAL
        ├── Score 0.5-0.9 → PRODUCTO RELACIONADO
        └── Score < 0.5 → PRODUCTO MARGINAL
        │
        ▼
Producto/Servicio SAT (CFDI)
```

### Búsqueda inversa
La tabla `cat_activity_search_tokens` permite encontrar actividades por palabras clave:

```
Token "software" → Actividad 5112 (Edición de software)
Token "contabilidad" → Actividad 5412 (Servicios de contabilidad)
```

### Componente: `EconomicActivitiesTab.tsx`
- Árbol expandible (SECTOR → SUBRAMA)
- Productos SAT relacionados por actividad
- Score de congruencia (badge PRINCIPAL/RELACIONADO)
- Lazy loading de productos al expandir

---

## 5. Lista Negra SAT (Art. 69-B CFF)

### Qué es
Lista de contribuyentes que el SAT ha detectado emitiendo comprobantes que amparan operaciones simuladas (EFOS) o que los dedujeron (EDOS).

### Tipos:
| Tipo | Descripción | Riesgo |
|------|-------------|--------|
| **EFOS** | Empresa Facturadora de Operaciones Simuladas | Emisor ficticio |
| **EDOS** | Empresa que Deduce Operaciones Simuladas | Receptor cómplice |

### Campos:
| Campo | Descripción |
|-------|-------------|
| `rfc` | RFC del contribuyente listado |
| `razon_social` | Razón social |
| `estatus` | Estado: Presunción, Definitivo, Desvirtuado, etc. |
| `fecha_publicacion` | Fecha de publicación en DOF |
| `dof_url` | Link al Diario Oficial de la Federación |
| `last_sync_at` | Última sincronización de datos |

### Estatus posibles:
| Estatus | Significado | Nivel de riesgo |
|---------|-------------|----------------|
| **Definitivo** | Confirmado como EFOS | CRÍTICO |
| **Presunto** | En proceso de investigación | ALTO |
| **Desvirtuado** | Probó operaciones legítimas | BAJO |
| **Sentencia Favorable** | Ganó litigio | NULO |

### Uso en el sistema:
- Validación automática de RFC al crear organizaciones
- Alerta visual en Settings cuando un cliente está listado
- Verificación cruzada en Materialidad

### Componente: `BlacklistTab.tsx`
- Búsqueda en tiempo real por RFC o nombre
- Acordeón con detalles expandibles
- Badges de riesgo por color
- Link al DOF para verificación

---

## 6. Bancos Mexicanos

### Tabla: `cat_mexican_banks`
Catálogo de instituciones bancarias para el módulo de cuentas bancarias.

### Uso:
- Selector desplegable en `BankAccountsManager.tsx`
- Búsqueda por nombre
- Asociación con `org_bank_accounts`

### Bancos incluidos:
BBVA, Banorte, Santander, Scotiabank, HSBC, Citibanamex, Banco Azteca, BanCoppel, Inbursa, Banregio, Afirme, Multiva, entre otros.

---

## 7. Mapeo Bidireccional Actividad ↔ Producto

### Concepto
El sistema establece una relación de congruencia entre las actividades económicas de una empresa y los productos/servicios que puede facturar legítimamente.

### Tablas involucradas:
```
cat_economic_activities ←→ rel_activity_cps_congruence ←→ cat_cfdi_productos_servicios
                                      │
                           cat_activity_search_tokens
```

### Flujo de recomendación:
1. Empresa tiene actividad SCIAN `5112` (Edición de software)
2. Sistema busca en `rel_activity_cps_congruence` los productos vinculados
3. Ordena por `score` (≥1.0 = PRINCIPAL)
4. Recomienda productos SAT congruentes para facturar
5. Si el producto no está en la lista → **alerta de incongruencia fiscal**

### Importancia fiscal:
- Si una empresa factura productos **incongruentes** con su actividad económica, es señal de posible simulación
- El SAT cruza esta información en auditorías
- El sistema alerta proactivamente sobre incongruencias
