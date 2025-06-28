const { User } = require("../models/user");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { auth, createUserWithEmailAndPassword } = require('../utils/firebase');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.SERVER_URL}/api/auth/google/callback`,
      proxy: true // Add this line
    },
    async function (accessToken, refreshToken, profile, done) {
      try {
        const userEmail = profile.emails[0].value;
        let user = await User.findOne({ email: userEmail });

        if (user) {
          return done(null, user);
        } else {
          try {
            const newUser = new User({
              username: profile.displayName,
              email: userEmail,
              password: profile.id,
              type: 'google',
              profilePicture: profile.photos?.[0]?.value || undefined
            });

            user = await newUser.save();

            try {
              await createUserWithEmailAndPassword(auth, userEmail, profile.id);
            } catch (firebaseError) {
              console.error('Firebase user creation failed:', firebaseError);
            }

            return done(null, user);
          } catch (createError) {
            console.error('User creation error:', createError);
            return done(createError);
          }
        }
      } catch (err) {
        console.error('Google strategy error:', err);
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});
