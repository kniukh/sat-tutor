import { NextResponse } from "next/server";
import { generateTutorExplanation } from "@/services/ai/tutor.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      selectedText,
      passageText,
    }: {
      selectedText: string;
      passageText: string;
    } = body;

    if (!selectedText?.trim() || !passageText?.trim()) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const explanation = await generateTutorExplanation({
      selectedText: selectedText.trim(),
      passageText: passageText.trim(),
    });

    return NextResponse.json({ ok: true, data: { explanation } });
  } catch (error: any) {
    console.error("POST /api/ai/tutor error", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to generate explanation" },
      { status: 500 }
    );
  }
}
