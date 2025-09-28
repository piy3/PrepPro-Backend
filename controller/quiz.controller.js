import dotenv from 'dotenv'
import {prisma} from "../utils/prismaClient.js"
dotenv.config()

const generateQuiz = async (req, res) => {
    try {
        const { topic, role, numberOfQuestions, difficulty, description } = req.body;
        if (!topic || !role || !numberOfQuestions || !difficulty) {
            return res.status(200).json({ message: "All fields are required" })
        }
        const quiz = await makeAIQuiz({ topic, role, numberOfQuestions, difficulty, description });
        res.status(200).json(quiz)
        // res.json({
        //     topic,
        //     role,
        //     difficulty,
        //     description,
        //     questions: quiz.map(q => ({
        //         question: q.question,
        //         options: q.options
        //     })),
        //     answers: quiz.map(q => q.answer)
        // });
    } catch (error) {
        console.log("quiz generation failed:",error)
        res.status(200).json({ error: 'Failed to generate quiz' });
    }

}

const makeAIQuiz = async ({ topic, role, numberOfQuestions, difficulty, description ,req,res}) => {
    const prompt = `
      Generate ${numberOfQuestions} quiz questions with 4 options and the correct answer.
      Topic: ${topic}
      Role: ${role}
      Difficulty: ${difficulty}
      Description: ${description}
      Output format: JSON array with each item having 'question', 'options' (array of 4), and a seperate 'answers' array with answer of each question only stating the correct answer option number like  and also don't generate questons with any code block.Below is a output format:
      {
        "questions": [
          {
              "question": "What is the primary difference between null and undefined in JavaScript?",
              "options": [
                  "null is a primitive value that represents the intentional absence of any object value, while undefined indicates a variable has been declared but not assigned a value.",
                  "undefined is a primitive value that represents the intentional absence of any object value, while null indicates a variable has been declared but not assigned a value.",
                  "They are interchangeable and can be used in any context to represent the absence of a value.",
                  "Both represent errors in the code and should be avoided."
              ]
          },
          {
              "question": "Which of the following array methods does *not* mutate the original array?",
              "options": [
                  ".push()",
                  ".splice()",
                  ".map()",
                  ".sort()"
              ]
          }
      ],
      "answers": [
          "1",
          "3"
      ]
    }
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
    // console.log("DATA:", data);
  
    try {
      // Handle Gemini API response format
      const generatedContent = data?.candidates?.[0]?.content;
      
      
      // Extract the text from the response
      const generatedText = generatedContent?.parts?.[0]?.text || '';
      
      if (!generatedText) {
        throw new Error('No generated text in response');
      }
      // console.log("GENERated :",generatedText)
      // Clean the code block fences
      const jsonText = generatedText
        .replace(/^```json\s*/, '')  // Remove opening ```json
        .replace(/```$/, '')         // Remove closing ```
        .trim();
  
      const quiz = JSON.parse(jsonText);
      // console.log("QUIZ:::", quiz)
      //save the quiz to db 
      const savedQuiz = await prisma.quiz.create({
        data: {
          topic,
          role,
          difficulty,
          description,
          // questions: quiz.questions.map(q => ({
          //   question: q.question,
          //   options: q.options
          // })),
          // answers: quiz.answers
        }
      });
      // console.log("SAVED QUIZ:",savedQuiz )
      // return {_id:savedQuiz.id,...savedQuiz}
      return savedQuiz
    } 
    catch (err) {
      console.error('Failed to parse AI response:', err);
      // return res.status(200).json({
    //     success:false,
    //     message:"Quiz not generated.Try Again!",
    //     error:err.message
    //   })
    throw new Error(err.message)
    }
  };

const getQuiz = async (req, res) => {
  try{
    const { cursor, limit = 10 } = req.query;

    const quizzes = await prisma.quiz.findMany({
      take: Number(limit),
      skip: cursor ? 1 : 0, // skip cursor itself
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: "desc" }
    });

    // Next cursor (id of last quiz in this batch)
    const nextCursor = quizzes.length > 0 ? quizzes[quizzes.length - 1].id : null;

    // Compute participants (distinct users) per quiz in this page using a single aggregation
    const quizIds = quizzes.map(q => q.id);

    let participantsByQuizId = {};
    if (quizIds.length > 0) {
      const raw = await prisma.quizAttempt.aggregateRaw({
        pipeline: [
          { $match: { quizId: { $in: quizIds.map(id => ({ $oid: id })) } } },
          { $group: { _id: { quizId: "$quizId", userId: "$userId" } } }, // unique (quizId,userId)
          { $group: { _id: "$_id.quizId", count: { $sum: 1 } } }
        ]
      });

      // raw items look like: { _id: { $oid: "..." }, count: <number> }
      participantsByQuizId = (raw || []).reduce((acc, doc) => {
        const id = doc?._id?.$oid || "";
        if (id) acc[id] = doc.count || 0;
        return acc;
      }, {});
    }

    const dataWithParticipants = quizzes.map(q => ({
      id: q.id,
      topic: q.topic,
      role: q.role,
      difficulty: q.difficulty,
      description: q.description,
      participants: participantsByQuizId[q.id] || 0,
      duration: q.questions.length
    }));

    res.status(200).json({
      data: dataWithParticipants,
      nextCursor
    });
  }catch(err){
    res.status(200).json({
      success:false,
      message:"Failed to fetch quizzes",
      error:err.message
    })
    
  }
  

}


export  {generateQuiz,getQuiz}