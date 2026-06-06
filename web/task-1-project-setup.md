# Task 1: Next.js Project Initialization & Configuration

## Objective
Initialize a modern Next.js project inside the [web/](file:///Users/chathura/code/EchoDhamma/web) folder. This project will serve as the frontend for the EchoDhamma platform.

## Scope & Requirements
- **Framework**: Next.js (latest version) with App Router.
- **Language**: TypeScript for type safety and robust developer experience.
- **Styling**: Vanilla CSS (using CSS Modules and global CSS variables) to satisfy premium design guidelines without Tailwind unless requested.
- **Code Quality**: ESLint and Prettier for formatting consistency.
- **SEO & Base HTML**: Set up root layout, metadata, viewport parameters, and robots.txt.

## Proposed Steps

### 1. Initialize Next.js App
Run the Vite/Next.js initializer in the `web` folder.
*Note: Since the `web/` folder already exists and is empty, we initialize the project inside it.*
```bash
npx -y create-next-app@latest ./ --typescript --eslint --src-dir --app --import-alias "@/*" --use-npm
```
*When prompted, choose "No" for Tailwind CSS (per guidelines), and "Yes" for App Router.*

### 2. Configure Directory Structure
Create the following directory structure inside the `src/` folder:
- `src/components/`: Reusable UI components (e.g., Player, TheroCard, EbookCard).
- `src/hooks/`: Custom React hooks (e.g., useAudioPlayer).
- `src/styles/`: Global stylesheet and style helpers.
- `src/types/`: TypeScript interface definitions for theros, podcasts, chapters, and ebooks.
- `src/utils/`: Utility functions (e.g., RSS parsing, time formatting).

### 3. Establish Base Layout & SEO
Modify the root layout [layout.tsx](file:///Users/chathura/code/EchoDhamma/web/src/app/layout.tsx):
- Set up a clean HTML structure with correct lang attribute (`si` for Sinhala, `en` for English).
- Define default SEO metadata (Title, Description, OpenGraph tags).
- Include Google Fonts link for modern typography (e.g., `Inter` and `Outfit` or `Noto Sans Sinhala`).
- Define unique IDs on high-level layout elements.

### 4. Create Configuration Parser
Implement a helper to load Thero configurations from the python backend files located at [theros/](file:///Users/chathura/code/EchoDhamma/src/echodhamma/theros) directory. Since we need to know the S3 buckets, RSS feed filenames, and Umami IDs, the Next.js app needs to read these configurations.

## Files to Create / Modify
- [NEW] [task-1-project-setup.md](file:///Users/chathura/code/EchoDhamma/web/task-1-project-setup.md) (This file)
- [NEW] [src/app/layout.tsx](file:///Users/chathura/code/EchoDhamma/web/src/app/layout.tsx) - Root layout template.
- [NEW] [src/app/page.tsx](file:///Users/chathura/code/EchoDhamma/web/src/app/page.tsx) - Landing/Thero selection page.
- [NEW] [src/styles/globals.css](file:///Users/chathura/code/EchoDhamma/web/src/styles/globals.css) - Global baseline styles.
- [NEW] [src/types/index.ts](file:///Users/chathura/code/EchoDhamma/web/src/types/index.ts) - Global types.

## Verification Plan
1. **Development Server**: Run `npm run dev` inside [web/](file:///Users/chathura/code/EchoDhamma/web) to check if the server starts without errors.
2. **Browsing**: Navigate to `http://localhost:3000` to verify the page loads and matches standard Next.js initial templates.
3. **TypeScript & Linting**: Run `npm run build` to verify there are no TypeScript compiler or ESLint errors.
