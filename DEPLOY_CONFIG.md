# Configurações de Deploy - REALIZE CRM

Siga estas instruções para colocar o sistema em pleno funcionamento.

## 1. Banco de Dados (Neon.tech)
1. Crie um projeto no [Neon](https://neon.tech).
2. Copie a **Connection String** (PostgreSQL).
3. Salve esta URL para o próximo passo.

## 2. Backend (Render.com)
1. Crie um novo **Web Service** no Render.
2. Conecte seu repositório GitHub.
3. Configure:
   - **Environment**: `Docker`
   - **Dockerfile Path**: `artifacts/api-server/Dockerfile`
   - **Context**: `.` (Raiz do repositório)
4. Adicione as **Environment Variables**:
   - `DATABASE_URL`: (A URL do Neon que você copiou)
   - `SESSION_SECRET`: (Uma senha longa e aleatória)
   - `FRONTEND_URL`: `https://seu-projeto.vercel.app` (A URL do seu frontend no Vercel)
   - `NODE_ENV`: `production`
   - `PORT`: `8080`

## 3. Frontend (Vercel)
No painel do Vercel, em **Settings > Environment Variables**, adicione:
- `VITE_API_URL`: `https://seu-backend.onrender.com` (A URL que o Render vai te dar)

---
**Nota Importante:** Após configurar a `VITE_API_URL` no Vercel, você precisará fazer um novo **Redeploy** para que o código do frontend reconheça o novo endereço do servidor.
