# Contribuir a Adopkia

Gracias por ayudar a mejorar la plataforma. Este documento define el flujo de
trabajo para cambios en el backend Django y el portal React + TypeScript.

## Antes de empezar

1. Revisa los issues existentes y confirma el alcance del cambio.
2. Para errores, enlaza el issue que describe el problema. Para trabajo nuevo,
   crea o acuerda un issue antes de implementar.
3. Lee las instrucciones de instalación y pruebas del [README](./README.md).
4. No incluyas credenciales, datos personales, archivos `.env` ni bases locales.

## Ramas

`main` contiene el trabajo integrado y no recibe cambios directos. Actualízala
antes de crear una rama:

```sh
git switch main
git pull --ff-only origin main
```

Usa una rama independiente para cada cambio:

- `fix/<issue>-<descripcion-corta>` para corregir errores, por ejemplo
  `fix/36-vaccine-selector`.
- `feature/<descripcion-corta>` para funcionalidades, por ejemplo
  `feature/exportar-reportes`.
- `docs/<descripcion-corta>` para documentación, por ejemplo
  `docs/guia-de-contribucion`.

Créala desde `main` actualizado:

```sh
git switch -c fix/36-vaccine-selector
```

No mezcles cambios sin relación en una misma rama. Si una corrección necesita
una migración de base de datos, incluye la migración y actualiza las pruebas y
la documentación del esquema que correspondan.

## Commits

Usa mensajes breves y descriptivos con el tipo de cambio:

```text
fix: mostrar vacunas en recordatorios de adopción
feat: agregar filtro por fecha
refactor: extraer validación compartida
test: cubrir permisos del panel
docs: documentar el proceso de contribución
```

Escribe el asunto en imperativo o como descripción concreta, evita mensajes
genéricos como `cambios` o `arreglo`, y no combines varios temas en un commit.

## Pull Requests

Abre un Pull Request hacia `main` desde cada rama. Incluye:

1. El problema y el comportamiento esperado.
2. El issue relacionado, usando `Closes #<número>` cuando corresponda.
3. Un resumen de la solución y de cualquier decisión relevante.
4. Los comandos ejecutados y sus resultados.
5. Capturas o evidencia cuando el cambio afecte la interfaz.

Antes de solicitar integración:

- Ejecuta las pruebas y verificaciones relevantes indicadas en el README.
- Revisa el diff y confirma que no contiene secretos ni archivos generados.
- Resuelve los fallos de CI y atiende las observaciones de revisión.

Integra el cambio mediante el Pull Request cuando las verificaciones requeridas
pasen. No hagas push de credenciales ni uses `--force` sobre ramas compartidas.

## Versiones y changelog

Adopkia usa versiones semánticas `MAJOR.MINOR.PATCH`: aumenta MAJOR ante
cambios incompatibles, MINOR ante funcionalidad compatible y PATCH ante
correcciones compatibles. Actualiza `CHANGELOG.md` al preparar una versión y
crea un tag `vX.Y.Z` después de integrar los cambios de lanzamiento.
