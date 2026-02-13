import { ScanCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { getDocClient } from './shared/db';
import { Note } from './shared/types';

const NOTES_TABLE = process.env.NOTES_TABLE_NAME || '';
const NOTE_QUESTIONS_TABLE = process.env.NOTE_QUESTIONS_TABLE_NAME || '';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const bedrockClient = new BedrockRuntimeClient({ region: AWS_REGION });

// Event types for different invocation modes
interface SingleNoteEvent {
  mode: 'single';
  note: Note;
}

interface ScheduledEvent {
  mode?: 'scheduled';
}

type LambdaEvent = SingleNoteEvent | ScheduledEvent;

interface GeneratedQuestion {
  noteId: string;
  questionId: string;
  ownerId: string;
  question: string;
  options: Record<string, string>;
  correct_answers: string[];
  explanation: string;
  difficulty: string;
  generatedAt: string;
  noteTitle: string;
  noteContent: string;
}

async function generateQuestionsFromNote(note: Note): Promise<GeneratedQuestion[]> {
  const prompt = `You are a Staff-Level Technical Interviewer evaluating senior engineers.

Given the following technical content, generate 5 high-quality objective questions.

Each question must:
1. Primarily test reasoning, trade-offs, failure modes, and mental models.
2. Allow up to 20–30% conceptual recall (definitions or mechanisms), but never pure memorization.
3. Be answerable in a few minutes of thinking (not long essays).
4. Include realistic traps based on common misconceptions.
5. Generalize beyond the specific content when appropriate.
6. Avoid trivia, niche edge-case recall, or obscure facts.
7. Test understanding of *why* a mechanism exists, not just what it does.
8. Cover DIFFERENT aspects of the topic - avoid redundant questions.

Content Title: ${note.title}
Content: ${note.content}

For each question, output:
- Question text
- 4 answer options (A, B, C, D)
- Correct answer(s)
- Difficulty (Medium / High / Critical)
- A detailed explanation

The explanation MUST:
1. Begin with fundamentals (define the core concept clearly).
2. Explain why the correct answers are correct.
3. Explain why each incorrect option is wrong.
4. Discuss trade-offs or failure modes if relevant.
5. Use concrete examples where possible.

The tone should be technically critical and analytical — assume hiring for Staff level.
If the source material is narrow, expand into adjacent foundational concepts.

Respond ONLY with valid JSON array of 5 questions (no markdown, no code blocks):
[
  {
    "question": "Question 1 here?",
    "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
    "correct_answers": ["A"],
    "explanation": "Explanation for Q1",
    "difficulty": "High"
  },
  {
    "question": "Question 2 here?",
    "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
    "correct_answers": ["B"],
    "explanation": "Explanation for Q2",
    "difficulty": "Medium"
  }
]`;

  try {
    // Try Claude 3 Haiku first, fall back to Amazon Nova Lite
    const models = [
      {
        modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
        body: {
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 8192,
          messages: [{ role: 'user', content: prompt }],
        },
        parseResponse: (body: any) => body.content[0].text,
      },
      {
        modelId: 'amazon.nova-lite-v1:0',
        body: {
          messages: [{ role: 'user', content: [{ text: prompt }] }],
          inferenceConfig: { maxTokens: 8192 },
        },
        parseResponse: (body: any) => body.output.message.content[0].text,
      },
    ];

    let lastError: Error | null = null;
    
    for (const model of models) {
      try {
        const command = new InvokeModelCommand({
          modelId: model.modelId,
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify(model.body),
        });

        const response = await bedrockClient.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        const content = model.parseResponse(responseBody);
        
        // Parse the JSON array response
        const questionsData = JSON.parse(content);
        const generatedAt = new Date().toISOString();
        
        // Map each question to our format with unique questionId
        return questionsData.map((q: any, index: number) => ({
          noteId: note.noteId,
          questionId: `${note.noteId}_q${index + 1}`,
          ownerId: note.userId || '',
          question: q.question,
          options: q.options,
          correct_answers: q.correct_answers,
          explanation: q.explanation,
          difficulty: q.difficulty || 'Medium',
          generatedAt,
          noteTitle: note.title,
          noteContent: note.content,
        }));
      } catch (modelError) {
        console.log(`Model ${model.modelId} failed, trying next...`);
        lastError = modelError as Error;
      }
    }
    
    throw lastError || new Error('All models failed');
  } catch (error) {
    console.error(`Error generating questions for note ${note.noteId}:`, error);
    return [];
  }
}

export const handler = async (event: LambdaEvent): Promise<void> => {
  const docClient = getDocClient();
  
  // Check if this is a single-note invocation (instant generation)
  if (event && 'mode' in event && event.mode === 'single' && event.note) {
    console.log(`Instant generation for note: ${event.note.noteId}`);
    
    const note = event.note;
    
    // Only generate if quizMe is true
    if (!note.quizMe) {
      console.log('Note does not have quizMe enabled, skipping');
      return;
    }
    
    try {
      const questions = await generateQuestionsFromNote(note);
      
      if (questions.length > 0) {
        // Store all questions
        for (const question of questions) {
          await docClient.send(new PutCommand({
            TableName: NOTE_QUESTIONS_TABLE,
            Item: question,
          }));
        }
        console.log(`Generated ${questions.length} questions for note: ${note.noteId}`);
      }
    } catch (error) {
      console.error(`Error generating questions for note ${note.noteId}:`, error);
      throw error;
    }
    
    return;
  }
  
  // Scheduled batch processing
  console.log('Starting scheduled note question generation job');
  
  // Calculate timestamp for 24 hours ago
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const oneDayAgoISO = oneDayAgo.toISOString();
  
  try {
    // Scan for notes with quizMe=true and updatedAt in last 24 hours
    // Note: For production with many users, consider using GSI or pagination
    const scanCommand = new ScanCommand({
      TableName: NOTES_TABLE,
      FilterExpression: 'quizMe = :quizMe AND updatedAt >= :since',
      ExpressionAttributeValues: {
        ':quizMe': true,
        ':since': oneDayAgoISO,
      },
    });
    
    const result = await docClient.send(scanCommand);
    const notes = (result.Items || []) as Note[];
    
    console.log(`Found ${notes.length} notes to process`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const note of notes) {
      try {
        // Check if questions already exist for this note (avoid duplicates)
        const existingQuery = new QueryCommand({
          TableName: NOTE_QUESTIONS_TABLE,
          KeyConditionExpression: 'noteId = :noteId',
          ExpressionAttributeValues: {
            ':noteId': note.noteId,
          },
          Limit: 1,
        });
        
        const existing = await docClient.send(existingQuery);
        
        // Skip if questions were generated recently (within last 24 hours)
        if (existing.Items && existing.Items.length > 0) {
          const existingQuestion = existing.Items[0];
          const generatedAt = new Date(existingQuestion.generatedAt);
          if (generatedAt >= oneDayAgo) {
            console.log(`Skipping note ${note.noteId} - questions already generated recently`);
            continue;
          }
        }
        
        // Generate new questions
        const questions = await generateQuestionsFromNote(note);
        
        if (questions.length > 0) {
          // Save all questions to DynamoDB
          for (const question of questions) {
            await docClient.send(new PutCommand({
              TableName: NOTE_QUESTIONS_TABLE,
              Item: question,
            }));
          }
          
          console.log(`Generated ${questions.length} questions for note: ${note.noteId}`);
          successCount++;
        } else {
          errorCount++;
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (noteError) {
        console.error(`Error processing note ${note.noteId}:`, noteError);
        errorCount++;
      }
    }
    
    console.log(`Job completed. Success: ${successCount}, Errors: ${errorCount}`);
  } catch (error) {
    console.error('Error in note question generation job:', error);
    throw error;
  }
};
