# Homelab (PWA)

Painel de saúde do homelab pro celular/tablet. Site estático (HTML/CSS/JS puro), sem build.
Lê o JSON do `health-agent` (pasta `homelab/health-agent`) pela tailnet.

## Publicar (GitHub Pages)
1. Crie um repo no GitHub e suba este conteúdo na `main`.
2. Em **Settings → Pages → Source**, escolha **GitHub Actions**. O workflow publica a cada push.
3. O endereço sai como `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.
   No `ALLOWED_ORIGIN` do agente vai só a origem: `https://SEU-USUARIO.github.io`.

## Instalar no aparelho
- **iPhone (Safari):** Compartilhar → *Adicionar à Tela de Início*.
- **Android (Chrome):** menu ⋮ → *Instalar app*.
- Instale o **Tailscale** no aparelho e deixe conectado. Na 1ª abertura, informe a URL do agente e o token.

## Segurança
URL e token ficam só no `localStorage` do aparelho (nada no repo). O agente só é alcançável pela tailnet.
