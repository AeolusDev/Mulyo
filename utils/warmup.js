const axios = require('axios');
const chalk = require('chalk');

// List of critical URLs to warm up (both dynamic and static)
const URLS_TO_WARM = [
  '/api/admin/getLatestUpdate', // Latest updates API
  '/api/admin/getAllSeries', // All series API
];

// Cloudflare API credentials (from environment variables)
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID;

// Backblaze B2 credentials (from environment variables)
const B2_ACCOUNT_ID = process.env.BACKBLAZE_KEY_ID;
const B2_APPLICATION_KEY = process.env.BACKBLAZE_APP_KEY;

/**
 * Warm up critical URLs by sending GET requests.
 * @param {Array<string>} urls - List of URLs to warm up.
 */
async function warmUpUrls(urls) {
  console.log(chalk.blue('🌐 Warming up URLs...'));

  const promises = urls.map((url) =>
    axios
      .get(url, {
        headers: {
          'User-Agent': 'Cache-Warmer/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      })
      .then(() => console.log(chalk.green(`✅ Warmed up: ${url}`)))
      .catch((error) => console.warn(chalk.yellow(`⚠️ Failed to warm ${url}: ${error.message}`)))
  );

  await Promise.all(promises);
}

/**
 * Purge Cloudflare cache (optional).
 */
async function purgeCloudflareCache() {
  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID) {
    console.log(chalk.yellow('⚠️ Cloudflare credentials not provided. Skipping cache purge.'));
    return;
  }

  try {
    await axios.post(
      `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache`,
      { purge_everything: true },
      {
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(chalk.green('♻️ Cloudflare cache purged successfully.'));
  } catch (error) {
    console.error(chalk.red('❌ Failed to purge Cloudflare cache:', error.response?.data?.errors || error.message));
  }
}

/**
 * Get a list of Backblaze B2 assets (optional).
 * @returns {Promise<Array<string>>} - List of asset URLs.
 */
async function getB2AssetList() {
  if (!B2_ACCOUNT_ID || !B2_APPLICATION_KEY) {
    console.log(chalk.yellow('⚠️ Backblaze B2 credentials not provided. Skipping asset warmup.'));
    return [];
  }

  try {
    // Implement Backblaze B2 API call to get a list of recent/changed assets
    // For now, return a mock list of assets
    return [
      'https://f003.backblazeb2.com/file/seriesImages/image-removebg-preview(1).png'    ];
  } catch (error) {
    console.error(chalk.red('❌ Failed to fetch Backblaze B2 assets:', error.message));
    return [];
  }
}

/**
 * Main function to warm up cache for critical resources.
 */
async function warmUpCache() {
  console.log(chalk.blue('🚀 Starting cache warmup...'));

  try {
    // Warm up Backblaze B2 assets
    const b2Assets = await getB2AssetList();
    if (b2Assets.length > 0) {
      await warmUpUrls(b2Assets);
    }

    // Warm up critical URLs
    const localBaseUrl = process.env.LOCAL_BASE_URL || 'http://localhost:8888'; // Use your actual domain in production
    await warmUpUrls(URLS_TO_WARM.map((path) => `${localBaseUrl}${path}`));

    // Optional: Purge and warm Cloudflare cache
    // await purgeCloudflareCache();
    // const productionBaseUrl = process.env.PRODUCTION_URL || 'https://your-production-url.com';
    // await warmUpUrls(URLS_TO_WARM.map((path) => `${productionBaseUrl}${path}`));

    console.log(chalk.green('✅ Cache warming completed successfully.'));
  } catch (error) {
    console.error(chalk.red('❌ Cache warming failed:', error.message));
  }
}

module.exports = {
  warmUpCache,
};
