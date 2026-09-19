import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const inputJpg = 'C:/Users/familia/.gemini/antigravity/brain/f2db86d5-f7bf-47b4-9440-c9bad6f6f83c/mothertree_sentinel_1789832041084.jpg';
const outputWebp = path.resolve('public/game-assets/greenfoot/mothertree_sentinel.webp');
const outputIcon = path.resolve('public/game-assets/farming/mother_tree_skin.png');

async function processImage() {
  console.log('Reading input image...');
  const { data, info } = await sharp(inputJpg)
    .resize(672, 900, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const channels = info.channels; // 4

  // Alpha thresholding for white background
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Check if pixel is pure white / near white
    if (r > 248 && g > 248 && b > 248) {
      data[i + 3] = 0; // completely transparent
    } else if (r > 235 && g > 235 && b > 235) {
      // Smooth feathering
      const brightness = (r + g + b) / 3;
      const alphaFactor = (248 - brightness) / (248 - 235);
      data[i + 3] = Math.round(alphaFactor * 255);
    }
  }

  // Save the transparent webp for the base tower
  await sharp(data, {
    raw: { width, height, channels: 4 }
  })
    .webp({ quality: 90 })
    .toFile(outputWebp);
  console.log(`Saved battlefield tree skin to: ${outputWebp}`);

  // Create 256x256 inventory farming icon
  await sharp(data, {
    raw: { width, height, channels: 4 }
  })
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outputIcon);
  console.log(`Saved inventory icon to: ${outputIcon}`);
}

processImage().catch(console.error);
