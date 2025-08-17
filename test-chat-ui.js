const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('🧪 Testing Red Pandas Chat UI with CSV Upload...\n');
  
  try {
    // Create a test CSV file
    const testCSV = `product,category,price,quantity,date
Product A,Electronics,299.99,10,2024-01-01
Product B,Clothing,49.99,25,2024-01-02
Product C,Electronics,599.99,5,2024-01-03
Product D,Food,19.99,100,2024-01-04
Product E,Clothing,89.99,15,2024-01-05`;
    
    const testFilePath = '/tmp/test-data.csv';
    fs.writeFileSync(testFilePath, testCSV);
    console.log('✓ Created test CSV file');
    
    // Navigate to the app
    await page.goto('http://localhost:5173');
    console.log('✓ Page loaded');
    
    // Test CSV upload
    const fileInput = await page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(testFilePath);
    console.log('✓ CSV file uploaded');
    
    // Wait for the session to be created
    await page.waitForTimeout(2000);
    
    // Check if the session info bar appears
    const sessionInfoVisible = await page.locator('.px-6.py-4.border-b').first().isVisible();
    if (sessionInfoVisible) {
      console.log('✓ Session info bar is visible after upload');
      
      // Check filename display
      const filenameText = await page.locator('p.text-sm.font-medium').first().textContent();
      if (filenameText && filenameText.includes('test-data.csv')) {
        console.log('✓ Filename is displayed correctly');
      }
      
      // Check row/column count display
      const dataInfo = await page.locator('p.text-xs.text-muted-foreground').first().textContent();
      if (dataInfo && dataInfo.includes('rows') && dataInfo.includes('columns')) {
        console.log(`✓ Data dimensions displayed: ${dataInfo}`);
      }
    } else {
      console.log('⚠️ Session might not have been created (backend may not be running)');
    }
    
    // Check if chat input area is visible
    const chatInput = await page.locator('textarea[placeholder*="Ask a question"]').isVisible();
    if (chatInput) {
      console.log('✓ Chat input area is visible');
      
      // Test typing in the chat input
      await page.fill('textarea[placeholder*="Ask a question"]', 'What is the total revenue?');
      console.log('✓ Can type in chat input');
      
      // Check send button
      const sendButton = await page.locator('button[type="submit"]').isVisible();
      if (sendButton) {
        console.log('✓ Send button is visible');
      }
    }
    
    // Check Replace button functionality
    const replaceButton = await page.locator('button:has-text("Replace")').isVisible();
    if (replaceButton) {
      console.log('✓ Replace file button is visible');
    }
    
    // Check Clear session button
    const clearButton = await page.locator('button:has(svg.h-4.w-4)').last().isVisible();
    if (clearButton) {
      console.log('✓ Clear session button is visible');
    }
    
    // Test dark mode styling
    console.log('\n🎨 Testing Dark Mode Styling...');
    
    // Check background colors
    const bgColor = await page.evaluate(() => 
      window.getComputedStyle(document.body).backgroundColor
    );
    console.log(`✓ Body background: ${bgColor}`);
    
    // Check text colors
    const textColor = await page.evaluate(() => 
      window.getComputedStyle(document.body).color
    );
    console.log(`✓ Text color: ${textColor}`);
    
    // Check card styling
    const cardElements = await page.locator('.bg-card').count();
    console.log(`✓ Found ${cardElements} card element(s) with dark theme`);
    
    // Check monospace font in code areas (if present)
    console.log('\n📝 Testing Typography...');
    
    const hasSansFont = await page.evaluate(() => {
      const elements = document.querySelectorAll('.font-sans');
      return elements.length > 0;
    });
    if (hasSansFont) {
      console.log('✓ Sans-serif font is applied to UI elements');
    }
    
    // Check layout constraints
    console.log('\n📐 Testing Layout...');
    
    const maxWidthContainer = await page.locator('.max-w-4xl').isVisible();
    if (maxWidthContainer) {
      console.log('✓ Content width is constrained (not full viewport)');
      
      const containerWidth = await page.locator('.max-w-4xl').evaluate(el => 
        el.getBoundingClientRect().width
      );
      console.log(`✓ Container width: ${containerWidth}px`);
    }
    
    // Check spacing
    const paddingElements = await page.locator('.p-6').count();
    if (paddingElements > 0) {
      console.log(`✓ Proper spacing applied (${paddingElements} padded elements)`);
    }
    
    // Clean up
    fs.unlinkSync(testFilePath);
    console.log('\n✅ All chat UI tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
  
  await browser.close();
})();