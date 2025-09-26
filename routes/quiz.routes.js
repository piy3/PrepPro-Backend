import { Router } from "express";
import { generateQuiz, getQuiz } from "../controller/quiz.controller.js";

const quizRoutes = Router();

quizRoutes.route('/generate').post(generateQuiz)
quizRoutes.route('/getquiz').get(getQuiz)

export  {quizRoutes}