# Task 6: Ebook Library (PDF & EPUB Viewer)

## Objective
Implement an Ebook section to catalog, download, and read PDFs and EPUB files of Dhamma books (primarily written by Ven. Rerukane Chandawimala Thero).

## Scope & Requirements
- **Book Catalog**: A visual grid displaying book covers, titles, descriptions, and categories.
- **Formats Supported**: EPUB and PDF files hosted either locally in `/public/ebooks/` or dynamically via S3.
- **Reading Options**:
  - Direct download links for PDF/EPUB.
  - Inline PDF viewer using Next.js iframe rendering or PDF.js wrapper.
  - EPUB online reader integration (using a lightweight package like `epubjs` or `react-reader`) or clear reader redirection options.
- **Search & Filtering**: Search books by title, content keywords, or topics.

## Proposed Steps

### 1. Catalog Metadata Definition
Create a JSON metadata catalog for the ebooks (e.g., [src/data/ebooks.json](file:///Users/chathura/code/EchoDhamma/web/src/data/ebooks.json)):
```json
[
  {
    "id": "abhidharma-margaya",
    "title": "අභිධර්මයේ මූලික කරුණු (Abhidharma Margaya)",
    "author": "Ven. Rerukane Chandawimala Thero",
    "description": "අභිධර්ම පිටකය හැදෑරීමට කැමති පින්වතුන් සඳහා සකස් කරන ලද දහම් පොතකි.",
    "cover_url": "/covers/abhidharma-margaya.jpg",
    "pdf_url": "/ebooks/abhidharma-margaya.pdf",
    "epub_url": "/ebooks/abhidharma-margaya.epub"
  }
]
```

### 2. Implement Ebook Catalog Page
Create route `/ebooks`:
- Display a clean, filterable shelf of ebooks with visual cover cards.
- Add search controls.
- Clicking on a book card opens a details modal with options: "Read Online (PDF)", "Download PDF", and "Download EPUB".

### 3. Integrated PDF/EPUB Viewer Page
Create route `/ebooks/[book_id]/read`:
- Provide a full-screen, distraction-free reading mode.
- Render PDFs inside a responsive canvas or optimized browser view.
- Render EPUB files with page-turning, font size customization, and chapter index sidebar.

## Files to Create / Modify
- [NEW] [task-6-ebook-library.md](file:///Users/chathura/code/EchoDhamma/web/task-6-ebook-library.md) (This file)
- [NEW] [src/data/ebooks.json](file:///Users/chathura/code/EchoDhamma/web/src/data/ebooks.json) - Metadata schema catalog for ebooks.
- [NEW] [src/app/ebooks/page.tsx](file:///Users/chathura/code/EchoDhamma/web/src/app/ebooks/page.tsx) - Ebooks collection gallery view.
- [NEW] [src/app/ebooks/[book_id]/read/page.tsx](file:///Users/chathura/code/EchoDhamma/web/src/app/ebooks/%5Bbook_id%5D/read/page.tsx) - Reader layout interface.
- [NEW] [src/components/EbookCard.tsx](file:///Users/chathura/code/EchoDhamma/web/src/components/EbookCard.tsx) - Card showing cover and options.
- [NEW] [src/components/EbookCard.module.css](file:///Users/chathura/code/EchoDhamma/web/src/components/EbookCard.module.css) - Ebook cards layout styles.

## Verification Plan
1. **Catalog Browsing**: Verify that the catalog page correctly lists all books defined in the JSON file.
2. **File Downloads**: Click download links for PDF and EPUB to verify file resolution.
3. **Reader Layout**: Test PDF zoom, next page/previous page actions, and responsive layout on mobile views.
