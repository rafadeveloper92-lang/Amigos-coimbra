# Gerar APK (Android)

Usamos [Capacitor](https://capacitorjs.com/) para embutir o site React no WebView nativo.

---

## Opção A — Sem Android Studio (recomendado)

O repositório tem um workflow **Build Android APK** no GitHub Actions.

1. No GitHub: **Settings → Secrets and variables → Actions** — confirma que existem:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
2. Faz **push** deste código para `main` (inclui `.github/workflows/build-apk.yml`).
3. Abre **Actions** → **Build Android APK** → **Run workflow**.
4. Quando ficar verde, abre o job → secção **Artifacts** → descarrega **amigos-coimbra-debug** (ficheiro `.apk`).

Não precisas de instalar Android Studio no PC.

Se o workflow **falhar** no GitHub (SDK/Gradle), é normal — **a opção mais fiável** é a **Opção B** no teu PC.

---

## Opção B — Com Android Studio no PC

### O que precisas

1. **Node.js** (já tens)
2. **Android Studio** — [download](https://developer.android.com/studio)  
   - Na instalação, marca **Android SDK**, **SDK Platform**, **Android Virtual Device**
3. Variável de ambiente **ANDROID_HOME** (o Android Studio costuma configurar; senão aponta para a pasta do SDK, ex.: `C:\Users\...\AppData\Local\Android\Sdk`)

### Passos (primeira vez)

Na pasta do projeto:

```powershell
npm install
npx cap add android
```

(Isto cria a pasta `android/`. Só precisas uma vez.)

## Build web + sincronizar com o projeto Android

Garante um ficheiro **`.env`** na raiz com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (o APK embute estas chaves no build).

```powershell
npm run build:capacitor
```

Isto faz `vite build` com `base` correto para o APK e copia `dist` para o projeto Android.

## Abrir no Android Studio e gerar o APK

```powershell
npm run android:open
```

No Android Studio:

1. Espera o Gradle sincronizar.
2. **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**  
   - Ou **Generate Signed Bundle / APK** se fores publicar na Play Store.
3. O ficheiro `.apk` aparece em `android/app/build/outputs/apk/...`

## Permissões (microfone / voz)

Se a voz não pedir microfone, em `android/app/src/main/AndroidManifest.xml` confirma que existem:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

(O template do Capacitor já inclui `INTERNET`; as outras podes acrescentar.)

## Servidor de voz (Socket.IO)

O APK é **só o frontend**. Para voz em tempo real, o telemóvel precisa de alcançar o teu backend (URL pública com `VITE_SOCKET_URL` no `.env` antes do `build:capacitor`, ou túnel tipo ngrok).

## Nome e ícone da app

- **Nome / id:** `capacitor.config.ts` (`appName`, `appId`)
- **Ícone:** [Capacitor assets](https://capacitorjs.com/docs/guides/splash-screens-and-icons) ou plugin `@capacitor/assets`
