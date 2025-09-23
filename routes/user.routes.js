import express from "express"
import { registerUser } from "../controller/user.controller.js";

const userRoutes = express.Router();

userRoutes.route("/register").post(registerUser)

export {userRoutes}