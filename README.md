# Central Comercial IA EAD

Aplicacao web em Next.js + Tailwind para conduzir conversas comerciais com leads interessados em cursos EAD da UniCesumar.

O fluxo funciona como um chat: o consultor informa curso, perfil do lead e objecao inicial, gera a primeira abordagem e pode continuar enviando duvidas ou respostas do lead. A IA considera o historico da conversa antes de responder.

## Configuracao

1. Instale as dependencias:

```bash
npm install
```

2. Crie um arquivo `.env.local` na raiz do projeto:

```bash
OPENAI_API_KEY=sua_chave_da_openai
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anon_publica
```

Use a URL base do projeto Supabase em `NEXT_PUBLIC_SUPABASE_URL`, no formato `https://seu-projeto.supabase.co`. Nao use a URL REST `https://seu-projeto.supabase.co/rest/v1`, pois o Supabase Auth precisa chamar `/auth/v1`.

3. Inicie o ambiente local:

```bash
npm run dev
```

4. Acesse `http://localhost:3000`.

## Seguranca

A chave da OpenAI fica apenas no backend, dentro da rota `app/api/generate/route.ts`, usando a variavel de ambiente `OPENAI_API_KEY`.

O Supabase usa Auth por e-mail e senha. A tabela `profiles` guarda o papel de cada pessoa (`admin` ou `consultor`) e as tabelas `conversations` e `messages` usam `user_id` com RLS.

Para habilitar o dashboard gerencial, aplique a migracao:

```sql
supabase/migrations/202605220001_admin_dashboard_rls.sql
```

Depois promova os usuarios administradores no Supabase SQL Editor:

```sql
update public.profiles
set role = 'admin'
where email = 'admin@exemplo.com';
```

Usuarios `admin` veem todos os usuarios, conversas, mensagens, ranking e analytics. Usuarios `consultor` continuam vendo apenas os proprios dados.
