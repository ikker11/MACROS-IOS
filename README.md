# MacroFit

App de control de macros. **Un mismo código** sirve para:
- **iPhone / iPad**: web app instalable (PWA) publicada con GitHub Pages.
- **Android**: app nativa (APK) que GitHub compila automáticamente con esos mismos archivos.

Cualquier cambio en la app se aplica a las dos versiones a la vez.

## Qué incluye
- **Hoy**: resumen con calorías y macros restantes (anillo y barras), comidas del día, agua y gráfica de 7 días. El perfil se abre con el botón redondo de arriba.
- **Diario**: página propia para registrar lo que comes; la franja (desayuno, almuerzo, comida, merienda, cena) se detecta por la hora. Añadir alimento se abre a pantalla completa, con 153 alimentos en 3D, por gramos o unidades.
- **Restaurante**: 90 platos con receta e imagen (15 batidos de proteína y smoothies, con y sin creatina, dulces sanos, comidas y cenas), ordenados según lo que te queda por comer.
- **Deporte**: rutinas personalizadas y biblioteca de ejercicios con animación de silueta (hombre o mujer) y el músculo resaltado; enlace a vídeo real; registro del gasto calórico (MET).
- **Coach**: asistente local que aprende de ti. Lee etiquetas nutricionales con la cámara (OCR en el propio móvil) y las guarda con nombre y sección; analiza fotos de platos con raciones visuales y te aconseja.
- **Perfil**: cálculo de macros (Mifflin-St Jeor), peso con gráfica, PIN y copia de seguridad.

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
- Iconos 3D de alimentos: [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji) (licencia MIT). Las imágenes de los platos y las animaciones de ejercicios se generan en la propia app.
- Lector de etiquetas: [Tesseract.js-core](https://github.com/naptha/tesseract.js-core) y datos de idioma [tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) (licencia Apache 2.0).
- El análisis de platos por foto es una estimación guiada (tú indicas qué hay y el tamaño); reconocer la comida automáticamente necesitaría una IA externa con internet.
- Los cálculos son orientativos y no sustituyen el consejo de un médico o dietista.
