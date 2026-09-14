---
marp: true
theme: default
paginate: true
size: 16:9
---

# Configuración y activación de un MCP stdio en VS Code

## Objetivo

Explicar cómo activar un servidor MCP de tipo `stdio` en Visual Studio Code y cómo conectar un proyecto web a un MCP que vive en otro proyecto.

---

## 1. Qué es un MCP stdio

Un MCP de tipo `stdio` no es un servicio HTTP ni un puerto abierto.

Se ejecuta como un proceso hijo de VS Code:

- VS Code lo lanza
- le pasa variables de entorno
- se comunica con él por entrada/salida estándar

Por eso, normalmente no se arranca desde un navegador ni desde un puerto.

---

## 2. Dónde se declara el MCP

El fichero `.vscode/mcp.json` se interpreta en el workspace que está abierto en VS Code.

Si vas a trabajar desde el proyecto web, el fichero relevante es:

`C:\ws\web_películas\.vscode\mcp.json`

En ese caso, la configuración debe apuntar al script del proyecto servidor:

`C:\ws\curso_mcp_server\src\index.js`

---
Ejemplo de configuración para el proyecto web:

```json
{
  "servers": {
    "tmdb-movies": {
      "type": "stdio",
      "command": "node",
      "args": [
        "C:\\ws\\curso_mcp_server\\src\\index.js"
      ],
      "env": {
        "TMDB_API_KEY": "${input:tmdbApiKey}",
        "TMDB_LANGUAGE": "es-ES"
      }
    }
  },
  "inputs": [
    {
      "id": "tmdbApiKey",
      "type": "promptString",
      "description": "TMDB API Key",
      "password": true
    }
  ]
}
```

La ruta absoluta evita que `${workspaceFolder}` se resuelva dentro de `web_películas`.

El archivo `C:\ws\curso_mcp_server\.vscode\mcp.json` solo es necesario si también quieres que VS Code reconozca y arranque el MCP al abrir directamente el proyecto servidor.

---

## 3. ¿Es necesario arrancarlo manualmente?

Para un MCP `stdio`, normalmente no.

VS Code lo lanza automáticamente cuando se activa el servidor desde la configuración del editor.

Solo hace falta arrancarlo a mano si quieres:

- depurar errores
- ver logs
- probarlo sin depender de VS Code

Ejemplo manual:

```powershell
cd C:\ws\curso_mcp_server
node src/index.js
```

---

## 4. Cómo conectar un proyecto web a un servidor MCP externo

Si el proyecto web quiere usar un MCP que está en otro proyecto, debe apuntar al ejecutable de ese proyecto.

La configuración completa aparece en la diapositiva anterior. La diferencia esencial frente a la configuración del proyecto servidor es la ruta de `args`:

- En el proyecto servidor: `${workspaceFolder}/src/index.js`.
- En el proyecto web: `C:\\ws\\curso_mcp_server\\src\\index.js`.

Esto indica a VS Code:

- ejecuta el proceso del servidor MCP
- apunta al archivo real del proyecto `curso_mcp_server`
- usa la clave TMDB disponible en la sesión

---

## 5. Pasos para activar el MCP en VS Code

1. Asegúrate de que el archivo `.vscode/mcp.json` existe en el proyecto que quieres activar.
2. Verifica que la ruta al script del MCP es correcta.
3. Abre VS Code.
4. Abre la Paleta de Comandos.
5. Busca:
   - `MCP: List Servers`
   - o `MCP: Open User Configuration`
6. Comprueba que aparece el servidor configurado, por ejemplo `tmdb-movies`.
7. Si no lo aparece, recarga VS Code o reinicia la ventana.
8. Una vez visible, VS Code lo lanza y el servidor queda disponible para sus tools.

---

## 6. Cuándo es necesario el archivo del servidor

### No es obligatorio para usarlo desde el proyecto web

El fichero:

`C:\ws\curso_mcp_server\.vscode\mcp.json`

no es imprescindible para que `web_películas` use el MCP. El archivo del proyecto web puede arrancar directamente:

`C:\ws\curso_mcp_server\src\index.js`

Sí es útil si abres `curso_mcp_server` como workspace independiente y quieres gestionarlo desde ese proyecto.

### El proyecto web no necesita copiar el código

No hace falta duplicar la implementación del MCP en el proyecto web.

Solo hace falta configurarlo para que ejecute el servidor que ya existe en el otro proyecto.

---

## 7. Resumen

- Un MCP `stdio` se ejecuta desde VS Code, no como un servicio HTTP.
- Basta con una declaración en el workspace desde el que quieres usar el MCP.
- El proyecto web puede apuntar al servidor externo usando una ruta absoluta al script `src/index.js`.
- Los dos archivos pueden tener `env` e `inputs` iguales, pero no deben confundirse: la ruta relativa del servidor y la ruta absoluta del proyecto web cumplen funciones distintas.
- En el flujo normal, no hay que arrancarlo manualmente desde la consola.

---

## 8. Recomendación final

Lo más práctico es abrir `web_películas` y declarar allí el servidor con la ruta absoluta al script de `curso_mcp_server`.

Si usas un workspace multi-root, conserva una sola declaración activa del servidor para evitar duplicados con el mismo nombre.

De este modo, VS Code gestiona el arranque del proceso y tú puedes centrarte en el desarrollo de la app web.

---

# Fin
