const User = require("../models/user");
const bcryptjs = require("bcryptjs");
const { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword } = require('../utils/firebase');

// Get all users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Internal Server Error", message: err.message });
  }
};

// Get one user
const getOneUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res
        .status(404)
        .json({
          error: "User Not Found",
          message: "User with the given ID not found",
        });
    }
    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      bio: user.bio,
      profilePicture: user.profilePicture,
    });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Internal Server Error", message: err.message });
  }
};

// Create a user
const createUser = async (req, res) => {
  try {
    const existingUser = await User.findOne({ email: req.body.email });
    
    if (existingUser) {
      return res
        .status(400)
        .json({ error: "Bad Request", message: "Email is already in use" });
    }

    const hashedPassword = await bcryptjs.hash(req.body.password, 10);
    
    const user = new User({
      username: req.body.username,
      email: req.body.email,
      password: hashedPassword,
      type: req.body.type,
      profilePicture: req.body.profilePicture,
    });

    const firebaseCreate = await createUserWithEmailAndPassword(auth, req.body.email, req.body.password);
    const firebaseResponse = {
      uid: firebaseCreate.user.uid,
      email: firebaseCreate.user.email,
      createdAt: firebaseCreate.user.metadata.creationTime,
      updatedAt: firebaseCreate.user.metadata.lastSignInTime,
      emailVerified: firebaseCreate.user.emailVerified,
      isAnonymous: firebaseCreate.user.isAnonymous
    }
    user.save();
    
    res.status(200).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      firebase: firebaseResponse,
    });
    
  } catch (err) {
    res.status(400).json({ error: "Bad Request", message: err.message });
  }
};

// Update a user
const updateUser = async (req, res) => {
  try {
    console.log(req.params);
    const existingUser = await User.findById(req.params.userId);
    if (!existingUser) {
      return res
        .status(404)
        .json({
          error: "User Not Found",
          message: "User with the given ID not found",
        });
    }
    
    const validFields = ['username', 'email', 'password', 'bio', 'profilePicture', 'coverPicture'];
    let updatedUser = {};

    validFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updatedUser[field] = req.body[field];
      }
    });

    if (req.body.type === 'password-reset' && req.body.password) {
      updatedUser.password = await bcryptjs.hash(req.body.password, 10);
    }

    const user = await User.findByIdAndUpdate(req.params.userId, updatedUser, {
      new: true,
    });
  
    res.status(200).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      bio: user.bio,
      profilePicture: user.profilePicture,
      coverPicture: user.coverPicture,
    });
    
  } catch (err) {
    res.status(400).json({ error: "Bad Request", message: err.message });
  }
};


// Delete a user
const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.userId);
    if (!user) {
      return res
        .status(404)
        .json({
          error: "User Not Found",
          message: "User with the given ID not found",
        });
    }
    res.status(204);
  } catch (err) {
    res
      .status(500)
      .json({ error: "Internal Server Error", message: err.message });
  }
};

module.exports = {
  getAllUsers,
  getOneUser,
  createUser,
  updateUser,
  deleteUser,
};
