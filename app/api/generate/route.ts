import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { NextResponse } from "next/server";

const systemPrompt =
  "Você é um consultor comercial especialista em captação de alunos EAD da UniCesumar. Responda sempre como apoio ao consultor comercial, com mensagens curtas, humanas, naturais e prontas para WhatsApp. Considere o curso, perfil do lead, objeção inicial e todo o histórico da conversa. Nunca faça textos longos. No máximo 5 linhas. Sempre conduza para o próximo passo da matrícula.";

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
