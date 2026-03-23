<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/ffdf2977-00ff-4215-b0ea-3bd9ba550373

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## GitHub Pages (site no telefone)

Em cada **push** na branch `main`, o workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) faz **build** e publica em  
`https://rafadeveloper92-lang.github.io/Amigos-coimbra/`

**Configuração única no GitHub:** Repositório → **Settings** → **Pages** → **Build and deployment** → **Source:** **GitHub Actions** (não “Deploy from a branch”).

**Secrets opcionais** (Settings → Secrets and variables → Actions): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `GEMINI_API_KEY` — para o build embutir as mesmas chaves do `.env` local. Sem eles, o app pode usar os fallbacks do código.

**Nota:** o site em `github.io` é só o **frontend estático**. Chat de voz (Socket.IO) precisa do servidor Node (`npm run dev` no PC ou outro host).
