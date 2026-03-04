# Ecosistema de Servidores MCP (Model Context Protocol) en Antigravity

Antigravity utiliza una combinación de servidores MCP (Model Context Protocol) para extender sus capacidades más allá del entorno interactivo de código, permitiendo orquestación de flujos de automatización, conexiones persistentes a bases de datos, generación visual e ingestión de documentación actualizada.

## 1. Context7 (Documentación en Vivo)
*   **Función**: Prevención de alucinaciones en modelos de lenguaje. Provee la última versión oficial documentada para el ecosistema Core (Supabase, React, Clerk, n8n) en crudo, con fragmentos de implementación (`query-docs` y `resolve-library-id`).
*   **Instalación / Ejecución**: Ejecutado universalmente vía `npx` en el caché de Node utilizando la clave API configurada (`npx -y @upstash/context7-mcp --api-key [...]`).
*   **Uso en Antigravity**: Obligatorio mediante los protocolos definidos en `GEMINI.md` para evitar errores en llamadas API por divergencia entre versiones (`react v19`, `clerk v5`, etc.).

## 2. Excalidraw (Renderización Gráfica)
*   **Función**: Proveer a los agentes IA de retroalimentación gráfica interactiva y capacidades de creación. Renderización SVG, inserción de formas, conversión de Mermaid a lienzo interactivo, exportaciones, diseño UI y diagrama de flujo.
*   **Instalación / Ejecución**: Modificado para correr bajo contexto local en NodeJS (`node c:/Proyectos/Memoria/B2B_Materialidad/mcp_excalidraw/dist/index.js`) para evitar las limitantes de WSL y Daemon de Docker en Windows.
*   **Uso en Antigravity**: Creación y validación de entidades, arquitectura cloud y wireframes con acceso DOM expuesto en el puerto 3000 de la terminal del usuario.

## 3. n8n-mcp (Orquestación Continua)
*   **Función**: Comunicación bidireccional entre la IA y la plataforma open-source n8n. Despliega webhooks, maneja cron-jobs, obtiene logs de fallas de nodos de n8n, y expone APIs privadas (Ej. n8n de la Instancia de Hostinger).
*   **Instalación / Ejecución**: Un ejecutable transpilado personalizado (`node c:/CarpetaOneDrive/OneDrive/MCP-N8N-Antigravity/n8n-mcp/dist/mcp/index.js`) acoplado usando variables de entorno que apuntan a Easypanel (n8n-n8n.5gad6x.easypanel.host).
*   **Uso en Antigravity**: Para depurar, encadenar y verificar flujos automatizados ("workflows") a distancia en lugar de entrar manualmente al editor web de n8n.

## 4. Subapase MCP Server (Infraestructura)
*   **Función**: Conexión nativa y de bajo nivel a los Proyectos en Supabase. Lectura del esquema de bases de datos, perfiles RLS, migración ascendente/descendente de DDL SQL, listado/despliegue de Edge Functions.
*   **Instalación / Ejecución**: Comando temporal vía `npx` de Supabase Labs (`npx -y @supabase/mcp-server-supabase@latest`).
*   **Uso en Antigravity**: Sincronización transparente cuando se requiere corregir permisos de RLS (Policies), analizar buckets de Storage o actualizar Deno Edge Functions de la suite *Materialidad B2B*.

## 5. Clerk Admin (Gestión de Identidades)
*   **Función**: Panel de control API administrado por el Agente. Verificación de JWT, inserción de nuevos `organizations`, control de invitaciones RBAC, baneo o recuperación de contraseñas de usuarios.
*   **Instalación / Ejecución**: Aplicación local Node alojada en `c:/Proyectos/Memoria/B2B_Materialidad/clerk-mcp/`.
*   **Uso en Antigravity**: Administrar la barrera de autenticación antes de que las peticiones peguen contra Supabase; crucial para gestionar el Auth Flow de la nueva versión web V2 Creada con Vite & React + Zustand.

## 6. NotebookLM MCP (Asistente de Conocimiento Experimental)
*   **Función**: Enlace entre el servidor MCP y Google NotebookLM. Capaz de agregar documentos en bruto (como esta misma investigación y manual), crear Notebooks nuevos, generar Podcasts de audio, Study Guides y gestionar respuestas de contexto sin saturar la memoria local del agente.
*   **Instalación / Ejecución**: Paquete de Python compilado y servido de forma nativa (`C:/Users/MARIO MAGAÑA/AppData/Local/Python/pythoncore-3.14-64/Scripts/notebooklm-mcp.exe`).
*   **Uso en Antigravity**: Sintetizar los reportes semanales, archivar auditorías de RLS que requieran contexto futuro, y generar recursos multi-medios como presentaciones o audios instructivos.

## 7. Github MCP Server (Colaboración Cíclica)
*   **Función**: Control del flujo de CI/CD. Lectura diferencial, listado de ramas, revisión de repositorios sin uso extensivo de git local bash, PR reviews automáticos.
*   **Instalación / Ejecución**: Vía NPM de ModelContextProtocol (`npx -y @modelcontextprotocol/server-github`).
*   **Uso en Antigravity**: Intervenciones programadas como respaldos de ramas, análisis de Issues en los repositorios o revisión de los repos open-source referenciados como `yctimlin/mcp_excalidraw`.

## 8. Stitch MCP (Integración de Plataformas Google)
*   **Función**: API de integraciones para el servicio Stitch remoto en Google, diseñado para tareas confidenciales o de alto rendimiento y conexión directa con el entorno Google (Stitch/GCP).
*   **Instalación / Ejecución**: Creado como un "remote mcp" en la nube (`npx -y mcp-remote https://stitch.googleapis.com/mcp`).
*   **Uso en Antigravity**: (Actual bloqueado `disabled: true` en la config local por defecto para preservar contexto seguro, en reserva).

---

Con esto, el Agente mantiene una autonomía multi-disciplinaria donde cada herramienta (`Context7` -> Reglas, `Supabase` -> Persistencia, `Excalidraw` -> Visualización) ejecuta un ciclo especializado que lo hace un modelo Full-Stack orquestador.
