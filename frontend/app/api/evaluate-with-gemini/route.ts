// frontend/app/api/evaluate-with-gemini/route.ts

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { question, answer, role, difficulty } = await request.json();
    
    const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not configured');
      return NextResponse.json({ error: 'Gemini not configured' }, { status: 500 });
    }
    
    const prompt = `You are an expert interviewer evaluating a ${role} candidate's answer to a ${difficulty} question.

Question: ${question}

Candidate's Answer: ${answer}

Provide a JSON response with:
- score (1-10)
- strengths (array of 1-3 specific strengths)
- weaknesses (array of 1-3 specific weaknesses)
- suggestedAnswer (brief guidance on how to improve)
- summary (1 sentence overall assessment)

Return ONLY valid JSON. No markdown, no explanation.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          temperature: 0.3, 
          maxOutputTokens: 500,
          topP: 0.9
        }
      })
    });
    
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    
    // Clean markdown if present
    const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    try {
      const result = JSON.parse(cleanText);
      return NextResponse.json({
        score: result.score || 5,
        strengths: result.strengths || [],
        weaknesses: result.weaknesses || [],
        suggestedAnswer: result.suggestedAnswer || "Review the ideal answer for guidance.",
        summary: result.summary || "Your answer has been evaluated."
      });
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', cleanText);
      return NextResponse.json({ 
        score: 5,
        strengths: [],
        weaknesses: ["Could not analyze answer"],
        suggestedAnswer: "Please try again or provide more detail.",
        summary: "Evaluation temporarily unavailable."
      });
    }
    
  } catch (error) {
    console.error('Gemini evaluation error:', error);
    return NextResponse.json({ 
      score: 5,
      strengths: [],
      weaknesses: ["Evaluation service unavailable"],
      suggestedAnswer: "Please try again.",
      summary: "Evaluation failed. Please try again."
    }, { status: 500 });
  }
}