/**
 * lib/evaluate.ts
 * ===============
 * Evaluates interview answers with proper fallback chain:
 * 1. Try ML Model (via backend)
 * 2. If model fails/no ideal answer → Try Gemini API
 * 3. If Gemini fails → Use intelligent content-based scoring
 */

import { Question, Answer } from '@/lib/types';
import { apiEvaluateAnswer } from '@/lib/api';

const roleMap: Record<string, string> = {
  'software engineer': 'software engineer',
  'data scientist': 'data scientist',
  'devops engineer': 'devops engineer',
  'product manager': 'product manager',
  'qa analyst': 'qa analyst',
  'ux designer': 'ux designer',
  'hr specialist': 'hr specialist',
  'marketing associate': 'marketing associate',
};

const difficultyMap: Record<string, string> = {
  easy: 'easy',
  medium: 'medium',
  hard: 'hard',
};

// Intelligent content-based scoring (not just length)
function intelligentScore(answer: string, question: Question): { score: number; strengths: string[]; weaknesses: string[]; summary: string; suggestedAnswer: string } {
  const lowerAnswer = answer.toLowerCase();
  const lowerQuestion = question.text.toLowerCase();
  
  let score = 0;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  
  // Check if answer addresses the question
  const questionWords = lowerQuestion.split(' ').filter(w => w.length > 3);
  const matchedWords = questionWords.filter(w => lowerAnswer.includes(w));
  const relevance = matchedWords.length / Math.max(1, questionWords.length);
  
  if (relevance < 0.3) {
    weaknesses.push("Answer doesn't directly address the question");
    score = 2;
  } else {
    strengths.push("Addresses the main question");
    score = 4;
  }
  
  // Check for examples
  if (lowerAnswer.includes('example') || lowerAnswer.includes('project') || lowerAnswer.includes('experience')) {
    strengths.push("Includes practical examples");
    score += 2;
  } else {
    weaknesses.push("Add specific examples from your experience");
  }
  
  // Check for structure (STAR method indicators)
  if (lowerAnswer.includes('situation') || lowerAnswer.includes('task') || lowerAnswer.includes('action') || lowerAnswer.includes('result')) {
    strengths.push("Good use of STAR method structure");
    score += 2;
  } else if (lowerAnswer.includes('first') || lowerAnswer.includes('then') || lowerAnswer.includes('finally')) {
    strengths.push("Clear sequential structure");
    score += 1;
  } else {
    weaknesses.push("Use clearer structure (e.g., STAR method)");
  }
  
  // Check for action verbs
  const actionVerbs = ['implemented', 'developed', 'created', 'built', 'led', 'managed', 'designed', 'solved', 'improved', 'increased'];
  const hasActionVerbs = actionVerbs.some(v => lowerAnswer.includes(v));
  if (hasActionVerbs) {
    strengths.push("Uses strong action verbs");
    score += 1;
  } else {
    weaknesses.push("Use stronger action verbs (implemented, developed, led)");
  }
  
  // Length bonus (but not deciding factor)
  if (answer.length > 100) {
    score += 1;
  }
  if (answer.length < 30) {
    weaknesses.push("Answer too brief - provide more detail");
    score = Math.min(score, 3);
  }
  
  // Clamp score to 1-10 range
  score = Math.max(1, Math.min(10, score));
  
  let summary = "";
  let suggestedAnswer = "";
  
  if (score >= 8) {
    summary = "Excellent answer! Good structure and relevant examples.";
    suggestedAnswer = "Keep up this quality in future answers.";
  } else if (score >= 6) {
    summary = "Good answer. Add more specific examples to strengthen it.";
    suggestedAnswer = "Consider using the STAR method (Situation, Task, Action, Result).";
  } else if (score >= 4) {
    summary = "Fair answer. Focus on directly answering the question with examples.";
    suggestedAnswer = "A strong answer includes a specific situation, your actions, and the outcome.";
  } else {
    summary = "Your answer needs improvement. Please address the question directly.";
    suggestedAnswer = "Read the question carefully and provide a specific example from your experience.";
  }
  
  return { score, strengths, weaknesses, summary, suggestedAnswer };
}

export async function evaluateAnswer(
  question: Question,
  answer: string,
  role: string,
  difficulty: string,
  idealAnswer?: string
): Promise<Answer> {
  const mappedRole = roleMap[role] ?? role;
  const mappedDifficulty = difficultyMap[difficulty] ?? difficulty;

  console.log(`📝 Evaluating answer for role: ${mappedRole}, difficulty: ${mappedDifficulty}`);
  console.log(`📝 Question: ${question.text.substring(0, 60)}...`);
  console.log(`📝 Answer length: ${answer.length} chars`);
  console.log(`📝 Ideal answer provided: ${idealAnswer ? 'YES' : 'NO'}`);

  // ========== LEVEL 1: Try ML Model ==========
  try {
    const result = await apiEvaluateAnswer(
      question.text,
      question.topic,
      answer,
      mappedRole,
      mappedDifficulty,
      idealAnswer
    );

    const strengths = Array.isArray(result.strengths) ? result.strengths : [];
    const weaknesses = Array.isArray(result.weaknesses) ? result.weaknesses : [];
    
    // If model gave meaningful feedback, use it
    if (result.score > 0 || strengths.length > 0 || weaknesses.length > 0) {
      console.log(`✅ ML Model - Score: ${result.score}/10, Strengths: ${strengths.length}`);
      return {
        questionId: question.id,
        text: answer,
        score: result.score,
        strengths: strengths,
        weaknesses: weaknesses,
        suggestedAnswer: result.suggested_answer || "Review the ideal answer for guidance.",
        summary: result.summary || "Your answer has been evaluated.",
      };
    }
    console.log("⚠️ ML Model returned empty feedback, trying Gemini...");
  } catch (error) {
    console.log("⚠️ ML Model failed, trying Gemini...", error);
  }

  // ========== LEVEL 2: Try Gemini API ==========
  try {
    const geminiResponse = await fetch('/api/evaluate-with-gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question.text, answer, role, difficulty }),
    });
    
    if (geminiResponse.ok) {
      const geminiResult = await geminiResponse.json();
      if (geminiResult.score && geminiResult.score > 0) {
        console.log(`✅ Gemini - Score: ${geminiResult.score}/10`);
        return {
          questionId: question.id,
          text: answer,
          score: geminiResult.score,
          strengths: geminiResult.strengths || [],
          weaknesses: geminiResult.weaknesses || [],
          suggestedAnswer: geminiResult.suggestedAnswer || "No model answer available.",
          summary: geminiResult.summary || "Your answer has been evaluated.",
        };
      }
    }
    console.log("⚠️ Gemini failed, using intelligent scoring...");
  } catch (error) {
    console.log("⚠️ Gemini error, using intelligent scoring...", error);
  }

  // ========== LEVEL 3: Intelligent Content-Based Scoring ==========
  console.log("📝 Using intelligent content-based scoring");
  const intelligent = intelligentScore(answer, question);
  
  return {
    questionId: question.id,
    text: answer,
    score: intelligent.score,
    strengths: intelligent.strengths,
    weaknesses: intelligent.weaknesses,
    suggestedAnswer: intelligent.suggestedAnswer,
    summary: intelligent.summary,
  };
}