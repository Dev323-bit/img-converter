A premium, high-performance, and entirely client-side image format converter. AURA Convert operates 100% in the browser — no servers, no API keys, and no data uploads, ensuring maximum privacy and instant conversion speeds.

🔮 Project 5/30 | 30-day utility project challenge

## 🚀 Key Features

- **Drag-and-Drop Interface**: Smooth dashboard layout to drag & drop multiple files or browse locally.
- **Dynamic Format Support**: Convert to/from JPEG, PNG, WebP, BMP, and AVIF (AVIF automatically enabled if native browser support is detected).
- **HEIC Input Decoder**: Drag Apple HEIC/HEIF photos directly. Decodes them on-demand client-side using `heic2any` asynchronously.
- **Transparency Loss Shield**: Alerts you when converting a transparent image (PNG/WebP) to an opaque format (JPEG/BMP), and lets you customize the background fill color.
- **Granular Controls**: Modify conversion format and quality (for lossy formats) globally or override per image.
- **Side-by-Side Live Preview**: Preview original vs. converted files side-by-side with format, file size, and percentage savings calculated dynamically.
- **Batch Processing & ZIP Download**: Run conversions in parallel and pack the results into a single `.zip` file using `JSZip`.
- **Premium Glassmorphic UI**: High-end cinematic dark mode theme with glowing active states, floating animations, and responsive layouts.

## 🛠️ Architecture & Technologies

1. **HTML5 Canvas API**: Performs pixel-level drawing and output encoding (`toBlob`) natively.
2. **JSZip**: Dynamically compiles all converted binary blobs into a structured ZIP file on the client.
3. **heic2any**: Polyfills browser support for Apple's HEIC container format using WASM and JS decoders. Loaded dynamically only when HEIC files are imported to optimize the initial page weight.
4. **Vanilla CSS Grid/Flexbox**: Glassmorphism (`backdrop-filter: blur()`), glowing accents, custom styled range sliders, responsive grids, and CSS transition/animation loops.

## 💻 How to Run Locally

Since the application consists entirely of static assets, you can run it in multiple ways:

### Option 1: Direct File Launch (No Server Needed)

Simply double-click the `index.html` file or drag it into any modern web browser.

### Option 2: Simple Local Dev Server

For a production-like experience, you can serve the directory using a one-liner:

- **Node.js**:
```bash
npx serve .
```

- **Python**:
```bash
python -m http.server 8080
```

## 🛡️ Privacy

All processing happens entirely within your browser's sandboxed memory via the Canvas API and WASM-based decoders. No image is ever uploaded to a server, and everything is cleared the moment you close the tab.

## 🌐 Deployment to Vercel

AURA Convert is fully compatible with Vercel's zero-config static deployments.

### Via Vercel CLI:

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in this directory.
3. Complete the prompt answers (defaults work perfectly).

### Via Vercel Dashboard (GitHub):

1. Push this workspace to a GitHub repository.
2. Link the repository to your Vercel account.
3. Set the **Framework Preset** to `Other` or `None`.
4. Click **Deploy**. Vercel will serve the static `index.html`, `styles.css`, and `app.js` immediately.

