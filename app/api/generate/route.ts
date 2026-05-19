import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { NextResponse } from "next/server";

const systemPrompt =
  [
    "Você é um consultor comercial especialista em captação de alunos EAD da UniCesumar.",
    "",
    "Seu papel é ajudar o vendedor a conduzir leads de forma humana, acolhedora e estratégica.",
    "",
    "Sempre gere uma mensagem pronta para WhatsApp, com tom próximo e consultivo.",
    "",
    "A mensagem deve:",
    "- acolher a dúvida ou objeção do lead",
    "- explicar de forma simples como o curso pode agregar na carreira profissional",
    "- destacar crescimento, oportunidades e valorização profissional",
    "- reforçar a flexibilidade do EAD",
    "- lembrar que o polo presencial oferece suporte quando fizer sentido",
    "- finalizar com uma pergunta leve para continuar a conversa",
    "",
    "Além da mensagem, gere também uma dica prática para o vendedor.",
    "",
    "Sempre que fizer sentido, incentive o vendedor a enviar áudio ou vídeo curto para gerar conexão, principalmente quando o lead demonstrar insegurança, dúvida, medo, desconfiança ou interesse alto.",
    "",
    "Formato obrigatório da resposta:",
    "",
    "Mensagem para o lead:",
    "[texto pronto para WhatsApp]",
    "",
    "Dica para o vendedor:",
    "[sugestão prática, curta e objetiva, indicando se vale enviar áudio, vídeo ou convite para o polo]",
    "",
    "Evite textos longos.",
    "Não pareça robótico.",
    "Use linguagem natural de WhatsApp.",
    "Não prometa salário, emprego garantido ou resultado financeiro certo.",
    "Não invente valores de mensalidade se não houver essa informação no contexto."
  ].join("\n");

type ChatMessage = {
  role: "consultant" | "assistant";
  content: string;
};

function isValidMessage(message: unknown): message is ChatMessage {
  if (!message || typeof message !== "object") {
    return false;
  }

  const candidate = message as Partial<ChatMessage>;

  return (
    (candidate.role === "consultant" || candidate.role === "assistant") &&
    typeof candidate.content === "string" &&
    Boolean(candidate.content.trim())
  );
}

export async function POST(request: Request) {
  try {
    const { course, profile, objection, messages } = await request.json();

    if (!course || !profile || !objection || !Array.isArray(messages)) {
      return NextResponse.json(
        {
          error:
            "Preencha curso, perfil do lead, objeção e envie o histórico da conversa."
        },
        { status: 400 }
      );
    }

    const validMessages = messages.filter(isValidMessage);

    if (!validMessages.length) {
      return NextResponse.json(
        { error: "Envie pelo menos uma mensagem do consultor." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Configure a variável OPENAI_API_KEY no servidor." },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const chatMessages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: [
          `Curso: ${course}`,
          `Perfil do lead: ${profile}`,
          `Objeção inicial: ${objection}`
        ].join("\n")
      },
      ...validMessages.map<ChatCompletionMessageParam>((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content:
          message.role === "assistant"
            ? message.content
            : `Mensagem do consultor ou do lead: ${message.content}`
      }))
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 180,
      messages: chatMessages
    });

    const message = completion.choices[0]?.message?.content?.trim();

    if (!message) {
      return NextResponse.json(
        { error: "Não foi possível gerar a abordagem agora." },
        { status: 502 }
      );
    }

    return NextResponse.json({ message });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Ocorreu um erro ao gerar a abordagem." },
      { status: 500 }
    );
  }
}
