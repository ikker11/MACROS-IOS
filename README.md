# MacroFit

App de control de macros. **Un mismo código** sirve para:
- **iPhone / iPad**: web app instalable (PWA) publicada con GitHub Pages.
- **Android**: app nativa (APK) que GitHub compila automáticamente con esos mismos archivos.

Cualquier cambio en la app se aplica a las dos versiones a la vez.

## Qué incluye
- **Hoy**: calorías y macros restantes (anillo y barras) que se actualizan al añadir cada alimento; la franja (desayuno, almuerzo, comida, merienda, cena) se detecta por la hora. Agua y gráfica de 7 días.
- **Añadir alimento**: 135 alimentos saludables, por gramos o por unidad, favoritos, recientes y alimentos propios.
- **Restaurante**: 44 platos y snacks con ilustración, receta paso a paso y ración ajustada a tus macros. Puedes poner tu propia foto de cada plato y abrir fotos reales del plato en internet.
- **Deporte**: rutinas personalizadas (casa o gimnasio, 2-6 días, nivel, lesiones), biblioteca de ejercicios con fotos y animación del movimiento, vídeo de cada ejercicio (se abre en YouTube) y registro del gasto calórico (fórmula MET).
- **Coach**: asistente local, sin internet ni coste, que aprende de tus registros y de lo que le cuentas.
- **Perfil**: cálculo de macros (Mifflin-St Jeor), peso con gráfica, PIN y copia de seguridad.

## Archivos
| Archivo | Para qué |
|---|---|
| index.html, styles.css, app.js, coach.js, data.js, ex-img.js, manifest.json, sw.js, icon-*.png | La app (iPhone y Android) |
| android-build.sh | Genera el proyecto Android a partir de la app |
| macrofit.keystore | Firma fija del APK (para que las actualizaciones se instalen encima sin perder datos) |
| android.yml | Instrucciones para que GitHub compile el APK (va en `.github/workflows/android.yml`) |

## Publicar (desde la tablet, con el navegador)
1. En GitHub crea un repositorio **público** nuevo, por ejemplo `MACROFIT`.
2. **Add file → Upload files** y sube todos los archivos sueltos de la carpeta (sin carpetas).
3. **Add file → Create new file**. En el nombre escribe exactamente `.github/workflows/android.yml`, pega dentro el contenido del archivo `android.yml` y pulsa **Commit changes**.
4. **iPhone**: Settings → Pages → Branch `main` / `(root)` → Save. La app queda en `https://TU-USUARIO.github.io/MACROFIT/`. En Safari: Compartir → *Añadir a pantalla de inicio*.
5. **Android**: abre la pestaña **Actions** y espera a que el proceso «App Android» salga en verde (unos 5 minutos). Después ve a **Releases** (columna derecha de la página del repositorio) → la última versión → descarga **MacroFit.apk** y ábrelo. La primera vez Android te pedirá permitir instalar apps de esa fuente.

## Actualizar sin perder datos
- Sube el archivo modificado con el mismo nombre. GitHub compila solo un APK nuevo con número de versión mayor; instálalo encima del anterior y tus datos se conservan.
- Para el iPhone, sube también `sw.js` con el número de `VERSION` aumentado (v2 → v3) para que el móvil descargue la versión nueva.
- Los datos viven en el dispositivo (no en GitHub). Haz de vez en cuando *Perfil → Guardar copia de seguridad*, sobre todo antes de cambiar de móvil.

## Notas
- La firma del APK está en el repositorio público. Para una app personal no es un problema; solo significa que alguien podría firmar un APK con la misma firma, así que instala MacroFit solo desde tu propio repositorio.
- Imágenes de ejercicios: [Free Exercise DB](https://github.com/yuhonas/free-exercise-db), dominio público. Las ilustraciones de los platos se generan en la propia app.
- Los cálculos son orientativos y no sustituyen el consejo de un médico o dietista.
