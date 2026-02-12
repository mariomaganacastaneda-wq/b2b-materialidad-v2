---
description: Cómo ejecutar la aplicación web de B2B_Materialidad
---
Para poner en marcha la aplicación en tu entorno local, sigue estos pasos:

1.  **Abrir una Terminal**: Abre una terminal en la raíz del proyecto `c:\Proyectos\Memoria\B2B_Materialidad`.
2.  **Entrar a la carpeta web**:
    ```powershell
    cd web
    ```
3.  **Iniciar el Servidor de Desarrollo**:
    // turbo
    ```powershell
    npm run dev
    ```
4.  **Ver en el Navegador**: Una vez que la terminal indique que el servidor está listo, abre tu navegador en:
    [http://localhost:5173](http://localhost:5173)

### Notas:
- Las variables de entorno (`.env`) ya están configuradas con las credenciales de Supabase.
- El sistema utiliza **React + Vite**, por lo que los cambios que realices se verán reflejados instantáneamente (Hot Module Replacement).
