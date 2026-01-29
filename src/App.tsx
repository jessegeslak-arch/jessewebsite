import { useCallback, useEffect, useRef, useState, forwardRef } from 'react';
import HTMLFlipBook from 'react-pageflip';
import './App.css';

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
  const [numPages] = useState<number>(24); // Based on the number of files in public/portfolio
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const bookRef = useRef<any>(null);

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

      // 5500x3300 aspect ratio (landscape) = 5:3 = 1.666
      const aspectRatio = 5500 / 3300;

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

  // Load image paths
  useEffect(() => {
    const images = Array.from({ length: numPages }, (_, i) => `/portfolio/portfolio v3 for web_${i + 1}.webp`);
    setPageImages(images);
  }, [numPages]);


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

  if (dimensions.width === 0 || pageImages.length === 0) {
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
            {pageImages.map((image: string, index: number) => (
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
