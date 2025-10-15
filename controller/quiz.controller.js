import dotenv from "dotenv";
import { prisma } from "../utils/prismaClient.js";
dotenv.config();

const generateQuiz = async (req, res) => {
  try {
    const { topic, role, numberOfQuestions, difficulty, description } =
      req.body;
    if (!topic || !role || !numberOfQuestions || !difficulty) {
      return res.status(200).json({ message: "All fields are required" });
    }
    const quiz = await makeAIQuiz({
      topic,
      role,
      numberOfQuestions,
      difficulty,
      description,
    });
    res.status(200).json(quiz);
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
    console.log("quiz generation failed:", error);
    res.status(200).json({ error: "Failed to generate quiz" });
  }
};

const makeAIQuiz = async ({
  topic,
  role,
  numberOfQuestions,
  difficulty,
  description,
  req,
  res,
}) => {
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
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  const data = await response.json();
  // console.log("DATA:", data);

  try {
    // Handle Gemini API response format
    const generatedContent = data?.candidates?.[0]?.content;

    // Extract the text from the response
    const generatedText = generatedContent?.parts?.[0]?.text || "";

    if (!generatedText) {
      throw new Error("No generated text in response");
    }
    // console.log("GENERated :",generatedText)
    // Clean the code block fences
    const jsonText = generatedText
      .replace(/^```json\s*/, "") // Remove opening ```json
      .replace(/```$/, "") // Remove closing ```
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
      },
    });
    // console.log("SAVED QUIZ:",savedQuiz )
    // return {_id:savedQuiz.id,...savedQuiz}
    return savedQuiz;
  } catch (err) {
    console.error("Failed to parse AI response:", err);
    // return res.status(200).json({
    //     success:false,
    //     message:"Quiz not generated.Try Again!",
    //     error:err.message
    //   })
    throw new Error(err.message);
  }
};

//to get all quizzes
const getQuiz = async (req, res) => {
  try {
    const { cursor, limit = 10 } = req.query;

    const quizzes = await prisma.quiz.findMany({
      take: Number(limit),
      skip: cursor ? 1 : 0, // skip cursor itself
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: "desc" },
    });

    // Next cursor (id of last quiz in this batch)
    const nextCursor =
      quizzes.length > 0 ? quizzes[quizzes.length - 1].id : null;

    // Compute participants (distinct users) per quiz in this page using a single aggregation
    const quizIds = quizzes.map((q) => q.id);

    let participantsByQuizId = {};
    if (quizIds.length > 0) {
      const raw = await prisma.quizAttempt.aggregateRaw({
        pipeline: [
          { $match: { quizId: { $in: quizIds.map((id) => ({ $oid: id })) } } },
          { $group: { _id: { quizId: "$quizId", userId: "$userId" } } }, // unique (quizId,userId)
          { $group: { _id: "$_id.quizId", count: { $sum: 1 } } },
        ],
      });

      // raw items look like: { _id: { $oid: "..." }, count: <number> }
      participantsByQuizId = (raw || []).reduce((acc, doc) => {
        const id = doc?._id?.$oid || "";
        if (id) acc[id] = doc.count || 0;
        return acc;
      }, {});
    }

    const dataWithParticipants = quizzes.map((q) => ({
      id: q.id,
      topic: q.topic,
      role: q.role,
      difficulty: q.difficulty,
      description: q.description,
      participants: participantsByQuizId[q.id] || 0,
      duration: q.questions.length,
    }));

    res.status(200).json({
      data: dataWithParticipants,
      nextCursor,
    });
  } catch (err) {
    res.status(200).json({
      success: false,
      message: "Failed to fetch quizzes",
      error: err.message,
    });
  }
};

//to get current quiz
const getCurrentQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    if (!quizId) {
      return res.status(200).json({ message: "Quiz ID is required" });
    }
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
    });
    if (!quiz) {
      return res.status(200).json({ message: "Quiz not found" });
    }
    res.status(200).json(quiz);
  } catch (error) {
    console.log("getCurrentQuiz error:", error);
    res.status(200).json({ error: "Failed to fetch quiz" });
  }
};

const getQuizAttempts = async (req, res) => {
   try {
    const { quizId } = req.params;
    if (!quizId) {
      return res.status(200).json({ message: "Quiz ID is required" });
    }

    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId },
      include: { user: { select: { id: true, fullname: true } } },
      orderBy:{score:"desc"}
    });

    res.status(200).json(attempts);
  } catch (error) {
    console.log("getQuizAttempts error:", error);
    res.status(200).json({ error: "Failed to fetch quiz attempts" });
  }
};

const submitQuiz = async (req, res) => {
  const quizId = req.params.quizId;
  const { answers, timeTaken } = req.body;
  const userId = req.user?.id;
  if (!userId) {
    return res.status(200).json({
      success: false,
      message: "User not authenticated",
    });
  }
  if (!quizId || !answers) {
    return res.status(200).json({
      success: false,
      message: "All fields are required",
    });
  }
  const getQuiz = await prisma.quiz.findUnique({
    where: { id: quizId },
  });
  if (!getQuiz) {
    return res.status(200).json({
      success: false,
      message: "Quiz not found",
    });
  }
  //calculate score
  let score = 0;
  let correctAns = 0;
  getQuiz.answers.forEach((ans, index) => {
    // Convert answers object to array format or compare directly with object keys
    const userAnswer = answers[index.toString()]; // answers comes as {"0": 4, "1": 2, ...}
    console.log(userAnswer)
    if (ans === (userAnswer + 1).toString()) {
      score += 1;
    }
  });
  correctAns = score;
  console.log(correctAns);
  score = (score / timeTaken) * 100; // score in percentage
  //save the attempt
  try{
    const attempt = await prisma.quizAttempt.create({
        data: {
          userId,
          quizId,
          correctAnswers: correctAns,
          score,
          timeTaken,
        },
      });
      return res.status(200).json({
        success: true,
        message: "Quiz submitted successfully",
        attempt,
        quiz:getQuiz
      });
  }catch(err){
    console.log("submitQuiz error:", err);
    res.status(200).json({
      success: false,
      message: "Failed to submit quiz",
      error: err.message,
    });
  }
  
};

export { generateQuiz, getQuiz, getCurrentQuiz,getQuizAttempts, submitQuiz };
