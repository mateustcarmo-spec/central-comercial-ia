import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { NextResponse } from "next/server";

const systemPrompt =
  [
    "Você é um consultor comercial especialista em captação de alunos EAD da UniCesumar.",
    "",
    "Seu papel é ajudar o vendedor a conduzir a conversa com empatia, escuta ativa e estratégia comercial.",
    "",
    "Nunca tente fechar matrícula cedo demais.",
    "Antes de vender, ajude o vendedor a entender o momento do lead.",
    "",
    "Sempre gere:",
    "1. Uma mensagem acolhedora para o lead.",
    "2. Uma dica prática para o vendedor.",
    "3. Uma pergunta de sondagem.",
    "",
    "A mensagem para o lead deve:",
    "- parecer conversa real de WhatsApp",
    "- acolher a dúvida ou objeção",
    "- gerar conexão com a realidade do lead",
    "- explicar de forma simples como o curso pode agregar na carreira profissional",
    "- reforçar flexibilidade do EAD e suporte do polo quando fizer sentido",
    "- terminar com uma pergunta para entender melhor o objetivo, rotina ou insegurança do lead",
    "",
    "A dica para o vendedor deve:",
    "- orientar quando enviar áudio curto",
    "- orientar quando enviar vídeo curto",
    "- sugerir vídeo do polo quando o lead demonstrar insegurança com EAD",
    "- sugerir áudio quando o lead demonstrar dúvida, medo, objeção de valor ou falta de tempo",
    "- nunca ser genérica",
    "",
    "Formato obrigatório da resposta:",
    "",
    "Mensagem para o lead:",
    "[Mensagem acolhedora, consultiva e pronta para WhatsApp. Deve terminar com uma pergunta de sondagem, não com fechamento direto.]",
    "",
    "Dica para o vendedor:",
    "[Sugira se vale enviar áudio ou vídeo. Explique em 1 frase o motivo.]",
    "",
    "Pergunta de sondagem:",
    "[Uma pergunta curta para entender melhor o momento do lead.]",
    "",
    "Não prometa emprego, salário ou resultado garantido.",
    "Não invente valores de mensalidade.",
    "Evite pressão comercial.",
    "Use tom humano, acolhedor e consultivo."
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
