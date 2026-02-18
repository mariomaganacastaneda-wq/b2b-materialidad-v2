# 📑 Guía Maestra de Módulos: B2B Materialidad

Este documento centraliza el funcionamiento de cada módulo del sistema, su propósito estratégico (Blindaje Fiscal) y su estado actual de desarrollo.

---

## 1. Dashboard (Panel de Control)
*   **¿Qué?**: Centro de mando visual y diagnóstico.
*   **¿Para qué?**: Para monitorear la salud fiscal y comercial de la organización en tiempo real.
*   **¿Cómo?**: Mediante indicadores clave de ventas y un sistema de semáforos para el cumplimiento de documentos.
*   **✅ Avance (Desarrollado)**:
    *   Cálculo de volumen de ventas cotizado.
    *   Monitor de cumplimiento (CSF): Alertas de documentos vencidos.
    *   Lista de actividad reciente sincronizada.
*   **🕒 Por hacer (Pendiente)**:
    *   Gráficas comparativas históricas.
    *   Filtros avanzados por vendedor o región.

---

## 2. Materialidad (Tablero de Control)
*   **¿Qué?**: Gestor del hilo conductor de la operación comercial-fiscal.
*   **¿Para qué?**: Para asegurar que cada venta tenga un sustento documental lógico y rastreable.
*   **¿Cómo?**: A través de un tablero tipo Kanban que agrupa proyectos por su estado de avance.
*   **✅ Avance (Desarrollado)**:
    *   Tablero interactivo con sincronización Supabase.
    *   Estados dinámicos (Borrador, Activo, Pendiente).
*   **🕒 Por hacer (Pendiente)**:
    *   Botón de descarga masiva del "Expediente Forense".

---

## 3. Cotizaciones y Proformas
*   **¿Qué?**: Motor de generación de preventas y proformas.
*   **¿Para qué?**: Para formalizar propuestas comerciales bajo estándares de cumplimiento SAT.
*   **¿Cómo?**: Usando un gestor inteligente que predice claves y unidades fiscales.
*   **✅ Avance (Desarrollado)**:
    *   **ProformaManager**: Motor de sugerencia automática de claves SAT y unidades.
    *   Generación de PDFs profesionales.
    *   Cálculo exacto de impuestos y retenciones.
*   **🕒 Por hacer (Pendiente)**:
    *   Interfaz de listado general de cotizaciones (actualmente acceso directo).

---

## 4. Facturación (CFDI)
*   **¿Qué?**: Control de comprobantes fiscales digitales.
*   **¿Para qué?**: Para validar que lo facturado sea idéntico a lo cotizado y ejecutado.
*   **¿Cómo?**: Vinculando UUIDs del SAT con proyectos específicos dentro del sistema.
*   **✅ Avance (Desarrollado)**:
    *   Listado de facturas por proyecto.
    *   Visibilidad de folios fiscales y montos totales.
*   **🕒 Por hacer (Pendiente)**:
    *   Conciliación automática con el portal del SAT (vía API).

---

## 5. Catálogos SAT
*   **¿Qué?**: Enciclopedia de normatividad fiscal integrada.
*   **¿Para qué?**: Para eliminar errores de clasificación que puedan causar multas o auditorías.
*   **¿Cómo?**: Mediante bases de datos actualizadas de actividades, productos, regímenes y listas negras.
*   **✅ Avance (Desarrollado)**:
    *   **100% Operativo**: 6 categorías (Actividades, Productos, Regímenes, Usos, Estatus 69-B, Versiones).
    *   Buscadores de alta velocidad.
*   **🕒 Por hacer (Pendiente)**:
    *   Exportación de catálogos personalizados a Excel.

---

## 6. Evidencia (Archivo Fotográfico y Documental)
*   **¿Qué?**: Repositorio de pruebas de existencia (Materialidad).
*   **¿Para qué?**: Para demostrar al SAT que los servicios realmente ocurrieron.
*   **¿Cómo?**: Organizando fotos, contratos y entregables ligados a un folio único.
*   **✅ Avance (Desarrollado)**:
    *   Arquitectura de datos y almacenamiento lista.
*   **🕒 Por hacer (Pendiente)**:
    *   Interfaz visual de galería y visualizador de archivos multimedia.

---

## 7. Reportes
*   **¿Qué?**: Generador de reportes de auditoría y gerenciales.
*   **¿Para qué?**: Para facilitar la toma de decisiones y la defensa ante inspecciones fiscales.
*   **¿Cómo?**: Consolidando toda la data del sistema en un solo reporte ejecutivo.
*   **✅ Avance (Desarrollado)**:
    *   Estructura lógica de reporteo en base de datos.
*   **🕒 Por hacer (Pendiente)**:
    *   Generador visual de documentos PDF de auditoría final.

---

## 8. Configuración
*   **¿Qué?**: Panel de administración y personalización.
*   **¿Para qué?**: Para adaptar el sistema a la identidad y estructura de cada empresa.
*   **¿Cómo?**: Ajustando parámetros de marca (logo/colores) y datos legales.
*   **✅ Avance (Desarrollado)**:
    *   Branding dinámico (el sistema cambia de color según el logo).
    *   Gestión de perfiles de empresa.
*   **🕒 Por hacer (Pendiente)**:
    *   Control de roles y permisos granulares por usuario.

---

### 📝 Resumen del Estatus General (V1.3)
El ecosistema **B2B Materialidad** ya cuenta con sus cimientos más críticos (Inteligencia Fiscal, Proformas y Catálogos) totalmente funcionales. El enfoque actual se centra en la **Evidencia Fotográfica** y la **Generación de Reportes Ejecutivos** para cerrar el ciclo de blindaje forense.
