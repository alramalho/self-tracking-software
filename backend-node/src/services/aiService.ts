import { openai } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { logger } from "../utils/logger";

export class AIService {
  private model: string;

  constructor() {
    this.model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  }

  async generateText(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      const result = await generateText({
        model: openai(this.model),
        prompt,
        system: systemPrompt,
        maxTokens: 1000,
        temperature: 0.7,
      });

      return result.text;
    } catch (error) {
      logger.error("Error generating text:", error);
      throw new Error(`Text generation failed: ${error}`);
    }
  }

  async generateStructuredResponse<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    systemPrompt?: string
  ): Promise<T> {
    try {
      const result = await generateObject({
        model: openai(this.model),
        prompt,
        system: systemPrompt,
        schema,
        maxTokens: 1500,
        temperature: 0.3, // Lower temperature for structured responses
      });

      return result.object;
    } catch (error) {
      logger.error("Error generating structured response:", error);
      throw new Error(`Structured response generation failed: ${error}`);
    }
  }

  // Activity extraction from text
  async extractActivities(
    message: string,
    userContext?: string
  ): Promise<{
    activities: Array<{
      activityId?: string;
      title: string;
      quantity: number;
      measure: string;
      date: string;
      description?: string;
    }>;
    confidence: number;
  }> {
    const schema = z.object({
      activities: z.array(
        z.object({
          activityId: z.string().optional(),
          title: z.string(),
          quantity: z.number(),
          measure: z.string(),
          date: z.string(),
          description: z.string().optional(),
        })
      ),
      confidence: z.number().min(0).max(1),
    });

    const systemPrompt = `You are an expert at extracting activity information from user messages. 
    Extract any activities mentioned with their quantities, measures, and dates.
    ${userContext ? `User context: ${userContext}` : ""}
    
    Guidelines:
    - Only extract clear, specific activities
    - Infer reasonable measures (e.g., "minutes", "reps", "miles")
    - Use today's date if no date is mentioned
    - Set confidence based on clarity of the information`;

    return this.generateStructuredResponse(message, schema, systemPrompt);
  }

  // Metrics extraction from text
  async extractMetrics(
    message: string,
    userContext?: string
  ): Promise<{
    metrics: Array<{
      metric_id?: string;
      name: string;
      rating: number;
      date: string;
      notes?: string;
    }>;
    confidence: number;
  }> {
    const schema = z.object({
      metrics: z.array(
        z.object({
          metric_id: z.string().optional(),
          name: z.string(),
          rating: z.number().min(1).max(10),
          date: z.string(),
          notes: z.string().optional(),
        })
      ),
      confidence: z.number().min(0).max(1),
    });

    const systemPrompt = `You are an expert at extracting metric ratings from user messages.
    Extract any subjective ratings or feelings mentioned (mood, energy, sleep quality, etc.).
    ${userContext ? `User context: ${userContext}` : ""}
    
    Guidelines:
    - Rate on scale of 1-10 based on user's description
    - Use today's date if no date is mentioned
    - Common metrics: mood, energy, sleep, stress, focus, productivity
    - Set confidence based on clarity of the sentiment`;

    return this.generateStructuredResponse(message, schema, systemPrompt);
  }

  // Plan creation from user goals with AI response
  async createPlanWithResponse(
    goals: string,
    userContext?: string
  ): Promise<{
    plan: {
      title: string;
      goal: string;
      description: string;
      duration_weeks: number;
      emoji?: string;
    };
    activities: Array<{
      title: string;
      measure: string;
      emoji: string;
      frequency_per_week: number;
      target_quantity: number;
    }>;
    ai_response: string;
    confidence: number;
  }> {
    const schema = z.object({
      plan: z.object({
        title: z.string(),
        goal: z.string(),
        description: z.string(),
        duration_weeks: z.number().min(1).max(52),
        emoji: z.string().optional(),
      }),
      activities: z.array(
        z.object({
          title: z.string(),
          measure: z.string(),
          emoji: z.string(),
          frequency_per_week: z.number().min(1).max(7),
          target_quantity: z.number().min(1),
        })
      ),
      ai_response: z.string(),
      confidence: z.number().min(0).max(1),
    });

    const systemPrompt = `You are an expert fitness and wellness coach. Create a realistic, achievable plan based on user goals and provide an encouraging response about the plan you've created.
    ${userContext ? `User context: ${userContext}` : ""}
    
    Guidelines:
    - Create specific, measurable activities
    - Set realistic frequencies and quantities
    - Include appropriate emojis
    - Focus on sustainable habits
    - Duration should be appropriate for the goal complexity
    - Generate an encouraging AI response that references the specific plan you created
    - Make the response personal and motivating`;

    return this.generateStructuredResponse(goals, schema, systemPrompt);
  }

  // Plan creation from user goals (separate method for backwards compatibility)
  async createPlan(
    goals: string,
    userContext?: string
  ): Promise<{
    plan: {
      title: string;
      goal: string;
      description: string;
      duration_weeks: number;
      emoji?: string;
    };
    activities: Array<{
      title: string;
      measure: string;
      emoji: string;
      frequency_per_week: number;
      target_quantity: number;
    }>;
    confidence: number;
  }> {
    const schema = z.object({
      plan: z.object({
        title: z.string(),
        goal: z.string(),
        description: z.string(),
        duration_weeks: z.number().min(1).max(52),
        emoji: z.string().optional(),
      }),
      activities: z.array(
        z.object({
          title: z.string(),
          measure: z.string(),
          emoji: z.string(),
          frequency_per_week: z.number().min(1).max(7),
          target_quantity: z.number().min(1),
        })
      ),
      confidence: z.number().min(0).max(1),
    });

    const systemPrompt = `You are an expert fitness and wellness coach. Create a realistic, achievable plan based on user goals.
    ${userContext ? `User context: ${userContext}` : ""}
    
    Guidelines:
    - Create specific, measurable activities
    - Set realistic frequencies and quantities
    - Include appropriate emojis
    - Focus on sustainable habits
    - Duration should be appropriate for the goal complexity`;

    return this.generateStructuredResponse(goals, schema, systemPrompt);
  }

  // Analyze user profile from conversation
  async analyzeUserProfile(
    conversation: string,
    questions: string[]
  ): Promise<{
    profile: string;
    age?: number;
    interests: string[];
    goals: string[];
    question_analysis: Array<{
      question: string;
      answered: boolean;
      answer?: string;
      confidence: number;
    }>;
  }> {
    const schema = z.object({
      profile: z.string(),
      age: z.number().optional(),
      interests: z.array(z.string()),
      goals: z.array(z.string()),
      question_analysis: z.array(
        z.object({
          question: z.string(),
          answered: z.boolean(),
          answer: z.string().optional(),
          confidence: z.number().min(0).max(1),
        })
      ),
    });

    const systemPrompt = `You are an expert at analyzing user conversations to build comprehensive profiles.
    Analyze the conversation and determine what information is available about the user.
    
    Guidelines:
    - Extract key demographic and psychographic information
    - Identify interests, goals, and preferences
    - For each question, determine if it was answered in the conversation
    - Provide confidence scores for your analysis`;

    const prompt = `Conversation: ${conversation}
    
    Questions to analyze: ${questions.join(", ")}`;

    return this.generateStructuredResponse(prompt, schema, systemPrompt);
  }

  // Generate motivational messages
  async generateMotivationalMessage(
    userProfile: string,
    context: string
  ): Promise<string> {
    const systemPrompt = `You are a supportive wellness coach. Generate motivational messages that are:
    - Encouraging but not overly optimistic
    - Personalized to the user
    - Actionable and specific
    - Warm and genuine
    
    Avoid generic phrases and focus on the user's specific situation.`;

    const prompt = `User profile: ${userProfile}
    Context: ${context}
    
    Generate a motivational message for this user.`;

    return this.generateText(prompt, systemPrompt);
  }

  // Extract activities for plan creation
  async extractActivitiesForPlan(
    message: string,
    userContext?: string
  ): Promise<{
    activities: Array<{
      title: string;
      emoji: string;
      measure: string;
      reasoning: string;
    }>;
    confidence: number;
  }> {
    const schema = z.object({
      activities: z.array(
        z.object({
          title: z.string(),
          emoji: z.string(),
          measure: z.string(),
          reasoning: z.string(),
        })
      ),
      confidence: z.number().min(0).max(1),
    });

    const systemPrompt = `You are an expert at extracting activities for plan creation.
    ${userContext ? `Context: ${userContext}` : ""}
    
    Guidelines:
    - Extract activities mentioned in the conversation
    - Use atomic measures (e.g., 'pages', 'minutes', 'kilometers', not 'books' or 'marathons')
    - For reading: use 'pages', for running: use 'kilometers' or 'minutes'
    - For gym: use 'minutes' or 'sessions'
    - Provide clear reasoning for each activity
    - Set confidence based on clarity of information`;

    return this.generateStructuredResponse(message, schema, systemPrompt);
  }

  // Check if conversation answers specific questions
  async analyzeQuestionCoverage(
    conversation: string,
    questions: Record<string, string>
  ): Promise<{
    all_answered: boolean;
    results: Record<
      string,
      {
        answered: boolean;
        reasoning: string;
        confidence: number;
      }
    >;
    follow_up_message: string;
  }> {
    const schema = z.object({
      all_answered: z.boolean(),
      results: z.record(
        z.object({
          answered: z.boolean(),
          reasoning: z.string(),
          confidence: z.number().min(0).max(1),
        })
      ),
      follow_up_message: z.string(),
    });

    const systemPrompt = `You are an expert conversation analyst. Determine if the conversation contains sufficient information to answer each question.
    
    Guidelines:
    - Be thorough in your analysis
    - Provide clear reasoning for each decision
    - Generate appropriate follow-up messages
    - If all questions are answered, thank the user
    - If questions remain, ask for the missing information specifically`;

    const prompt = `Conversation: ${conversation}
    
    Questions to check: ${JSON.stringify(questions, null, 2)}
    
    Analyze whether the conversation contains information to answer each question.`;

    return this.generateStructuredResponse(prompt, schema, systemPrompt);
  }
}

export const aiService = new AIService();
