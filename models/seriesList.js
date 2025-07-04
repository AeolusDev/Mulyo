const mongoose = require('mongoose');

// Schema for individual chapters
const ChapterSchema = new mongoose.Schema({
  chapterName: { type: String},
  chapterNo: { type: String, required: true },
  isComplete: { type: Boolean, default: false },
  pageCount: { type: Number, default: 0 },
  thumbnail: { type: String },
  visibility: { type: String, default: 'public' }
});

// Schema for the main series list
const SeriesListSchema = new mongoose.Schema({
  mangas: [{
    manga: { type: String, required: true }, // Unique ID
    title: { type: String, required: true },
    nick: { type: String, required: true },
    desc: { type: String, required: true },
    thumbnail: { type: String, required: true },
    manga_status: { type: String, required: true },
    author: { type: String, required: true },
    anilist: { type: String },
    mal: { type: String },
    naver: { type: String },
    webtoon: { type: String },
    newtoki: { type: String },
    chapterCount: { type: Number, default: 0 },
    maxChaptersUploaded: { type: Number, default: 0 },
    genre: { type: String, required: true },
    releaseDate: { type: Date, required: true },
    statistics: {
      likes: { type: Number },
      rating: { type: Number },
    },
    status: { type: String },
    created_at: { type: Date, default: Date.now },
    visibility: { type: String, default: 'public' },
    chapters: [ChapterSchema],
  }]
});

// Schema for latest releases
const LatestReleaseSchema = new mongoose.Schema({
  manga: { type: String, required: true }, // Reference to manga ID
  chapterName: { type: String },
  title: { type: String, required: true },
  nick: { type: String, required: true },
  chapterNo: { type: String, required: true },
  previousChapter: { type: String, required: true },
  thumbnail: { type: String, required: true }, // URL of the first page
  pageCount: { type: Number, required: true },
  uploadDate: { type: Date, default: Date.now },
  isComplete: { type: Boolean, default: false },
}, {
  timestamps: true,
  visibility: { type: String, default: 'public' }
});

const statsSchema = new mongoose.Schema({
  likes: { type: Array },
  rating: { type: Array },
});

// Create indexes for better query performance
LatestReleaseSchema.index({ uploadDate: -1 }); // Index for sorting by upload date
LatestReleaseSchema.index({ manga: 1, chapterNo: 1 }); // Compound index for finding specific chapters

const seriesList = mongoose.model('SeriesList', SeriesListSchema);
const latestRelease = mongoose.model('LatestRelease', LatestReleaseSchema);
const stats = mongoose.model('Stats', statsSchema);

module.exports = { seriesList, latestRelease, stats };
