// ============================================================
// TRACEPOINT — Server-side OpenAI Proxy API Route
// Proxies chat completion requests to OpenAI using server-side
// environment variables (the key is not exposed to the client).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

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

    // Use the env var. Even though it has NEXT_PUBLIC_ prefix, on the server
    // side it is accessible via process.env and the request originates from
    // the server (not the browser), so OpenAI won't block it.
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error('[/api/ai] OpenAI API key is not configured');
      return NextResponse.json(
        { error: 'OpenAI API key is not configured on the server' },
        { status: 500 }
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
      console.error(
        `[/api/ai] OpenAI returned ${openaiResponse.status}: ${errorText}`
      );
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
