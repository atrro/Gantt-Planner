# Vestas Planejamento - Gerador de Cronogramas

Aplicação 100% client-side (React + Vite + Tailwind). Não usa backend: os cronogramas salvos ficam no `localStorage` do navegador e podem ser exportados/importados como arquivo `.json`.

## Desenvolvimento

```sh
npm install
npm run dev     # http://localhost:8080
npm run build   # gera dist/ (estático, pode ser servido de qualquer pasta)
```

## Publicação (GitHub Pages)

1. Suba o projeto para um repositório GitHub (branch `main`).
2. Em Settings > Pages, selecione **Source: GitHub Actions**.
3. A cada push, o workflow `.github/workflows/deploy.yml` publica o site.
