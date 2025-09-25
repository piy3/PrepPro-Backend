import express from "express"
import { authUser, loginUser, registerUser } from "../controller/user.controller.js";

const userRoutes = express.Router();

userRoutes.route("/register").post(registerUser)
userRoutes.route("/login").post(loginUser)
userRoutes.route("/authuser").post(authUser)

export {userRoutes}