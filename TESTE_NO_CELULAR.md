# Testar no celular (login + voz)

O app precisa do **mesmo servidor** no PC (`npm run dev`). No GitHub Pages **não há** servidor de voz; use uma das opções abaixo.

---

## Opção A — Mesmo Wi‑Fi (mais simples)

1. No PC, inicia o projeto:
   ```bash
   npm run dev
   ```
2. Descobre o **IPv4** do Wi‑Fi no Windows:
   ```powershell
   ipconfig
   ```
   Procura algo como `192.168.x.x` na tua ligação Wi‑Fi.
3. No **celular** (ligado ao **mesmo Wi‑Fi** que o PC), abre o browser em:
   ```text
   http://192.168.x.x:3000
   ```
   (substitui pelo teu IP).
4. Se o Windows pedir, **permite** o Node.js na **Firewall** para rede privada, porta **3000**.
5. No **Supabase** → **Authentication** → **URL Configuration** → **Redirect URLs**, adiciona:
   ```text
   http://192.168.x.x:3000/**
   ```
   (o mesmo IP que usaste no telemóvel). Guarda.

Assim o **login** e a **voz** usam o mesmo endereço que o servidor no PC.

---

## Opção B — Túnel (se A não der: rede diferente ou bloqueio HTTP)

Ferramentas gratuitas expõem o `localhost:3000` com um **HTTPS** na internet:

- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) (grátis)  
- [ngrok](https://ngrok.com/) (plano gratuito)

Depois de subir o túnel, abre no celular o URL que ele mostrar (ex.: `https://xxxx.trycloudflare.com`).

No **Supabase** → **Redirect URLs**, adiciona esse URL com `/**` no fim.

**Nota:** o URL do túnel pode mudar cada vez (no plano grátis). Sempre que mudar, atualiza o Supabase ou usa de novo o mesmo comando.

---

## Resumo

| Onde abres | Login Supabase | Voz (Socket.IO) |
|------------|----------------|-----------------|
| `http://IP-DO-PC:3000` | Sim, se o IP estiver no Supabase | Sim |
| `github.io` | Só com secrets no build | **Não** (sem backend) |

Para **só testar**, usa a **Opção A** sempre que possível.
