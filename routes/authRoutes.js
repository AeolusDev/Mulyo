const express = require("express");
const router = express.Router();
const jwt = require('jsonwebtoken');

//Import rate limit middleware
const { limiter } = require("../middlewares/rateLimit");
const { verifyUserSession, createOrExtendSession } = require('../utils/sessionVerifier');

const {
  login,
  discord,
  logout,
  passportLogin,
  adminLogin,
  adminLogout,
  adminCreate,
  jwtCreate,
  checkRole,
  verifySession
} = require("../controllers/authController");
const passport = require("passport");
const { authMiddleware, frontAuthMiddleware } = require("../middlewares/auth");

const googleAuth = passport.authenticate("google", {
  scope: ["profile", "email"],
});

// Login
router.post("/login", limiter, frontAuthMiddleware, login);

router.post("/verifySession", limiter, verifySession);

// router.post("/jwt", limiter, jwtCreate);

router.post("/discord", limiter, discord);

router.post("/admin/checkRole", limiter, authMiddleware, checkRole);

router.get("/login/success", passportLogin);

router.get("/logout", logout);

router.get("/google", passport.authenticate("google", {
  scope: ["profile", "email"],
  prompt: "select_account",
  accessType: "offline"
}));

router.post('/admin/create', limiter, authMiddleware, adminCreate);

router.post('/admin/login', limiter, authMiddleware, adminLogin);

router.post('/admin/logout', limiter, authMiddleware, adminLogout);

router.get('/google/callback', passport.authenticate("google", {
  failureRedirect: `${process.env.CLIENT_URL}/login/failed`,
  failureFlash: true
}), passportLogin);

module.exports = router;
