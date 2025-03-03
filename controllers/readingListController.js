const ReadingList = require('../models/readingList');
const cache = require('memory-cache'); // Install using npm install memory-cache

const addNewManga = async (req, res) => {
    const { userId, mangaId } = req.params;
    const status = req.query.status;

    const {
        title,
        manga_status,
        statistics,
    } = req.body; // Extract from request body

    try {
        // Check if reading list exists for the user
        let readingList = await ReadingList.findOne({ user: userId });

        if (!readingList) {
            // If the reading list doesn't exist, create a new reading list
            readingList = new ReadingList({ user: userId, mangas: [] });
        }

        // Check if manga already exists in reading list
        const existingManga = readingList.mangas.find((m) => m.manga.toString() === mangaId);

        if (existingManga) {
            return res.status(400).json({ success: false, message: 'Manga already exists in reading list' });
        }

        // Add manga to reading list with status
        readingList.mangas.push({ manga: mangaId, title, manga_status, statistics, status });

        // Save the reading list
        await readingList.save();

        // Fetch the added manga from the list
        const addedManga = readingList.mangas.find((m) => m.manga.toString() === mangaId);

        // Clear cache (if you're using caching)
        cache.del(userId);

        res.status(200).json({ success: true, message: 'Manga added to reading list', manga: addedManga });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to add manga to reading list', error });
    }
};



const getReadingList = async (req, res) => {
    const { userId } = req.params;

    // Check if the reading list is in the cache
    const cachedReadingList = cache.get(userId);
    if (cachedReadingList) {
        // If found in cache, return cached data
        return res.status(200).json({
            success: true,
            message: 'Reading list retrieved successfully',
            readingList: cachedReadingList,
        });
    }

    try {
        // If not in cache, fetch from the database
        const readingList = await ReadingList.findOne({ user: userId }).populate('mangas');

        if (!readingList || readingList.length === 0) {
            return res.status(404).json({ success: false, message: 'Reading list not found' });
        }

        // Store in cache for future requests
        cache.put(userId, readingList, 60000); // Cache for 1 minute

        res.status(200).json({ success: true, message: 'Reading list retrieved successfully', readingList: readingList });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to retrieve reading list', error: error.message });
    }
};


const getOneManga = async (req, res) => {
    const { userId, mangaId } = req.params;

    try {
        // Find the reading list for the user
        const readingList = await ReadingList.findOne({ user: userId });

        if (!readingList) {
            return res.status(404).json({ success: false, message: 'Reading list not found' });
        }

        // Find the manga in the reading list
        const mangaInList = readingList.mangas.find((m) => m.manga === mangaId);

        if (!mangaInList) {
            return res.status(404).json({ success: false, message: 'Manga not found in reading list' });
        }


        cache.del(userId);

        // Return the manga details along with the status
        res.status(200).json({
            success: true,
            message: 'Manga details retrieved successfully',
            manga: mangaInList,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to get manga details', error });
    }
};

const updateMangaInReadingList = async (req, res) => {
    const { userId, mangaId } = req.params;
    const status = req.query.status;;

    try {
        const readingList = await ReadingList.findOneAndUpdate(
            { user: userId, 'mangas.manga': mangaId },
            { $set: { 'mangas.$.status': status } },
            { new: true }
        ).populate('mangas');

        if (!readingList) {
            return res.status(404).json({ success: false, message: 'Reading list or manga not found' });
        }

        cache.del(userId);

        const updatedManga = readingList.mangas.find((m) => m.manga.toString() === mangaId);

        res.status(200).json({ success: true, message: 'Manga in reading list updated successfully', manga: updatedManga });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to update manga in reading list', error });
    }
};

const deleteAllMangasFromReadingList = async (req, res) => {
    const { userId } = req.params;

    try {
        const readingList = await ReadingList.findOneAndUpdate(
            { user: userId },
            { $set: { mangas: [] } },
            { new: true }
        );
        res.status(204);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to delete all mangas from reading list', error });
    }
};

const deleteMangaFromReadingList = async (req, res) => {
    const { userId, mangaId } = req.params;

    try {
        const readingList = await ReadingList.findOneAndUpdate(
            { user: userId },
            { $pull: { mangas: { manga: mangaId } } },
            { new: true }
        ).populate('mangas');

        if (!readingList) {
            return res.status(404).json({ success: false, message: 'Reading list or manga not found' });
        }

        res.status(204).send();
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to delete manga from reading list', error });
    }
};


module.exports = { addNewManga, getReadingList, getOneManga, updateMangaInReadingList, deleteAllMangasFromReadingList, deleteMangaFromReadingList };
