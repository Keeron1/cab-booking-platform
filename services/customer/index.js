require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
// const jwt = require("jsonwebtoken");

// npm install express mongoose brcypt dotenv

const PORT = process.env.PORT || 3001;

const app = express()
app.use(cors());
app.use(express.json());

