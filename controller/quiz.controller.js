import dotenv from 'dotenv'
dotenv.config()

const generateQuiz = async (req, res) => {
    try {
        const { topic, role, numberOfQuestions, difficulty, description } = req.body;
        if (!topic || !role || !numberOfQuestions || !difficulty) {
            return res.status(400).json({ message: "All fields are required" })
        }
        const quiz = await makeAIQuiz({ topic, role, numberOfQuestions, difficulty, description });

        res.json({
            topic,
            role,
            difficulty,
            description,
            questions: quiz.map(q => ({
                question: q.question,
                options: q.options
            })),
            answers: quiz.map(q => q.answer)
        });
    } catch (error) {
        console.log("quiz generation failed:",error)
        res.status(500).json({ error: 'Failed to generate quiz' });
    }

}

const makeAIQuiz = async ({ topic, role, numberOfQuestions, difficulty, description }) => {
    const prompt = `
      Generate ${numberOfQuestions} quiz questions with 4 options and the correct answer.
      Topic: ${topic}
      Role: ${role}
      Difficulty: ${difficulty}
      Description: ${description}
      Output format: JSON array with each item having 'question', 'options' (array of 4), and 'answer'.
    `;
  
    const response = await fetch(process.env.GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [
          { parts: [{ text: prompt }] }
        ]
      })
    });
  
    const data = await response.json();
    console.log("DATA:", data);
  
    try {
      // Handle Gemini API response format
      const generatedContent = data?.candidates?.[0]?.content;
      console.log("GENERATED TEXT:", generatedContent);
      
      // Extract the text from the response
      const generatedText = generatedContent?.parts?.[0]?.text || '';
      
      if (!generatedText) {
        throw new Error('No generated text in response');
      }
      
      // Clean the code block fences
      const jsonText = generatedText
        .replace(/^```json\s*/, '')  // Remove opening ```json
        .replace(/```$/, '')         // Remove closing ```
        .trim();
  
      const quiz = JSON.parse(jsonText);
      return quiz;
    } catch (err) {
      console.error('Failed to parse AI response:', err);
      throw new Error('AI response parsing error');
    }
  };

export  {generateQuiz}