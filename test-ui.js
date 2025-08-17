const { chromium } = require('@playwright/test');

(async () => {
  console.log('Starting UI test...');
  
  // Launch browser
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Console error:', msg.text());
    }
  });
  
  page.on('pageerror', error => {
    console.log('Page error:', error.message);
  });
  
  try {
    console.log('Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    console.log('Page loaded, waiting for content...');
    
    // Wait a bit for any dynamic content
    await page.waitForTimeout(2000);
    
    // Take full page screenshot
    await page.screenshot({ 
      path: '/workspace/screenshot-full.png', 
      fullPage: true 
    });
    console.log('Full page screenshot saved as screenshot-full.png');
    
    // Check if the root element exists
    const rootElement = await page.$('#root');
    if (rootElement) {
      console.log('Root element found');
      
      // Get the inner HTML to see what's being rendered
      const innerHTML = await page.evaluate(() => {
        const root = document.getElementById('root');
        return root ? root.innerHTML : 'Root element has no content';
      });
      console.log('Root element content length:', innerHTML.length);
      
      // Check for specific elements
      const h1 = await page.$('h1');
      if (h1) {
        const h1Text = await h1.textContent();
        console.log('H1 text found:', h1Text);
      } else {
        console.log('No H1 element found');
      }
      
      // Check for the upload area
      const uploadArea = await page.$('[role="button"], button');
      if (uploadArea) {
        console.log('Button/upload area found');
      } else {
        console.log('No button/upload area found');
      }
      
      // Get computed styles of body
      const bodyStyles = await page.evaluate(() => {
        const body = document.body;
        const styles = window.getComputedStyle(body);
        return {
          backgroundColor: styles.backgroundColor,
          color: styles.color,
          fontFamily: styles.fontFamily
        };
      });
      console.log('Body styles:', bodyStyles);
      
      // Check if dark mode is applied
      const isDarkMode = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark');
      });
      console.log('Dark mode enabled:', isDarkMode);
      
      // Get all CSS rules to check if styles are loaded
      const cssLoaded = await page.evaluate(() => {
        return document.styleSheets.length;
      });
      console.log('Number of stylesheets loaded:', cssLoaded);
      
    } else {
      console.log('Root element not found!');
    }
    
    // Take a screenshot with device emulation
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.screenshot({ 
      path: '/workspace/screenshot-desktop.png'
    });
    console.log('Desktop screenshot saved as screenshot-desktop.png');
    
    // Mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.screenshot({ 
      path: '/workspace/screenshot-mobile.png'
    });
    console.log('Mobile screenshot saved as screenshot-mobile.png');
    
    // Get page title
    const title = await page.title();
    console.log('Page title:', title);
    
    // Get all text content
    const textContent = await page.evaluate(() => {
      return document.body.innerText || document.body.textContent;
    });
    console.log('Page text content:', textContent ? textContent.substring(0, 200) : 'No text content');
    
  } catch (error) {
    console.error('Error during test:', error);
    
    // Take error screenshot
    await page.screenshot({ 
      path: '/workspace/screenshot-error.png',
      fullPage: true 
    });
    console.log('Error screenshot saved as screenshot-error.png');
  }
  
  await browser.close();
  console.log('Test completed');
})();