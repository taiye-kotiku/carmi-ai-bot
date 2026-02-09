/**
 * Script to download carousel background images from Unsplash
 * Usage: node scripts/download-carousel-backgrounds.js
 * 
 * Requires: UNSPLASH_ACCESS_KEY environment variable (get free key from https://unsplash.com/developers)
 * 
 * Downloads high-quality images suitable for Instagram carousel posts (1080x1350px)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const OUTPUT_DIR = path.join(__dirname, '../public/carousel-templates');

// Search queries for carousel backgrounds
const SEARCH_QUERIES = [
    'abstract gradient',
    'modern office',
    'tech background',
    'dark background',
    'colorful gradient',
    'minimalist background',
    'geometric pattern',
    'business background',
    'professional background',
    'instagram carousel',
    'social media background',
    'marketing background',
    'creative background',
    'urban landscape',
    'nature abstract',
];

if (!UNSPLASH_ACCESS_KEY) {
    console.error('❌ Error: UNSPLASH_ACCESS_KEY environment variable not set');
    console.log('📝 Get a free API key from: https://unsplash.com/developers');
    console.log('💡 Then run: $env:UNSPLASH_ACCESS_KEY="your-key"; node scripts/download-carousel-backgrounds.js');
    process.exit(1);
}

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => {});
            reject(err);
        });
    });
}

async function searchAndDownload(query, index) {
    return new Promise((resolve, reject) => {
        const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=portrait&per_page=1&client_id=${UNSPLASH_ACCESS_KEY}`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', async () => {
                try {
                    const json = JSON.parse(data);
                    if (json.results && json.results.length > 0) {
                        const photo = json.results[0];
                        // Get regular size (1080px width) - good for carousel
                        const imageUrl = photo.urls.regular || photo.urls.small;
                        const filename = `T_${String(100 + index).padStart(3, '0')}.jpg`;
                        const filepath = path.join(OUTPUT_DIR, filename);
                        
                        console.log(`📥 Downloading: ${photo.description || query} -> ${filename}`);
                        await downloadImage(imageUrl, filepath);
                        console.log(`✅ Saved: ${filename}`);
                        resolve({ filename, photo });
                    } else {
                        console.log(`⚠️  No results for: ${query}`);
                        resolve(null);
                    }
                } catch (err) {
                    reject(err);
                }
            });
        }).on('error', reject);
    });
}

async function main() {
    console.log('🚀 Starting carousel background download...\n');
    
    const results = [];
    for (let i = 0; i < SEARCH_QUERIES.length; i++) {
        try {
            const result = await searchAndDownload(SEARCH_QUERIES[i], i);
            if (result) {
                results.push(result);
            }
            // Rate limit: wait 1 second between requests (Unsplash allows 50/hour)
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
            console.error(`❌ Error downloading ${SEARCH_QUERIES[i]}:`, err.message);
        }
    }
    
    console.log(`\n✨ Complete! Downloaded ${results.length} images`);
    console.log(`📁 Location: ${OUTPUT_DIR}`);
    console.log('\n📝 Next steps:');
    console.log('   1. Review the downloaded images');
    console.log('   2. Add them to src/lib/carousel/templates.ts');
    console.log('   3. Categorize them appropriately');
}

main().catch(console.error);
