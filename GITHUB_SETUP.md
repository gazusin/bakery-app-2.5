# Guía para Subir tu Proyecto a GitHub

He inicializado tu repositorio localmente y he creado el primer "commit" con todo tu código actual.

Para subirlo a la nube (GitHub) y tener un respaldo seguro, sigue estos pasos sencillos:

## Paso 1: Crear el Repositorio en GitHub
1. Ve a [github.com/new](https://github.com/new) e inicia sesión.
2. En **Repository name**, escribe un nombre (ej: `bakery-app-2.5`).
3. Elige si quieres que sea **Public** (visible para todos) o **Private** (solo tú).
4. **IMPORTANTE:** No marques ninguna casilla de "Initialize this repository with..." (ni README, ni .gitignore, ni License). Queremos un repositorio vacío.
5. Haz clic en **Create repository**.

## Paso 2: Conectar y Subir tu Código
Una vez creado, GitHub te mostrará una página con instrucciones. Busca la sección que dice **"…or push an existing repository from the command line"**.

Copia y pega los siguientes comandos (uno por uno) en tu terminal (PowerShell o CMD):

```bash
# 1. Conectar tu repositorio local con el de GitHub
# Reemplaza TU_USUARIO y TU_REPOSITORIO con los datos reales
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git

# 2. Renombrar la rama principal a 'main' (estándar actual)
git branch -M main

# 3. Subir tu código
git push -u origin main
```

Al ejecutar el último comando (`git push`), es posible que te pida iniciar sesión en una ventana emergente del navegador. Autoriza el acceso y listo.

## Paso 3: Verificar
Recarga la página de tu repositorio en GitHub. Deberías ver todos tus archivos y carpetas ahí.

---

### Nota sobre tu Identidad en Git
Para este primer paso, configuré un nombre genérico ("Bakery Admin") para poder guardar los cambios automáticamente. Si quieres configurar tu nombre real para futuros cambios, ejecuta estos comandos en la terminal:

```bash
git config user.name "Tu Nombre Real"
git config user.email "tu@email.com"
```
