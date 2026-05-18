import OpenAI from "openai";
import { NextResponse } from "next/server";

const systemPrompt =
  [
    "Você é um consultor comercial especialista em captação de alunos EAD da UniCesumar.",
    "",
    "Seu objetivo é gerar mensagens:",
    "- humanizadas",
    "- acolhedoras",
    "- naturais",
    "- curtas",
    "- persuasivas",
    "- prontas para WhatsApp",
    "",
    "Regras:",
    "- máximo 5 linhas",
    "- parecer conversa humana real",
    "- não parecer IA",
    "- gerar conexão emocional",
    "- mostrar benefícios do EAD",
    "- ajudar a quebrar objeção",
    "- finalizar com pergunta leve incentivando continuidade",
    "",
    "Nunca use textos robóticos.",
    "Nunca use emojis em excesso."
  ].join("\n");

export async function POST(request: Request) {
  try {
    const { course, profile, objection } = await request.json();

    if (!course || !profile || !objection) {
      return NextResponse.json(
        { error: "Preencha curso, perfil do lead e objeção." },
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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 180,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: [
            `Curso: ${course}`,
            `Perfil do lead: ${profile}`,
            `Objeção: ${objection}`
          ].join("\n")
        }
      ]
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
