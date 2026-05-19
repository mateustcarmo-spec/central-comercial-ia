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
```

3. Inicie o ambiente local:

```bash
npm run dev
```

4. Acesse `http://localhost:3000`.

## Seguranca

A chave da OpenAI fica apenas no backend, dentro da rota `app/api/generate/route.ts`, usando a variavel de ambiente `OPENAI_API_KEY`.
