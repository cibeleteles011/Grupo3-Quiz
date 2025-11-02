# Grupo3-Quiz

Aplicação de quiz estilo Kahoot com Node.js, Express e Socket.IO. Permite criar salas com PIN, entrada de jogadores (inclusive após o início), perguntas em tempo real, placar e seleção de avatares. Inclui QR Code e suporte a acesso pela rede local e por túnel público.

## Rodando localmente
- Pré-requisitos: Node.js 18+
- Instalar dependências:
```bash
npm install
```
- Iniciar o servidor:
```bash
npm start
```
- Acessos:
  - Host: http://localhost:3000/host.html
  - Jogadores (mesma rede): use o IP mostrado no Host (ex.: http://SEU_IP:3000/player.html)

## Acesso público temporário (opcional)
Você pode abrir um túnel para compartilhar o jogo fora da sua rede:
- LocalTunnel (via script `tunnel.js`):
```bash
npm install
node tunnel.js
```
O terminal mostrará uma URL como `https://seu-subdominio.loca.lt`. Use:
- Host: `https://.../host.html`
- Jogadores: `https://.../player.html`

## Deploy permanente (Render)
1. Faça o push do projeto para o GitHub.
2. Acesse https://render.com → New + → Blueprint → conecte o repositório.
3. Render lerá `render.yaml` e criará o serviço automaticamente:
   - Build: `npm install`
   - Start: `node server.js`
4. Após o deploy, use a URL pública do Render:
   - Host: `https://seuapp.onrender.com/host.html`
   - Jogadores: `https://seuapp.onrender.com/player.html`

Observações:
- Socket.IO já está com CORS liberado para funcionar com domínios públicos.
- `engines.node >= 18` definido em `package.json`.

## Estrutura
- `server.js` — servidor Express + Socket.IO
- `public/` — arquivos estáticos
  - `index.html`, `host.html`, `player.html`
  - `styles.css`
  - `js/host.js`, `js/player.js`, `js/quiz.js`
- `render.yaml` — configuração do Render
- `tunnel.js` — abre LocalTunnel para URL pública temporária

## Personalização rápida
- Altere perguntas em `public/js/quiz.js` ou cole JSON no Host.
- Cores/estilos em `public/styles.css`.

## Licença
Uso educacional. Ajuste conforme sua necessidade.
