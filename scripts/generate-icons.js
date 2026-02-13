const fs = require('fs');
const path = require('path');

// Simple PNG generator using raw bytes
// Creates a gradient purple icon with "R" letter

function createPNG(size) {
  const width = size;
  const height = size;
  
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdr = createIHDR(width, height);
  
  // IDAT chunk (image data)
  const idat = createIDAT(width, height);
  
  // IEND chunk
  const iend = createIEND();
  
  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createIHDR(width, height) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data.writeUInt8(8, 8);  // bit depth
  data.writeUInt8(2, 9);  // color type (RGB)
  data.writeUInt8(0, 10); // compression
  data.writeUInt8(0, 11); // filter
  data.writeUInt8(0, 12); // interlace
  
  return createChunk('IHDR', data);
}

function createIDAT(width, height) {
  const zlib = require('zlib');
  
  // Create raw image data
  const rawData = Buffer.alloc((width * 3 + 1) * height);
  
  const cornerRadius = Math.floor(width * 0.19); // ~19% corner radius
  
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 3 + 1);
    rawData[rowStart] = 0; // filter byte
    
    for (let x = 0; x < width; x++) {
      const pixelStart = rowStart + 1 + x * 3;
      
      // Check if pixel is in rounded corner
      const inCorner = isInRoundedCorner(x, y, width, height, cornerRadius);
      
      if (inCorner) {
        // Transparent (use background color - dark slate)
        rawData[pixelStart] = 15;     // R
        rawData[pixelStart + 1] = 23; // G
        rawData[pixelStart + 2] = 42; // B
      } else {
        // Gradient from indigo to purple
        const gradientPos = (x + y) / (width + height);
        const r = Math.floor(99 + (139 - 99) * gradientPos);
        const g = Math.floor(102 + (92 - 102) * gradientPos);
        const b = Math.floor(241 + (246 - 241) * gradientPos);
        
        // Check if we should draw the "R" letter
        const letterColor = isInLetter(x, y, width, height);
        
        if (letterColor) {
          rawData[pixelStart] = 255;     // R (white)
          rawData[pixelStart + 1] = 255; // G
          rawData[pixelStart + 2] = 255; // B
        } else {
          rawData[pixelStart] = r;
          rawData[pixelStart + 1] = g;
          rawData[pixelStart + 2] = b;
        }
      }
    }
  }
  
  const compressed = zlib.deflateSync(rawData);
  return createChunk('IDAT', compressed);
}

function isInRoundedCorner(x, y, width, height, radius) {
  // Top-left
  if (x < radius && y < radius) {
    const dx = radius - x;
    const dy = radius - y;
    return dx * dx + dy * dy > radius * radius;
  }
  // Top-right
  if (x >= width - radius && y < radius) {
    const dx = x - (width - radius);
    const dy = radius - y;
    return dx * dx + dy * dy > radius * radius;
  }
  // Bottom-left
  if (x < radius && y >= height - radius) {
    const dx = radius - x;
    const dy = y - (height - radius);
    return dx * dx + dy * dy > radius * radius;
  }
  // Bottom-right
  if (x >= width - radius && y >= height - radius) {
    const dx = x - (width - radius);
    const dy = y - (height - radius);
    return dx * dx + dy * dy > radius * radius;
  }
  return false;
}

function isInLetter(x, y, width, height) {
  // Scale coordinates to 0-100 range for easier calculation
  const sx = (x / width) * 100;
  const sy = (y / height) * 100;
  
  // "R" letter bounds (roughly centered)
  const letterLeft = 28;
  const letterRight = 72;
  const letterTop = 25;
  const letterBottom = 75;
  const stemWidth = 12;
  const arcRight = 62;
  const arcMid = 48;
  
  // Vertical stem of R
  if (sx >= letterLeft && sx <= letterLeft + stemWidth && sy >= letterTop && sy <= letterBottom) {
    return true;
  }
  
  // Top horizontal of R
  if (sx >= letterLeft && sx <= arcRight && sy >= letterTop && sy <= letterTop + 8) {
    return true;
  }
  
  // Middle horizontal of R
  if (sx >= letterLeft && sx <= arcRight - 5 && sy >= arcMid - 4 && sy <= arcMid + 4) {
    return true;
  }
  
  // Right arc of R (top half) - simplified as vertical line with curve
  if (sx >= arcRight - 10 && sx <= arcRight && sy >= letterTop && sy <= arcMid) {
    const centerY = (letterTop + arcMid) / 2;
    const radius = (arcMid - letterTop) / 2;
    const dy = Math.abs(sy - centerY);
    const expectedX = arcRight - 5 + Math.sqrt(Math.max(0, radius * radius - dy * dy)) * 0.5;
    if (sx <= expectedX + 5 && sx >= expectedX - 5) {
      return true;
    }
  }
  
  // Diagonal leg of R
  const legStartX = letterLeft + stemWidth;
  const legStartY = arcMid;
  const legEndX = letterRight;
  const legEndY = letterBottom;
  
  const legSlope = (legEndY - legStartY) / (legEndX - legStartX);
  const expectedY = legStartY + (sx - legStartX) * legSlope;
  
  if (sx >= legStartX && sx <= legEndX && Math.abs(sy - expectedY) < 6) {
    return true;
  }
  
  return false;
}

function createIEND() {
  return createChunk('IEND', Buffer.alloc(0));
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  
  const typeBuffer = Buffer.from(type);
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);
  
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);
  
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(data) {
  let crc = 0xffffffff;
  const table = getCRC32Table();
  
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  
  return (crc ^ 0xffffffff) >>> 0;
}

let crcTable = null;
function getCRC32Table() {
  if (crcTable) return crcTable;
  
  crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
  }
  return crcTable;
}

// Generate icons
const publicDir = path.join(__dirname, '..', 'public');

console.log('Generating icon-192.png...');
const icon192 = createPNG(192);
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), icon192);

console.log('Generating icon-512.png...');
const icon512 = createPNG(512);
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), icon512);

console.log('Generating favicon.ico (as PNG)...');
const favicon = createPNG(32);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), favicon);

console.log('Icons generated successfully!');
