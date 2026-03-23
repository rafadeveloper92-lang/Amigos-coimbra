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

## Deploy público fixo (GitHub Pages)

Este projeto agora está configurado para deploy automático no **GitHub Pages** via workflow:

- Arquivo: `.github/workflows/deploy-pages.yml`
- URL final (fixa): `https://<seu-usuario>.github.io/<seu-repositorio>/`

### Pré-requisitos no GitHub

1. Em **Settings > Pages**, selecione **Build and deployment = GitHub Actions**.
2. Em **Settings > Secrets and variables > Actions**, crie os secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

Depois disso, cada push em `main` (ou nesta branch de preview) publica automaticamente a versão online.
