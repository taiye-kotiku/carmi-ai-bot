/**
 * Simple script to download carousel background images
 * Uses direct Unsplash image URLs (no API key required)
 * Usage: node scripts/download-backgrounds-simple.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUTPUT_DIR = path.join(__dirname, '../public/carousel-templates');

// Curated Unsplash image URLs (1080x1350 portrait orientation)
// These are direct links to high-quality images suitable for carousel backgrounds
// Categories: abstract, gradient, tech, dark, office, colorful
const BACKGROUND_URLS = [
    // Abstract/Gradient backgrounds
    'https://images.unsplash.com/photo-1557683316-973673baf926?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1557683311-eac922347aa1?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=1080&h=1350&fit=crop&q=80',
    
    // Tech/Modern backgrounds  
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1557683316-973673baf926?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1080&h=1350&fit=crop&q=80',
    
    // Dark backgrounds
    'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1557683311-eac922347aa1?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=1080&h=1350&fit=crop&q=80',
    
    // Office/Business backgrounds
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1080&h=1350&fit=crop&q=80',
    
    // Colorful/Gradient backgrounds
    'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1557683311-eac922347aa1?w=1080&h=1350&fit=crop&q=80',
    'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=1080&h=1350&fit=crop&q=80',
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
    console.log('🚀 Starting carousel background download...\n');
    
    // Find next available template number
    const existingFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.startsWith('T_') && f.endsWith('.jpg'));
    const existingNumbers = existingFiles.map(f => parseInt(f.match(/T_(\d+)\.jpg/)?.[1] || '0')).filter(n => !isNaN(n));
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 100;
    let startNumber = maxNumber + 1;
    
    let successCount = 0;
    for (let i = 0; i < BACKGROUND_URLS.length; i++) {
        const filename = `T_${String(startNumber + i).padStart(3, '0')}.jpg`;
        const filepath = path.join(OUTPUT_DIR, filename);
        
        // Skip if file already exists
        if (fs.existsSync(filepath)) {
            console.log(`⏭️  Skipping ${filename} (already exists)`);
            continue;
        }
        
        try {
            console.log(`📥 Downloading ${i + 1}/${BACKGROUND_URLS.length}: ${filename}`);
            await downloadImage(BACKGROUND_URLS[i], filepath);
            console.log(`✅ Saved: ${filename}`);
            successCount++;
            // Small delay to be respectful
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
            console.error(`❌ Error downloading ${filename}:`, err.message);
        }
    }
    
    console.log(`\n✨ Complete! Downloaded ${successCount} new images`);
    console.log(`📁 Location: ${OUTPUT_DIR}`);
    console.log('\n📝 Next steps:');
    console.log('   1. Review the downloaded images');
    console.log('   2. Add them to src/lib/carousel/templates.ts with appropriate categories');
    console.log('   3. Test them in the carousel generator');
}

main().catch(console.error);
