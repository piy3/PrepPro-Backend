import { Router } from "express";
import { generateQuiz } from "../controller/quiz.controller.js";

const quizRoutes = Router();

quizRoutes.route('/generate').post(generateQuiz)

export default quizRoutes