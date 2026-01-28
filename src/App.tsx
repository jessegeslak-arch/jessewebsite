import { useCallback, useEffect, useRef, useState, forwardRef } from 'react';
import HTMLFlipBook from 'react-pageflip';
import * as pdfjs from 'pdfjs-dist';
import './App.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Pre-rendered page component for the flipbook
interface PageProps {
  pageImage: string | null;
}

const FlipBookPage = forwardRef<HTMLDivElement, PageProps>(
  ({ pageImage }, ref) => {
    return (
      <div className="page" ref={ref}>
        {pageImage ? (
          <img src={pageImage} alt="Portfolio page" />
        ) : (
          <div className="page-loading">
            <div className="loading-spinner small"></div>
          </div>
        )}
      </div>
    );
  }
);

FlipBookPage.displayName = 'FlipBookPage';

// Mobile/portrait breakpoint - when viewport is narrow or in portrait orientation
const MOBILE_BREAKPOINT = 768;

function App() {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [pageImages, setPageImages] = useState<(string | null)[]>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const bookRef = useRef<any>(null);
  const pdfDocRef = useRef<pdfjs.PDFDocumentProxy | null>(null);

  // Calculate optimal page dimensions based on viewport with better screen utilization
  useEffect(() => {
    const calculateDimensions = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Detect mobile/portrait mode - either narrow screen or portrait orientation
      const isPortrait = viewportHeight > viewportWidth;
      const isNarrowScreen = viewportWidth < MOBILE_BREAKPOINT;
      const mobileMode = isNarrowScreen || isPortrait;
      setIsMobile(mobileMode);

      // Minimize reserved space to maximize flipbook size
      // Mobile: smaller margins, Desktop: slightly larger for controls
      const verticalPadding = mobileMode ? 80 : 100;
      const horizontalPadding = mobileMode ? 20 : 40;

      const availableHeight = viewportHeight - verticalPadding;
      const availableWidth = viewportWidth - horizontalPadding;

      // 11x17 aspect ratio (landscape) = 17:11 = 1.545
      const aspectRatio = 17 / 11;

      let pageWidth: number;
      let pageHeight: number;

      if (mobileMode) {
        // Single page mode for mobile/portrait - maximize the single page
        // Calculate the largest page that fits while maintaining aspect ratio
        const widthBasedHeight = availableWidth / aspectRatio;
        const heightBasedWidth = availableHeight * aspectRatio;

        if (widthBasedHeight <= availableHeight) {
          // Width is the constraint
          pageWidth = availableWidth;
          pageHeight = widthBasedHeight;
        } else {
          // Height is the constraint
          pageWidth = heightBasedWidth;
          pageHeight = availableHeight;
        }
      } else {
        // Two-page spread mode for desktop/landscape
        const spreadWidth = availableWidth;
        const singlePageWidth = spreadWidth / 2;

        // Calculate based on height constraint
        const heightBasedPageWidth = availableHeight * aspectRatio;

        // Use the smaller dimension to ensure it fits
        if (heightBasedPageWidth <= singlePageWidth) {
          pageWidth = heightBasedPageWidth;
          pageHeight = availableHeight;
        } else {
          pageWidth = singlePageWidth;
          pageHeight = singlePageWidth / aspectRatio;
        }
      }

      // Ensure minimum dimensions
      pageWidth = Math.max(Math.floor(pageWidth), 200);
      pageHeight = Math.max(Math.floor(pageHeight), 130);

      setDimensions({ width: pageWidth, height: pageHeight });
    };

    calculateDimensions();

    // Use ResizeObserver for better performance and accuracy
    const resizeObserver = new ResizeObserver(calculateDimensions);
    resizeObserver.observe(document.body);

    // Also listen to orientation changes
    window.addEventListener('orientationchange', calculateDimensions);
    window.addEventListener('resize', calculateDimensions);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('orientationchange', calculateDimensions);
      window.removeEventListener('resize', calculateDimensions);
    };
  }, []);

  // Load PDF document (only once)
  useEffect(() => {
    const loadPdfDoc = async () => {
      try {
        const loadingTask = pdfjs.getDocument('/portfolio.pdf');
        const pdf = await loadingTask.promise;
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setPageImages(new Array(pdf.numPages).fill(null));
      } catch (error) {
        console.error('Error loading PDF:', error);
      }
    };
    loadPdfDoc();
  }, []);

  // Helper to render a specific page
  const renderPage = useCallback(async (pageIndex: number, width: number, height: number) => {
    if (!pdfDocRef.current || pageIndex < 0 || pageIndex >= numPages) return;
    if (pageImages[pageIndex] && dimensions.width === width) return; // Already rendered for this size

    try {
      const page = await pdfDocRef.current.getPage(pageIndex + 1);
      const viewport = page.getViewport({ scale: 1 });

      // Calculate scale - 1.5x for a good balance of quality and speed
      const scale = Math.min(width / viewport.width, height / viewport.height) * 1.5;
      const scaledViewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;

      await page.render({
        canvasContext: context,
        viewport: scaledViewport,
      } as any).promise;

      const imageDataUrl = canvas.toDataURL('image/webp', 0.8); // Use WebP for better compression

      setPageImages(prev => {
        const newImages = [...prev];
        newImages[pageIndex] = imageDataUrl;
        return newImages;
      });

      // Clean up canvas
      canvas.width = 0;
      canvas.height = 0;
    } catch (error) {
      console.error(`Error rendering page ${pageIndex + 1}:`, error);
    }
  }, [numPages, dimensions.width]);

  // Render visible and nearby pages when current page changes or PDF loads
  useEffect(() => {
    if (!pdfDocRef.current || dimensions.width === 0 || numPages === 0) return;

    const pagesToRender = new Set<number>();

    // Always render current view
    pagesToRender.add(currentPage);
    if (!isMobile) {
      pagesToRender.add(currentPage + 1);
    }

    // Pre-render next and previous spreads for smoothness
    const buffer = isMobile ? 2 : 4;
    for (let i = 1; i <= buffer; i++) {
      if (currentPage + i < numPages) pagesToRender.add(currentPage + i);
      if (currentPage - i >= 0) pagesToRender.add(currentPage - i);
    }

    // Execute rendering
    const renderNeeded = Array.from(pagesToRender).filter(idx => !pageImages[idx]);

    // Render sequentially to not freeze the UI
    const renderSequential = async () => {
      for (const idx of renderNeeded) {
        await renderPage(idx, dimensions.width, dimensions.height);
      }
    };

    renderSequential();
  }, [currentPage, numPages, dimensions.width, dimensions.height, isMobile]);

  const onFlip = useCallback((e: any) => {
    setCurrentPage(e.data);
  }, []);

  const goToPrevPage = () => {
    bookRef.current?.pageFlip()?.flipPrev();
  };

  const goToNextPage = () => {
    bookRef.current?.pageFlip()?.flipNext();
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToPrevPage();
      } else if (e.key === 'ArrowRight') {
        goToNextPage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Calculate display page numbers for indicator
  const getDisplayPages = () => {
    if (isMobile) {
      // Single page mode - just show current page
      return `${currentPage + 1}`;
    }
    // Double page spread mode
    if (currentPage === 0) {
      return '1';
    }
    const leftPage = currentPage + 1;
    const rightPage = Math.min(currentPage + 2, numPages);
    if (leftPage === rightPage || rightPage > numPages) {
      return `${leftPage}`;
    }
    return `${leftPage} - ${rightPage}`;
  };

  if (dimensions.width === 0 || numPages === 0) {
    return (
      <div className="app">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <span className="loading-text">Loading portfolio...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="flipbook-wrapper">
        <div className="flipbook-container">
          {/* @ts-ignore */}
          <HTMLFlipBook
            ref={bookRef}
            width={dimensions.width}
            height={dimensions.height}
            size="fixed"
            minWidth={300}
            maxWidth={1000}
            minHeight={200}
            maxHeight={800}
            showCover={true}
            mobileScrollSupport={true}
            onFlip={onFlip}
            className="flipbook"
            style={{}}
            startPage={0}
            drawShadow={true}
            flippingTime={600}
            usePortrait={isMobile}
            startZIndex={0}
            autoSize={false}
            maxShadowOpacity={0.5}
            showPageCorners={true}
            disableFlipByClick={false}
            swipeDistance={30}
            clickEventForward={true}
            useMouseEvents={true}
          >
            {pageImages.map((image, index) => (
              <FlipBookPage key={index} pageImage={image} />
            ))}
          </HTMLFlipBook>
        </div>

        {!isMobile && (
          <span className="keyboard-hint">
            Click a page or use <kbd>←</kbd> <kbd>→</kbd> arrow keys to navigate
          </span>
        )}
      </div>

      <div className="nav-controls">
        <button
          className="nav-btn"
          onClick={goToPrevPage}
          disabled={currentPage === 0}
          aria-label="Previous page"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15,18 9,12 15,6" />
          </svg>
        </button>

        <span className="page-indicator">
          {getDisplayPages()} / {numPages}
        </span>

        <button
          className="nav-btn"
          onClick={goToNextPage}
          disabled={currentPage >= numPages - 1}
          aria-label="Next page"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9,6 15,12 9,18" />
          </svg>
        </button>
      </div>

      <div className="contact-info">
        <a href="mailto:jgeslak@uoregon.edu">jgeslak@uoregon.edu</a>
        <a href="tel:+13603485097">+1-360-348-5097</a>
      </div>
    </div>
  );
}

export default App;
