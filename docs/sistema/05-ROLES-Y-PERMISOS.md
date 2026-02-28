# 05 - Roles y Permisos (RBAC)

## Roles del Sistema

| Rol | Descripción |
|-----|-------------|
| `ADMIN` | Acceso total. Puede suplantar usuarios (impersonation) |
| `VENDEDOR` | Crear cotizaciones, ver reportes, gestionar evidencia |
| `FACTURACION` | Emitir y gestionar facturas, materialidad |
| `CONTABLE` | Reportes contables, auditoría, materialidad |
| `CXC` | Cuentas por cobrar, pagos, órdenes de compra |
| `REPRESENTANTE` | Representante legal de organización cliente |
| `GESTOR_NOM151` | Especialista en NOM-151 (fecha cierta) |
| `CLIENTE` | Acceso limitado (ver facturas propias) |

---

## Matriz de Acceso por Ruta

| Ruta | ADMIN | VENDEDOR | FACTURACION | CONTABLE | CXC | REPRESENTANTE | GESTOR_NOM151 | CLIENTE |
|------|-------|----------|-------------|----------|-----|---------------|---------------|---------|
| `/` (Dashboard) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/materialidad` | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/cotizaciones` | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `/ordenes-compra` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `/proformas` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/facturas` | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `/bancos` | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| `/evidencia` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/contratos` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/catalogos-sat` | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/settings` | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/security` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Sistema de Permisos Granular

La tabla `role_permissions` implementa permisos CRUD por pantalla:

```
role_permissions:
  role_id    → Nombre del rol
  screen_id  → ID de la pantalla/módulo
  can_view   → Puede ver (lectura)
  can_create → Puede crear registros
  can_edit   → Puede editar registros
  can_delete → Puede eliminar registros
```

### Cómo se cargan los permisos (App.tsx):
1. Usuario inicia sesión con Clerk
2. Se obtiene su perfil de `profiles` (incluye `role`)
3. Se consulta `role_permissions` filtrado por rol
4. Los permisos se aplican en el routing y en cada componente
5. Si `canView` es false, la ruta no se renderiza

---

## Admins Hardcoded

Dos usuarios tienen bypass de permisos (verificado en App.tsx):

```
- user_39fz5fO1nTqgiZdV3oBEevy2FfT
- user_39ldmMY70oeZqxolww1N55Ptvw6
```

Estos IDs de Clerk tienen acceso ADMIN independientemente del rol asignado en DB.

---

## Multi-tenancy

El sistema soporta múltiples organizaciones:

1. **Tabla `user_organization_access`**: Define a qué organizaciones puede acceder cada usuario
2. **Selector de organización**: El usuario elige con cuál organización trabajar
3. **RLS automático**: Las queries se filtran por `organization_id` usando el JWT
4. **Impersonation**: Los ADMIN pueden ver el sistema como otro usuario

### Flujo de acceso:
```
Usuario → Clerk Auth → Profile (con org principal)
    ↓
user_organization_access → Lista de orgs permitidas
    ↓
Selecciona org → Todas las queries filtradas por esa org
```
