# Painel de Pesquisa — Dashboard

Este é o painel de visualização de dados da pesquisa de satisfação integrado com o MongoDB.

## Pré-requisitos

- **Node.js** (versão 18 ou superior recomendado)
- **MongoDB** (acesso à internet para conectar ao cluster Atlas padrão configurado em `db.js` ou string de conexão customizada)

## Configuração

A string de conexão do banco de dados e a porta do servidor podem ser configuradas via variáveis de ambiente (opcional):

- `MONGO_URI`: String de conexão do MongoDB (se não fornecida, usa o cluster Atlas padrão).
- `MONGO_DB`: Nome do banco de dados (padrão: `pesquisa`).
- `PORT`: Porta de execução do servidor Express (padrão: `3000`).

## Como Executar

1. **Instale as dependências:**
   ```bash
   npm install
   ```

2. **Inicie o servidor:**
   ```bash
   npm run dev
   ```
   *Ou execute em modo de produção:*
   ```bash
   npm start
   ```

3. **Acesse no navegador:**
   Abra http://localhost:3000.
