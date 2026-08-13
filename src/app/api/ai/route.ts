// ============================================================
// TRACEPOINT — Server-side OpenAI Proxy API Route
// Returns mock assessment when API key is not configured (Demo Mode).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { generateMockAIAssessment } from '@/lib/api/mock-data';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface RequestBody {
  messages: ChatMessage[];
  model?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { error: 'messages array is required and must not be empty' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;

    // --- DEMO MODE: Return mock AI assessment when key not configured ---
    if (!apiKey || !apiKey.trim()) {
      console.log('[/api/ai] DEMO MODE — returning mock AI assessment');

      // Extract basic info from the user message for mock generation
      const userMessage = body.messages.find(m => m.role === 'user')?.content || '';
      const phoneMatch = userMessage.match(/Phone:\s*(\S+)/i);
      const emailMatch = userMessage.match(/Email:\s*(\S+)/i);
      const countryMatch = userMessage.match(/Country:\s*(\S+)/i);

      const mockContent = generateMockAIAssessment({
        phone: phoneMatch?.[1] || '',
        email: emailMatch?.[1] || '',
        candidates: [],
        evidence: [],
        country: countryMatch?.[1] || '',
      });

      return NextResponse.json(
        { content: mockContent },
        { headers: { 'X-Mock': 'true' } }
      );
    }

    const model = body.model || 'gpt-4o';

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: body.messages,
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error(`[/api/ai] OpenAI returned ${openaiResponse.status}: ${errorText}`);
      return NextResponse.json(
        { error: `OpenAI API error: ${openaiResponse.status}` },
        { status: 502 }
      );
    }

    const data = await openaiResponse.json();
    const content = data.choices?.[0]?.message?.content || '';

    return NextResponse.json({ content });
  } catch (err) {
    console.error('[/api/ai] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
