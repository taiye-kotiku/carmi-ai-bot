/**
 * Script to download nature-themed carousel background images
 * Usage: node scripts/download-nature-backgrounds.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUTPUT_DIR = path.join(__dirname, '../public/carousel-templates');

// Nature-themed Unsplash image URLs (1080x1350 portrait orientation)
const NATURE_BACKGROUND_URLS = [
    // Beach & Sea
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1080&h=1350&fit=crop&q=80',
    
    // Mountains
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080&h=1350&fit=crop&q=80',
    
    // Lakes & Ponds
    'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080&h=1350&fit=crop&q=80',
    
    // Forests & Nature
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1080&h=1350&fit=crop&q=80',
    
    // Ocean & Waves
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=1080&h=1350&fit=crop&q=80',
    
    // Sunset/Sunrise Nature
    'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080&h=1350&fit=crop&q=80',
    
    // Desert & Landscapes
    'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1080&h=1350&fit=crop&q=80',
];

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

async function main() {
    console.log('🚀 Starting nature background download...\n');
    
    // Find next available template number
    const existingFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.startsWith('T_') && f.endsWith('.jpg'));
    const existingNumbers = existingFiles.map(f => parseInt(f.match(/T_(\d+)\.jpg/)?.[1] || '0')).filter(n => !isNaN(n));
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 100;
    let startNumber = maxNumber + 1;
    
    let successCount = 0;
    for (let i = 0; i < NATURE_BACKGROUND_URLS.length; i++) {
        const filename = `T_${String(startNumber + i).padStart(3, '0')}.jpg`;
        const filepath = path.join(OUTPUT_DIR, filename);
        
        // Skip if file already exists
        if (fs.existsSync(filepath)) {
            console.log(`⏭️  Skipping ${filename} (already exists)`);
            continue;
        }
        
        try {
            console.log(`📥 Downloading ${i + 1}/${NATURE_BACKGROUND_URLS.length}: ${filename}`);
            await downloadImage(NATURE_BACKGROUND_URLS[i], filepath);
            console.log(`✅ Saved: ${filename}`);
            successCount++;
            // Small delay to be respectful
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
            console.error(`❌ Error downloading ${filename}:`, err.message);
        }
    }
    
    console.log(`\n✨ Complete! Downloaded ${successCount} new nature images`);
    console.log(`📁 Location: ${OUTPUT_DIR}`);
    console.log('\n📝 Next steps:');
    console.log('   1. Review the downloaded images');
    console.log('   2. Add them to src/lib/carousel/templates.ts with category "nature"');
    console.log('   3. Test them in the carousel generator');
}

main().catch(console.error);
