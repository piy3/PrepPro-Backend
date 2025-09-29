import { Router } from "express";
import { generateQuiz, getQuiz,getCurrentQuiz,submitQuiz } from "../controller/quiz.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const quizRoutes = Router();

quizRoutes.route('/generate').post(generateQuiz)
quizRoutes.route('/getquiz').get(getQuiz)
quizRoutes.route('/getcurrentquiz/:quizId').get(getCurrentQuiz)
quizRoutes.route('/submitquiz/:quizId').post(verifyJWT,submitQuiz)
export  {quizRoutes}