import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIService } from '../services/ai-service';
import { getCompanionResponse, buildCompanionSystemPrompt } from '../gemini';
import {
  isCodingRequest,
  containsCode,
  getPoliteNoCodeRefusal,
  applyCodeGuardrail,
  POLITE_NO_CODE_REFUSALS,
} from '../services/wellness-guardrail';

describe('AI Companion Politeness, Courtesy, & No-Code Guardrails Suite', () => {
  let aiService: AIService;

  beforeEach(() => {
    aiService = new AIService();
    vi.clearAllMocks();
  });

  describe('R1: System Prompt Mandates for Politeness, Courtesy, and Tone', () => {
    it('verifies AIService system prompt explicitly mandates courteous address, polite phrasing, and empathetic handling', async () => {
      const createMock = vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'I am doing wonderful, thank you for asking! 🌸' } }],
      });

      (aiService as any).groq = {
        chat: { completions: { create: createMock } },
      };

      await aiService.generateCompanionResponse(
        'Hello, how can you help me with my cycle?',
        [],
        JSON.stringify({ user: { name: 'Ananya', companionName: 'Svanexa AI' } }),
        'Svanexa AI',
        'Ananya',
        false,
        'English'
      );

      expect(createMock).toHaveBeenCalled();
      const messages = createMock.mock.calls[0][0].messages;
      const systemPrompt = messages.find((m: any) => m.role === 'system').content;

      // Acceptance Criteria: System prompts explicitly mandate courteous address, polite phrasing, and empathetic handling
      expect(systemPrompt).toContain('UTMOST POLITENESS, COURTESY & RESPECTFUL ADDRESS');
      expect(systemPrompt).toContain('Courteous Address');
      expect(systemPrompt).toContain('Polite Phrasing');
      expect(systemPrompt).toContain('Empathetic & Non-Judgmental Demeanor');
      expect(systemPrompt).toContain('Polite Out-of-Scope Redirection');
      expect(systemPrompt).toContain('STRICT HEALTH & WELLNESS BOUNDARY (ABSOLUTE NO-CODE POLICY)');
      expect(systemPrompt).toContain('Absolute No-Code Rule');
      expect(systemPrompt).toContain('Zero Code Snippets or Blocks');
    });

    it('verifies AIService.buildSystemPrompt normalizes language and includes all required directives', () => {
      const promptSpanish = aiService.buildSystemPrompt('Luna', 'Sofia', 'pcos', 'morning', 'Cycle', 'es', {});
      expect(promptSpanish).toContain('Target Preferred Language: Spanish');
      expect(promptSpanish).toContain('UTMOST POLITENESS, COURTESY & RESPECTFUL ADDRESS');
      expect(promptSpanish).toContain('STRICT HEALTH & WELLNESS BOUNDARY (ABSOLUTE NO-CODE POLICY)');
      expect(promptSpanish).toContain('Zero Code Snippets or Blocks');
    });

    it('verifies gemini.ts buildCompanionSystemPrompt explicitly mandates courteous address, polite phrasing, and empathetic handling', () => {
      const prompt = buildCompanionSystemPrompt('Svanexa AI', 'English', 'Friendly', '{}');

      expect(prompt).toContain('UTMOST POLITENESS, COURTESY & RESPECTFUL MANNER');
      expect(prompt).toContain('Courteous Address');
      expect(prompt).toContain('Polite Phrasing');
      expect(prompt).toContain('Empathetic & Non-Judgmental Demeanor');
      expect(prompt).toContain('Polite Out-of-Scope Redirection');
      expect(prompt).toContain('STRICT HEALTH & WELLNESS BOUNDARY (ABSOLUTE NO-CODE POLICY)');
      expect(prompt).toContain('Absolute No-Code Rule');
      expect(prompt).toContain('Zero Code Snippets or Blocks');
    });

    it('verifies gemini.ts getCompanionResponse prompt contains politeness and no-code directives', async () => {
      const res = await getCompanionResponse(
        'Please help me track my sleep tonight',
        [],
        'English',
        'Friendly',
        'Luna',
        '{}'
      );

      expect(res).toBeDefined();
    });

    it('verifies AIService and gemini.ts mandate the Professional & Friendly Communication Standard', () => {
      const aiServicePrompt = aiService.buildSystemPrompt('Luna', 'Ananya', 'pcos', 'afternoon', 'Cycle', 'en', {});
      const geminiPrompt = buildCompanionSystemPrompt('Svanexa AI', 'English', 'Friendly', '{}');

      // Professional Standard directives
      expect(aiServicePrompt).toContain('PROFESSIONAL & FRIENDLY COMMUNICATION STANDARD (CORE MANDATE)');
      expect(aiServicePrompt).toContain('Professional Standard');
      expect(aiServicePrompt).toContain('Friendly Standard');
      expect(aiServicePrompt).toContain('Scientifically & Clinically Grounded');
      expect(aiServicePrompt).toContain('Dignified Poise (No Servility)');
      expect(aiServicePrompt).toContain('Empathy & Validation First');
      expect(aiServicePrompt).toContain('Never leave sentences, thoughts, or lists incomplete');

      // Gemini prompt parity
      expect(geminiPrompt).toContain('PROFESSIONAL & FRIENDLY COMMUNICATION STANDARD (CORE MANDATE)');
      expect(geminiPrompt).toContain('Professional Standard');
      expect(geminiPrompt).toContain('Friendly Standard');
      expect(geminiPrompt).toContain('Scientifically Grounded');
      expect(geminiPrompt).toContain('Dignified Poise (No Servility)');
      expect(geminiPrompt).toContain('Empathy & Validation First');
    });
  });

  describe('R2: Strict Health & Wellness Domain Boundary (No-Code Policy)', () => {
    it('politely rejects coding requests in English and redirects warmly to wellness without any code', async () => {
      const codingQueries = [
        'write a python script to calculate my cycle',
        'can you write a code in javascript to sort numbers',
        'write html and css for a landing page',
        'generate code for a fibonacci function',
        'debug this python script for me',
        'write code',
      ];

      for (const query of codingQueries) {
        const result = await aiService.generateCompanionResponse(
          query,
          [],
          JSON.stringify({ user: { name: 'Pooja', companionName: 'Luna' } }),
          'Luna',
          'Pooja',
          false,
          'English'
        );

        // 1. Must politely explain health focus
        expect(result.response).toContain('personal health and wellness companion');
        expect(result.response).toContain('unable to write');

        // 2. Must warmly redirect back to health/wellness
        expect(result.response).toMatch(/wellness goal|symptom|habit|feeling/i);

        // 3. Must contain zero code blocks or snippets
        expect(result.response).not.toContain('```');
        expect(containsCode(result.response)).toBe(false);

        // 4. Model used reflects guardrail intervention
        expect(result.modelUsed).toBe('guardrail-wellness-boundary');
      }
    });

    it('politely rejects coding requests in Hindi with Devanagari script and health redirect', async () => {
      const hindiQueries = [
        'मुझे एक पायथन कोड लिख कर दो',
        'python code likho',
        'एक प्रोग्राम बनाओ',
      ];

      for (const query of hindiQueries) {
        const result = await aiService.generateCompanionResponse(
          query,
          [],
          JSON.stringify({ user: { name: 'सुनीता', language: 'Hindi' } }),
          'Luna',
          'सुनीता',
          false,
          'Hindi'
        );

        expect(result.response).toContain('स्वास्थ्य और कल्याण');
        expect(result.response).toContain('सॉफ़्टवेयर कोड');
        expect(result.response).not.toContain('```');
        expect(containsCode(result.response)).toBe(false);
        expect(result.modelUsed).toBe('guardrail-wellness-boundary');
      }
    });

    it('politely rejects coding requests in Telugu with Telugu script and health redirect', async () => {
      const teluguQueries = [
        'నాకు ఒక పైథాన్ కోడ్ రాయి',
        'python code rayandi',
      ];

      for (const query of teluguQueries) {
        const result = await aiService.generateCompanionResponse(
          query,
          [],
          JSON.stringify({ user: { name: 'శ్రావణి', language: 'Telugu' } }),
          'Luna',
          'శ్రావణి',
          false,
          'Telugu'
        );

        expect(result.response).toContain('ఆరోగ్య మరియు వెల్‌నెస్');
        expect(result.response).toContain('కోడింగ్ లేదా సాఫ్ట్‌వేర్ ప్రోగ్రామింగ్');
        expect(result.response).not.toContain('```');
        expect(containsCode(result.response)).toBe(false);
        expect(result.modelUsed).toBe('guardrail-wellness-boundary');
      }
    });

    it('politely rejects coding requests in Spanish with Spanish phrasing and health redirect', async () => {
      const result = await aiService.generateCompanionResponse(
        'Por favor escribe un código en Python para calcular el índice de masa corporal',
        [],
        JSON.stringify({ user: { name: 'Elena', language: 'Spanish' } }),
        'Luna',
        'Elena',
        false,
        'Spanish'
      );

      expect(result.response).toContain('salud y bienestar');
      expect(result.response).toContain('código de programación');
      expect(result.response).not.toContain('```');
      expect(containsCode(result.response)).toBe(false);
      expect(result.modelUsed).toBe('guardrail-wellness-boundary');
    });

    it('politely rejects coding requests in French and German', async () => {
      const frenchResult = await aiService.generateCompanionResponse(
        'Écris-moi un script python pour analyser des données',
        [],
        JSON.stringify({ user: { name: 'Camille', language: 'French' } }),
        'Luna',
        'Camille',
        false,
        'French'
      );
      expect(frenchResult.response).toContain('santé et bien-être');
      expect(frenchResult.response).not.toContain('```');

      const germanResult = await aiService.generateCompanionResponse(
        'Schreibe mir ein JavaScript Programm',
        [],
        JSON.stringify({ user: { name: 'Greta', language: 'German' } }),
        'Luna',
        'Greta',
        false,
        'German'
      );
      expect(germanResult.response).toContain('Gesundheits- und Wellness-Begleiterin');
      expect(germanResult.response).not.toContain('```');
    });

    it('verifies getCompanionResponse in gemini.ts directly declines coding requests', async () => {
      const reply = await getCompanionResponse(
        'Write me a python script to track ovulation',
        [],
        'English',
        'Friendly',
        'Svanexa AI',
        '{}'
      );

      expect(reply).toContain('personal health and wellness companion');
      expect(reply).toContain('unable to write');
      expect(reply).not.toContain('```');
      expect(containsCode(reply)).toBe(false);
    });
  });

  describe('R3: Code Leakage Prevention Guardrail', () => {
    it('intercepts markdown code blocks returned by an underlying language model', async () => {
      // Simulate an LLM attempting to bypass system prompt and return python code block
      const leakedModelOutput = `Certainly! Here is the python code you asked for:
\`\`\`python
def calculate_pcos_risk(bmi, cycle_days):
    if bmi > 25 and cycle_days > 35:
        return "High Risk"
    return "Normal"
\`\`\`
Hope this helps!`;

      const createMock = vi.fn().mockResolvedValue({
        choices: [{ message: { content: leakedModelOutput } }],
      });

      (aiService as any).groq = {
        chat: { completions: { create: createMock } },
      };

      const result = await aiService.generateCompanionResponse(
        'Tell me how cycle days relate to health',
        [],
        '{}',
        'Luna',
        'Maya',
        false,
        'English'
      );

      // Guardrail must intercept leaked code and replace with polite refusal & redirect
      expect(result.response).not.toContain('```python');
      expect(result.response).not.toContain('def calculate_pcos_risk');
      expect(result.response).toContain('personal health and wellness companion');
      expect(result.response).toContain('🌸');
      expect(result.modelUsed).toBe('guardrail-wellness-boundary');
    });

    it('intercepts raw programming function syntax leaking from model output', () => {
      const rawFunctionLeak = `function calculateCycle(days) {\n  return days + 28;\n}`;
      expect(containsCode(rawFunctionLeak)).toBe(true);

      const guarded = applyCodeGuardrail(rawFunctionLeak, 'English');
      expect(guarded.intercepted).toBe(true);
      expect(guarded.isClean).toBe(false);
      expect(guarded.content).not.toContain('function calculateCycle');
      expect(guarded.content).toContain('personal health and wellness companion');
    });

    it('intercepts HTML / script tag injections in model responses', () => {
      const scriptLeak = `<script>alert("test");</script>`;
      expect(containsCode(scriptLeak)).toBe(true);

      const guarded = applyCodeGuardrail(scriptLeak, 'English');
      expect(guarded.intercepted).toBe(true);
      expect(guarded.content).not.toContain('<script>');
    });

    it('intercepts Python import statements in model responses', () => {
      const pythonLeak = `import numpy as np\nfrom sklearn import linear_model`;
      expect(containsCode(pythonLeak)).toBe(true);

      const guarded = applyCodeGuardrail(pythonLeak, 'Spanish');
      expect(guarded.intercepted).toBe(true);
      expect(guarded.content).toContain('salud y bienestar');
      expect(guarded.content).not.toContain('import numpy');
    });

    it('intercepts Python functions with return type annotations without markdown fences', () => {
      const typedPythonLeak = `def calculate_pcos(bmi: float, age: int) -> dict:\n    return {"risk": "low"}`;
      expect(containsCode(typedPythonLeak)).toBe(true);

      const guarded = applyCodeGuardrail(typedPythonLeak, 'English');
      expect(guarded.intercepted).toBe(true);
      expect(guarded.content).toContain('personal health and wellness companion');
      expect(guarded.content).not.toContain('def calculate_pcos');
    });

    it('intercepts TypeScript typed functions and arrow functions', () => {
      const tsFunctionLeak = `function calculateOvulation(cycleDays: number): number {\n  return cycleDays - 14;\n}`;
      expect(containsCode(tsFunctionLeak)).toBe(true);

      const tsArrowLeak = `const getCycle = (days: number): number => days + 28;`;
      expect(containsCode(tsArrowLeak)).toBe(true);
    });

    it('intercepts Python standalone imports and print statements', () => {
      const pythonImports = `import numpy as np\nimport pandas as pd`;
      expect(containsCode(pythonImports)).toBe(true);

      const pythonPrint = `print("Your next ovulation date is estimated")`;
      expect(containsCode(pythonPrint)).toBe(true);
    });

    it('intercepts CommonMark tilde code fences and HTML/CSS blocks', () => {
      const tildeCode = `~~~python\ndef foo(): pass\n~~~`;
      expect(containsCode(tildeCode)).toBe(true);

      const styleBlock = `<style>\n.wellness { color: pink; }\n</style>`;
      expect(containsCode(styleBlock)).toBe(true);

      const preCode = `<pre><code>const a = 1;</code></pre>`;
      expect(containsCode(preCode)).toBe(true);
    });

    it('intercepts Python control flow and shell scripts', () => {
      const pythonLoop = `for day in range(1, 29):\n    print(f"Day {day}")`;
      expect(containsCode(pythonLoop)).toBe(true);

      const shellScript = `#!/bin/bash\ncurl -X POST https://api.health.com`;
      expect(containsCode(shellScript)).toBe(true);

      const sqlDDL = `CREATE TABLE cycle_logs (id INT, date DATE);`;
      expect(containsCode(sqlDDL)).toBe(true);

      const sqlDrop = `DROP TABLE cycle_logs;`;
      expect(containsCode(sqlDrop)).toBe(true);
    });

    it('intercepts unfenced async def Python functions and TypeScript exports', () => {
      const asyncPython = `async def calculate_cycle_metrics(userId: str):\n    return await db.fetch(userId)`;
      expect(containsCode(asyncPython)).toBe(true);

      const exportedTsFunc = `export function calculatePCOSSeverity(score: number): boolean {\n  return score > 5;\n}`;
      expect(containsCode(exportedTsFunc)).toBe(true);

      const exportedTsArrow = `export const getActivePhase = (): string => 'luteal';`;
      expect(containsCode(exportedTsArrow)).toBe(true);
    });

    it('intercepts unfenced class declarations across JS/TS/Java and PHP code', () => {
      const jsClass = `class CyclePredictor {\n  constructor(days) {\n    this.days = days;\n  }\n}`;
      expect(containsCode(jsClass)).toBe(true);

      const tsExportClass = `export class PCOSClassifier extends BaseClassifier {\n}`;
      expect(containsCode(tsExportClass)).toBe(true);

      const phpCode = `<?php\necho "Tracking hormone data";\n?>`;
      expect(containsCode(phpCode)).toBe(true);
    });

    it('intercepts package manager commands and terminal installation instructions', () => {
      const pipCmd = `pip install scikit-learn pandas numpy`;
      expect(containsCode(pipCmd)).toBe(true);

      const npmCmd = `npm install react-chartjs-2 chart.js`;
      expect(containsCode(npmCmd)).toBe(true);
    });

    it('intercepts classes with access modifiers (public/private/abstract) and Rust/Go/Swift functions', () => {
      const publicClass = `public class HealthTracker {\n  private int cycleDays = 28;\n}`;
      expect(containsCode(publicClass)).toBe(true);

      const abstractClass = `abstract class BasePredictor {\n  abstract int predict();\n}`;
      expect(containsCode(abstractClass)).toBe(true);

      const rustFn = `fn calculate_cycle() -> u32 {\n  28\n}`;
      expect(containsCode(rustFn)).toBe(true);

      const goFunc = `func calculateOvulation(days int) int {\n  return days - 14\n}`;
      expect(containsCode(goFunc)).toBe(true);
    });

    it('intercepts try/catch exception blocks, with open context managers, packages, and using directives', () => {
      const tryCatch = `try {\n  saveRecord();\n} catch (error) {\n  console.error(error);\n}`;
      expect(containsCode(tryCatch)).toBe(true);

      const withOpen = `with open("cycle.json", "r") as f:\n  data = f.read()`;
      expect(containsCode(withOpen)).toBe(true);

      const goPackage = `package main\nimport "fmt"`;
      expect(containsCode(goPackage)).toBe(true);

      const csharpUsing = `using System;\nusing System.Collections.Generic;`;
      expect(containsCode(csharpUsing)).toBe(true);

      const dockerFile = `FROM python:3.9\nWORKDIR /app\nRUN pip install pandas`;
      expect(containsCode(dockerFile)).toBe(true);
    });

    it('preserves target language and correctly sets modelUsed when Gemini output contains code', async () => {
      const leakedGeminiOutput = `def calculate_cycle():\n    return 28`;

      const generateContentMock = vi.fn().mockResolvedValue({
        response: { text: () => leakedGeminiOutput },
      });

      const getGenerativeModelMock = vi.fn().mockReturnValue({
        generateContent: generateContentMock,
      });

      (aiService as any).gemini = {
        getGenerativeModel: getGenerativeModelMock,
      };

      const result = await aiService.generateCompanionResponse(
        'मेरे स्वास्थ्य का विश्लेषण करें',
        [],
        '{}',
        'Luna',
        'सुनीता',
        true, // forceGemini
        'Hindi'
      );

      // Must be intercepted into Hindi refusal, not English
      expect(result.response).toContain('स्वास्थ्य और कल्याण');
      expect(result.response).toContain('सॉफ़्टवेयर कोड');
      expect(result.response).not.toContain('def calculate_cycle');
      expect(result.modelUsed).toBe('guardrail-wellness-boundary');
    });
  });

  describe('Edge Cases & Non-Coding Query Preservation (False Positive Prevention)', () => {
    it('does NOT reject legitimate health questions mentioning "dress code"', () => {
      const query = 'What is the most comfortable dress code for gentle prenatal yoga?';
      expect(isCodingRequest(query)).toBe(false);
    });

    it('does NOT reject queries asking about "promo code" or "coupon code"', () => {
      const query = 'Do you have a promo code or discount code for health vitamins?';
      expect(isCodingRequest(query)).toBe(false);
    });

    it('does NOT reject queries mentioning "zip code" or "postal code"', () => {
      const query = 'My zip code is 94103, does local air quality or weather affect PCOS flare-ups?';
      expect(isCodingRequest(query)).toBe(false);
    });

    it('does NOT reject queries discussing the "genetic code" or DNA in health', () => {
      const query = 'How does the human genetic code influence hormone balance and PCOS susceptibility?';
      expect(isCodingRequest(query)).toBe(false);
    });

    it('does NOT reject hospital terminology like "code blue"', () => {
      const query = 'What does code blue mean when staying in a maternity ward?';
      expect(isCodingRequest(query)).toBe(false);
    });

    it('does NOT reject queries about community "code of conduct" or "code of ethics"', () => {
      expect(isCodingRequest('What is the code of conduct for the community forum?')).toBe(false);
      expect(isCodingRequest('Does this wellness app follow a strict code of ethics?')).toBe(false);
    });

    it('does NOT reject legitimate medical inquiries about bodily/organ functions', () => {
      expect(isCodingRequest('Can you explain thyroid function?')).toBe(false);
      expect(isCodingRequest('Explain ovarian function and how it relates to PCOS')).toBe(false);
      expect(isCodingRequest('What is healthy kidney function during pregnancy?')).toBe(false);
      expect(isCodingRequest('Tell me about liver function and estrogen clearance')).toBe(false);
      expect(isCodingRequest('How does adrenal function affect stress hormones?')).toBe(false);
    });

    it('does NOT reject fitness, workout, or wellness program creation requests', () => {
      expect(isCodingRequest('Can you create a fitness program for me?')).toBe(false);
      expect(isCodingRequest('Draft a workout program for my follicular phase')).toBe(false);
      expect(isCodingRequest('Can you provide a walking program for daily wellness?')).toBe(false);
      expect(isCodingRequest('Suggest a gentle exercise program for PCOS')).toBe(false);
    });

    it('does NOT reject nutrition queries asking about dietary macros', () => {
      expect(isCodingRequest('Can you give me my macros for PCOS?')).toBe(false);
      expect(isCodingRequest('What should my daily macros be for hormone balance?')).toBe(false);
      expect(isCodingRequest('Calculate my macros for fat loss')).toBe(false);
      expect(isCodingRequest('Provide macros for a low-carb breakfast')).toBe(false);
    });

    it('does NOT reject yoga/wellness class queries or medical symptom classifications', () => {
      expect(isCodingRequest('Can you suggest a prenatal yoga class?')).toBe(false);
      expect(isCodingRequest('Recommend a pilates class for core strength')).toBe(false);
      expect(isCodingRequest('What do Class A symptoms mean for cycle regularity?')).toBe(false);
    });

    it('does NOT reject wellness learning or education questions', () => {
      expect(isCodingRequest('Teach me how to track my ovulation')).toBe(false);
      expect(isCodingRequest('Teach me about gut health and insulin resistance')).toBe(false);
      expect(isCodingRequest('Help me learn breathing exercises for stress')).toBe(false);
    });

    it('does NOT flag natural English nutrition advice starting with "Select ... from ..."', () => {
      const nutritionAdvice = `Here is a wonderful morning tip:\nSelect fresh vegetables, berries and chia seeds from your pantry for a low-glycemic breakfast.`;
      expect(containsCode(nutritionAdvice)).toBe(false);

      const guarded = applyCodeGuardrail(nutritionAdvice, 'English');
      expect(guarded.isClean).toBe(true);
      expect(guarded.intercepted).toBe(false);
      expect(guarded.content).toBe(nutritionAdvice);
    });

    it('does NOT flag medical symptom classifications like "Class A: Mild symptoms"', () => {
      const medicalAdvice = `Based on your logs:\nClass A: Mild symptoms with regular cycles and balanced energy.`;
      expect(containsCode(medicalAdvice)).toBe(false);

      const guarded = applyCodeGuardrail(medicalAdvice, 'English');
      expect(guarded.isClean).toBe(true);
      expect(guarded.intercepted).toBe(false);
    });

    it('permits standard wellness responses with bullet points, bold keywords, and emojis without false triggers', () => {
      const standardWellnessResponse = `Hello Maya! 🌸\n\nI am so glad to check in on you today.\n\n- **Hydration**: You have logged 1400 ml of your 2000 ml goal.\n- **Movement**: 25 minutes of restorative yoga logged.\n\n🌸 **Micro-Step:** Sip a warm cup of herbal tea and take three soothing breaths.`;

      expect(containsCode(standardWellnessResponse)).toBe(false);
      const guarded = applyCodeGuardrail(standardWellnessResponse, 'English');
      expect(guarded.isClean).toBe(true);
      expect(guarded.intercepted).toBe(false);
      expect(guarded.content).toBe(standardWellnessResponse);
    });
  });

  describe('Coding Request Intent Detection Rigorous Edge Cases', () => {
    it('detects coding requests with vowel-prefixed nouns ("an algorithm", "an app")', () => {
      expect(isCodingRequest('Can you write an algorithm to predict ovulation?')).toBe(true);
      expect(isCodingRequest('Please create an algorithm for cycle calculation')).toBe(true);
      expect(isCodingRequest('Can you build an app in react for period tracking?')).toBe(true);
    });

    it('detects coding requests with descriptive adjectives ("simple script", "quick function")', () => {
      expect(isCodingRequest('Write a simple script to track my period')).toBe(true);
      expect(isCodingRequest('Write a simple python script')).toBe(true);
      expect(isCodingRequest('Write a quick function to calculate BMI')).toBe(true);
      expect(isCodingRequest('Can you give me a sample code in Python?')).toBe(true);
      expect(isCodingRequest('Write a custom script to export my health data')).toBe(true);
      expect(isCodingRequest('Write an efficient sorting algorithm')).toBe(true);
    });

    it('detects requests to teach or learn coding and programming', () => {
      expect(isCodingRequest('Teach me how to code')).toBe(true);
      expect(isCodingRequest('Teach me programming')).toBe(true);
      expect(isCodingRequest('Teach me python')).toBe(true);
      expect(isCodingRequest('Teach me c++')).toBe(true);
      expect(isCodingRequest('Teach me c#')).toBe(true);
      expect(isCodingRequest('Teach me how to code in rust')).toBe(true);
      expect(isCodingRequest('Teach me how to code in golang')).toBe(true);
      expect(isCodingRequest('Can you write a c++ code?')).toBe(true);
      expect(isCodingRequest('Can you write a c# script?')).toBe(true);
      expect(isCodingRequest('Can you teach me to program?')).toBe(true);
      expect(isCodingRequest('I want to learn coding')).toBe(true);
      expect(isCodingRequest('Can you do coding?')).toBe(true);
      expect(isCodingRequest('Are you able to do programming?')).toBe(true);
      expect(isCodingRequest('Help me with my coding homework')).toBe(true);
      expect(isCodingRequest('Help me with my coding assignment')).toBe(true);
    });

    it('detects database queries, regex requests, and code snippets', () => {
      expect(isCodingRequest('Can you write a database query for cycle dates?')).toBe(true);
      expect(isCodingRequest('Write a SQL query to get users')).toBe(true);
      expect(isCodingRequest('Write a regex to match date format')).toBe(true);
      expect(isCodingRequest('Can you explain this snippet?')).toBe(true);
      expect(isCodingRequest('Write an excel macro to automate rows')).toBe(true);
    });

    it('detects requests to explain, review, format, or debug code', () => {
      expect(isCodingRequest('Can you explain this code for me: def foo(): pass')).toBe(true);
      expect(isCodingRequest('What does this function do?')).toBe(true);
      expect(isCodingRequest('Review this code and tell me if it works')).toBe(true);
      expect(isCodingRequest('Please format this code')).toBe(true);
      expect(isCodingRequest('Walk me through this script')).toBe(true);
    });

    it('detects "can you code?" even when preceded by greetings or pleasantries', () => {
      expect(isCodingRequest('Hey Luna, can you code?')).toBe(true);
      expect(isCodingRequest('Hi, do you know how to code?')).toBe(true);
      expect(isCodingRequest('Good morning! Can you write code?')).toBe(true);
    });

    it('detects multilingual coding intent variants', () => {
      // Hindi
      expect(isCodingRequest('मुझे एक पायथन कोड चाहिए')).toBe(true);
      expect(isCodingRequest('मुझे प्रोग्रामिंग सिखाओ')).toBe(true);
      expect(isCodingRequest('मुझे कोडिंग सिखाओ')).toBe(true);

      // Telugu
      expect(isCodingRequest('నాకు కోడింగ్ నేర్పించు')).toBe(true);
      expect(isCodingRequest('కోడ్ రాయి')).toBe(true);

      // Spanish
      expect(isCodingRequest('Por favor escribe una función en Python')).toBe(true);
      expect(isCodingRequest('¿Puedes programar una aplicación para mí?')).toBe(true);
      expect(isCodingRequest('Enséñame a programar')).toBe(true);

      // French
      expect(isCodingRequest('Écris une fonction pour calculer mon cycle')).toBe(true);
      expect(isCodingRequest('Enseigne-moi la programmation')).toBe(true);

      // German
      expect(isCodingRequest('Schreibe mir eine Funktion')).toBe(true);
      expect(isCodingRequest('Bring mir programmieren bei')).toBe(true);
    });
  });

  describe('Multilingual Coverage Across All 14 Supported Languages', () => {
    const expectedLanguages = [
      'English', 'Hindi', 'Telugu', 'Tamil', 'Spanish',
      'French', 'German', 'Kannada', 'Malayalam', 'Marathi',
      'Bengali', 'Gujarati', 'Arabic', 'Portuguese'
    ];

    it('provides courteous, non-empty refusal templates with warm wellness redirects for all 14 languages', () => {
      for (const lang of expectedLanguages) {
        const refusal = getPoliteNoCodeRefusal(lang);
        expect(refusal, `Refusal for ${lang} must exist and be non-empty`).toBeDefined();
        expect(refusal.length).toBeGreaterThan(50);
        // Refusal must never contain code fences
        expect(refusal).not.toContain('```');
        expect(containsCode(refusal)).toBe(false);
        // Must contain empathetic blossom emoji
        expect(refusal).toContain('🌸');
      }
    });

    it('correctly maps language aliases, native scripts, and ISO codes to refusal templates', () => {
      expect(getPoliteNoCodeRefusal('हिंदी')).toBe(POLITE_NO_CODE_REFUSALS.Hindi);
      expect(getPoliteNoCodeRefusal('తెలుగు')).toBe(POLITE_NO_CODE_REFUSALS.Telugu);
      expect(getPoliteNoCodeRefusal('Español')).toBe(POLITE_NO_CODE_REFUSALS.Spanish);
      expect(getPoliteNoCodeRefusal('fr')).toBe(POLITE_NO_CODE_REFUSALS.French);
      expect(getPoliteNoCodeRefusal('de')).toBe(POLITE_NO_CODE_REFUSALS.German);

      // ISO-639-2 / 3-letter codes
      expect(getPoliteNoCodeRefusal('spa')).toBe(POLITE_NO_CODE_REFUSALS.Spanish);
      expect(getPoliteNoCodeRefusal('ger')).toBe(POLITE_NO_CODE_REFUSALS.German);
      expect(getPoliteNoCodeRefusal('deu')).toBe(POLITE_NO_CODE_REFUSALS.German);
      expect(getPoliteNoCodeRefusal('por')).toBe(POLITE_NO_CODE_REFUSALS.Portuguese);
      expect(getPoliteNoCodeRefusal('hin')).toBe(POLITE_NO_CODE_REFUSALS.Hindi);
      expect(getPoliteNoCodeRefusal('tel')).toBe(POLITE_NO_CODE_REFUSALS.Telugu);
      expect(getPoliteNoCodeRefusal('tam')).toBe(POLITE_NO_CODE_REFUSALS.Tamil);
    });
  });
});
