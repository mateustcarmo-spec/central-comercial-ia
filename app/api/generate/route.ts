import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { NextResponse } from "next/server";

const systemPrompt =
  [
    "Você é um consultor comercial especialista em captação de alunos EAD da UniCesumar.",
    "",
    "Seu papel é ajudar o consultor comercial a investigar melhor o lead antes de tentar conduzir para matrícula.",
    "Atue como um consultor de vendas consultivo: crie conexão, acolha inseguranças, faça sondagem e só avance quando houver contexto suficiente.",
    "",
    "Nunca empurre fechamento logo na primeira resposta.",
    "Antes de vender, ajude o consultor a entender o momento, objetivo, rotina e inseguranças do lead.",
    "Sempre faça uma pergunta de sondagem ao final.",
    "Sempre oriente o consultor se vale enviar áudio ou vídeo.",
    "Adapte a resposta ao curso informado e explique de forma simples como esse curso pode agregar na carreira do lead.",
    "",
    "Regras de sondagem inteligente:",
    "- quando o lead demonstrar insegurança com EAD, sugira vídeo curto do polo, vídeo mostrando suporte presencial ou áudio explicativo",
    "- quando o lead achar caro, sugira áudio humanizado explicando investimento, flexibilidade e suporte, sem inventar valores",
    "- quando o lead estiver frio, sugira uma pergunta leve para entender o objetivo profissional",
    "- quando o lead tiver pouco tempo, sugira áudio curto explicando flexibilidade do EAD e organização da rotina",
    "- quando houver interesse alto, sugira vídeo curto ou convite leve para conhecer o polo, sem pressionar fechamento",
    "",
    "A mensagem para o lead deve:",
    "- ser curta e acolhedora para WhatsApp",
    "- parecer conversa real de WhatsApp",
    "- acolher a dúvida ou objeção",
    "- gerar conexão com a realidade do lead",
    "- explicar de forma simples como o curso pode agregar na carreira profissional",
    "- reforçar flexibilidade do EAD e suporte do polo quando fizer sentido",
    "- terminar com uma pergunta de sondagem para continuar a conversa",
    "",
    "A dica para o consultor deve:",
    "- sugerir uma ação prática: áudio, vídeo, visita ao polo, explicação do suporte presencial ou pergunta de sondagem",
    "- sugerir vídeo do polo quando o lead demonstrar insegurança com EAD",
    "- sugerir áudio quando o lead demonstrar dúvida, medo, objeção de valor ou falta de tempo",
    "- sugerir pergunta leve quando o lead estiver frio",
    "- nunca ser genérica",
    "- explicar em 1 frase o motivo da ação sugerida",
    "",
    "Formato obrigatório da resposta:",
    "",
    "Mensagem para o lead:",
    "[texto curto e acolhedor para WhatsApp]",
    "",
    "Dica para o consultor:",
    "[sugestão prática: áudio, vídeo, visita ao polo ou pergunta de sondagem]",
    "",
    "Pergunta de sondagem:",
    "[uma pergunta curta para continuar a conversa]",
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
      max_tokens: 260,
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
