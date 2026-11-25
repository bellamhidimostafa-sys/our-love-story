# A Little World for You

A static, responsive romantic story built with React, Vite, React Three Fiber, Drei, and Framer Motion. All 3D rooms and decorations are generated from lightweight geometry in the project; there are no paid services or third-party model assets.

The three rooms and rose passages share one continuous 3D floor plan. Tapping a room door swings it open and walks the camera to the threshold; the next button appears when it arrives. Choosing to continue then carries the view through the connecting hallway and to the next door.

## Run locally

```sh
npm install
npm run dev
```

## Personalize

Edit [`src/config/story.js`](src/config/story.js) to change the names, room letters, proposal and ending messages, theme colors, and wall photos. The three current photos are imported from `images/`; replace those files or update the imports there. Put an optional music file in `public/` and set `backgroundMusic` to its path, such as `/music/our-song.mp3`. If no music file is set, the welcome interaction starts a quiet synthesized ambient chord. Sound and motion respect the visitor's controls and reduced-motion preference.

## Deploy to Cloudflare Pages

The project is a static Vite build. To deploy from Git, create a Cloudflare Pages project connected to this repository and set:

- Build command: `npm run build`
- Build output directory: `dist`
- Node version: `22` (pinned in `.nvmrc`)

Use the repository root as the project root. The site needs no server-side functions, secrets, or environment variables. To check the production output locally, run `npm ci`, `npm run build`, then `npm run preview`.
