const bcryptjs = require("bcryptjs");
const { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword } = require('../utils/firebase');
const { createUID, randomPassword }  = require('../utils/createUID');
const { User, AnonymousUser, Bookmark } = require("../models/user");
const imagekit = require("../utils/imagekit");


// Get all users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    console.error(`Error fetching users: ${err}`);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
};

// Get one user
const getOneUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    const anonymousUser = await AnonymousUser.findById(req.params.userId);
    
    if (!user && !anonymousUser) {
      return res
        .status(404)
        .json({
          error: "User Not Found",
          message: "User with the given ID not found",
        });
    }
    
    let bookmark = await Bookmark.findOne({ userId: req.params.userId });
    
    if(user){
      res.json({
        _id: user._id,
        username: user.username,
        email: user.email,
        bio: user.bio,
        profilePicture: user.profilePicture,
        banner: user.banner,
        bookmark: bookmark ? bookmark.bookmarks : [],
      });
    }
    
    if(anonymousUser){
      res.json({
        _id: anonymousUser._id,
        username: anonymousUser.username,
        email: anonymousUser.email,
        bio: anonymousUser.bio,
        profilePicture: anonymousUser.profilePicture,
        bookmark: bookmark ? bookmark.bookmarks : []
      });
    }
    
  } catch (err) {
    console.error(`Error fetching user: ${err}`);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  }
};

// Create Anonymous User
const createAnonymousUser = async (req, res) => {
  try {
    const uid = createUID();
    const password = randomPassword();
    const hashedPassword = await bcryptjs.hash(password, 10);
    const existingUser = await AnonymousUser.findOne({ uid: req.body.uid || uid });
    if (existingUser) {
      return res
        .status(400)
        .json({ error: "Bad Request", message: "User already exists" });
    }

    const user = new AnonymousUser({
      uid: uid,
      username: `ANONYMOUS-${uid}`,
      password: hashedPassword,
    });

    await user.save();
    res.status(200).json({ uid: uid, username: `ANONYMOUS-${uid}`, password });
  } catch (err) {
    console.error(`Error creating anonymous user: ${err}`);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
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
    
    const pfpLinks = [
    ]
    
    const profilePicture = pfpLinks[Math.floor(Math.random() * pfpLinks.length)];
    
    const user = new User({
      username: req.body.username,
      email: req.body.email,
      password: hashedPassword,
      type: req.body.type,
      profilePicture: req.body.profilePicture || profilePicture,
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
    console.log(req.params.userId);
    const existingUser = await User.findById(req.params.userId);
    const existingAnonymousUser = await AnonymousUser.findById(req.params.userId);
    console.log(existingUser);
    console.log(existingAnonymousUser); 

    if (!existingUser && !existingAnonymousUser) {
      return res
        .status(404)
        .json({
          error: "User Not Found",
          message: "User with the given ID not found",
        });
    }

    console.log(req.body);
    
    const validFields = ['username', 'email', 'password', 'bio', 'coverPicture'];
    let updatedUser = {};

    validFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updatedUser[field] = req.body[field];
      }
    });

    if (req.body.type === 'password-reset' && req.body.password) {
      updatedUser.password = await bcryptjs.hash(req.body.password, 10);
    }

    // Handle profile picture upload
    if (req.files) {
      try {
        if (req.files.profilePicture) {
          const profilePictureUrl = await uploadProfilePicture(req.files.profilePicture[0], req.params.userId);
          updatedUser.profilePicture = profilePictureUrl;
        }
        if (req.files.bannerImage) {
          const bannerImageUrl = await uploadBanner(req.files.bannerImage[0], req.params.userId);
          updatedUser.banner = bannerImageUrl;
        }
      } catch (error) {
        return res.status(500).json({ error: "Internal Server Error", message: error.message });
      }
    }

    if (existingUser) {
      const user = await User.findByIdAndUpdate(req.params.userId, updatedUser, {
        new: true,
      });

      return res.status(200).json({
        _id: user._id,
        username: user.username,
        email: user.email,
        bio: user.bio,
        profilePicture: user.profilePicture,
        banner: user.banner,
        coverPicture: user.coverPicture,
      });
    }

    if (existingAnonymousUser) {
      const anonymousUser = await AnonymousUser.findByIdAndUpdate(req.params.userId, updatedUser, {
        new: true,
      });

      return res.status(200).json({
        _id: anonymousUser._id,
        username: anonymousUser.username,
        bio: anonymousUser.bio,
        profilePicture: anonymousUser.profilePicture,
        banner: anonymousUser.banner,
        coverPicture: anonymousUser.coverPicture,
      });
    }
  } catch (err) {
    console.error(`Error updating user: ${err}`);
    res.status(400).json({ error: "Bad Request", message: err.message });
  }
};

// Function to upload profile picture
const uploadProfilePicture = async (file, userId) => {
  return new Promise((resolve, reject) => {
    imagekit.upload({
      file: file.buffer,
      fileName: `${userId}`,
      folder: `pfp/${userId}`,
      isPrivateFile: false,
      useUniqueFileName: false,
    }, async (error, result) => {
      if (error) {
        console.error(`Failed to upload image ${userId}:`, error);
        reject(new Error(`Failed to upload image ${userId}: ${error.message}`));
      } else {
        
        try {
          // Purge both the URL and the folder path to ensure all caches are cleared
          await Promise.all([
            imagekit.purgeCache(result.url),
            imagekit.purgeCache(`/pfp/${userId}/*`)
          ]);
          console.log(`File ${userId} uploaded successfully as ${result.url} and cache purged.`);
          resolve(result.url);
        } catch (purgeError) {
          console.warn(`Warning: Cache purge failed for ${userId} and ${result.url} :`, purgeError);
          // Still resolve with the URL even if cache purge fails
          resolve(result.url);
        }

        
      }
    });
  });
};

// Function to upload banner
const uploadBanner = async (file, userId) => {
  return new Promise((resolve, reject) => {
    imagekit.upload({
      file: file.buffer,
      fileName: `${userId}`,
      folder: `banner/${userId}`,
      isPrivateFile: false,
      useUniqueFileName: false,
    }, async (error, result) => {
      if (error) {
        console.error(`Failed to upload image ${userId}:`, error);
        reject(new Error(`Failed to upload image ${userId}: ${error.message}`));
      } else {
        
        try {
          // Purge both the URL and the folder path to ensure all caches are cleared
          await Promise.all([
            imagekit.purgeCache(result.url),
            imagekit.purgeCache(`/banner/${userId}/*`)
          ]);
          console.log(`File ${userId} uploaded successfully as ${result.url} and cache purged.`);
          resolve(result.url);
        } catch (purgeError) {
          console.warn(`Warning: Cache purge failed for ${userId} and ${result.url} :`, purgeError);
          // Still resolve with the URL even if cache purge fails
          resolve(result.url);
        }

      }
    });
  });
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

const addBookmark = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        const anonymousUser = await AnonymousUser.findById(req.params.userId);

        if (!user && !anonymousUser) {
            return res.status(404).json({
                error: "User Not Found",
                message: "User with the given ID not found",
            });
        }

        const userId = user ? user._id : anonymousUser._id;
        const username = user ? user.username : anonymousUser.username;

        let bookmark = await Bookmark.findOne({ userId });
        if (!bookmark) {
            bookmark = new Bookmark({ userId, username, bookmarks: [] });
        }

        const newSeries = {
            series: req.body.seriesName,
            thumbnail: req.body.thumbnail || '',
            rating: req.body.rating || 0,
            lastRead: req.body.lastRead || 0,
            lastUpdated: req.body.lastUpdated || Date.now(),
            likedChapters: req.body.likedChapters || []
        };

        // Check if the series already exists in the bookmarks
        const existingSeriesIndex = bookmark.bookmarks.findIndex(b => b.series === newSeries.series);
        if (existingSeriesIndex === -1) {
            bookmark.bookmarks.push(newSeries);
        } else {
            // Update the existing series entry
            bookmark.bookmarks[existingSeriesIndex] = newSeries;
        }

        await bookmark.save();

        return res.status(200).json({
            status: "success",
            _id: userId,
            username,
            bookmarks: bookmark.bookmarks,
        });
    } catch (err) {
        console.error(`Error adding bookmark: ${err}`);
        res.status(400).json({ error: "Bad Request", message: err.message });
    }
};

const getBookmarks = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        const anonymousUser = await AnonymousUser.findById(req.params.userId);

        if (!user && !anonymousUser) {
            return res.status(404).json({
                error: "User Not Found",
                message: "User with the given ID not found",
            });
        }

        const userId = user ? user._id : anonymousUser._id;
        const username = user ? user.username : anonymousUser.username;

        let bookmark = await Bookmark.findOne({ userId });
        if (!bookmark) {
            return res.status(404).json({
                error: "Bookmark Not Found",
                message: "Bookmark for the given user not found",
            });
        }

        return res.status(200).json({
            status: "success",
            _id: userId,
            username,
            bookmarks: bookmark.bookmarks,
        });
    } catch (err) {
        console.error(`Error getting bookmarks: ${err}`);
        res.status(400).json({ error: "Bad Request", message: err.message });
    }
};

const removeBookmark = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        const anonymousUser = await AnonymousUser.findById(req.params.userId);

        if (!user && !anonymousUser) {
            return res.status(404).json({
                error: "User Not Found",
                message: "User with the given ID not found",
            });
        }

        const userId = user ? user._id : anonymousUser._id;
        const username = user ? user.username : anonymousUser.username;

        let bookmark = await Bookmark.findOne({ userId });
        if (!bookmark) {
            return res.status(404).json({
                error: "Bookmark Not Found",
                message: "Bookmark for the given user not found",
            });
        }

        bookmark.bookmarks = bookmark.bookmarks.filter(series => series.series !== req.body.seriesName);
        await bookmark.save();

        return res.status(200).json({
            _id: userId,
            status: "success",
            message: "Bookmark removed successfully",
            username,
            bookmarks: bookmark.bookmarks,
        });
    } catch (err) {
        console.error(`Error removing bookmark: ${err}`);
        res.status(400).json({ error: "Bad Request", message: err.message });
    }
};


module.exports = {
  getAllUsers,
  getOneUser,
  createUser,
  updateUser,
  deleteUser,
  createAnonymousUser,
  addBookmark,
  getBookmarks,
  removeBookmark
};
