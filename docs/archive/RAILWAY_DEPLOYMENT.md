# Railway Deployment Configuration

# Railway automatically detects Next.js, but this README clarifies the setup.

## Key Points

- El archivo `railway.json` define los comandos de build y start.
- El script `start` en `package.json` usa el puerto `$PORT` requerido por Railway.
- Configura variables de entorno en el panel de Railway si usas claves API, endpoints, etc.
- No es necesario eliminar `vercel.json`, pero Railway lo ignora.

## Estructura recomendada

- railway.json
- package.json (con `start: next start -p $PORT`)
- .env.production (opcional, para variables locales)

## Despliegue

1. Haz push a tu repo conectado a Railway.
2. Railway ejecutará `npm run build` y luego `npm start` automáticamente.
3. Accede a tu app desde el dominio que te da Railway.

Para más detalles: https://docs.railway.com/config-as-code
