const express = require("express");
const router = express.Router();
const jwt = require('jsonwebtoken');

//Import rate limit middleware
const limiter = require("../middlewares/rateLimit")

const {
  login,
  logout,
  passportLogin,
  adminLogin,
  adminCreate,
  jwtCreate
} = require("../controllers/authController");
const passport = require("passport");
const { authMiddleware, frontAuthMiddleware } = require("../middlewares/auth");

const googleAuth = passport.authenticate("google", {
  scope: ["profile", "email"],
});

// Login
router.post("/login", limiter, frontAuthMiddleware, login);

router.get("/login/success", passportLogin);

router.get("/logout", logout);

router.get("/google", passport.authenticate("google", {
  scope: ["profile", "email"],
  prompt: "select_account",
  accessType: "offline"
}));


router.post('/admin/login', limiter, authMiddleware, adminLogin);

// router.post('/jwt', jwtCreate)

//router.post('/admin/create', authMiddleware, adminCreate)

router.get('/google/callback', passport.authenticate("google", {
  failureRedirect: `${process.env.CLIENT_URL}/login/failed`,
  failureFlash: true
}), passportLogin);

module.exports = router;
