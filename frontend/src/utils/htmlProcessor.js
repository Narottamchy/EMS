import * as cheerio from 'cheerio';
import { convert } from 'html-to-text';

/**
 * Validate HTML content and return validation results
 * @param {string} htmlContent - HTML content to validate
 * @returns {Object} Validation results with isValid, errors, and warnings
 */
export function validateHTML(htmlContent) {
  try {
    const errors = [];
    const warnings = [];

    // Basic HTML structure validation
    if (!htmlContent.trim()) {
      errors.push('HTML content is empty');
      return { isValid: false, errors, warnings };
    }

    // Load HTML with cheerio for parsing
    const $ = cheerio.load(htmlContent);

    // Check for basic HTML structure
    if ($('html').length === 0) {
      warnings.push('No <html> tag found - consider wrapping content in proper HTML structure');
    }

    if ($('body').length === 0) {
      warnings.push('No <body> tag found - consider wrapping content in proper HTML structure');
    }

    // Check for common email template issues
    const images = $('img');
    images.each((i, img) => {
      const src = $(img).attr('src');
      if (!src) {
        errors.push(`Image at position ${i + 1} has no src attribute`);
      } else if (src.startsWith('http://')) {
        warnings.push(`Image at position ${i + 1} uses HTTP instead of HTTPS`);
      }
    });

    // Check for unclosed tags
    const openTags = [];
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^<>]*>/g;
    let match;
    const tagStack = [];

    while ((match = tagRegex.exec(htmlContent)) !== null) {
      const fullTag = match[0];
      const tagName = match[1].toLowerCase();
      
      if (fullTag.startsWith('</')) {
        // Closing tag
        if (tagStack.length === 0) {
          errors.push(`Closing tag </${tagName}> found without matching opening tag`);
        } else {
          const lastOpenTag = tagStack.pop();
          if (lastOpenTag !== tagName) {
            errors.push(`Mismatched tags: expected </${lastOpenTag}> but found </${tagName}>`);
          }
        }
      } else if (!fullTag.endsWith('/>')) {
        // Opening tag (not self-closing)
        if (['img', 'br', 'hr', 'input', 'meta', 'link'].includes(tagName)) {
          warnings.push(`Tag <${tagName}> should be self-closing`);
        } else {
          tagStack.push(tagName);
        }
      }
    }

    // Check for unclosed tags
    if (tagStack.length > 0) {
      tagStack.forEach(tag => {
        errors.push(`Unclosed tag: <${tag}>`);
      });
    }

    // Check for email-specific best practices
    const links = $('a');
    links.each((i, link) => {
      const href = $(link).attr('href');
      if (!href) {
        warnings.push(`Link at position ${i + 1} has no href attribute`);
      } else if (href.startsWith('http://')) {
        warnings.push(`Link at position ${i + 1} uses HTTP instead of HTTPS`);
      }
    });

    // Check for inline styles (good for email)
    const elementsWithStyle = $('[style]');
    if (elementsWithStyle.length === 0) {
      warnings.push('No inline styles found - consider adding inline CSS for better email client compatibility');
    }

    // Check for CSS classes (may not work in all email clients)
    const elementsWithClass = $('[class]');
    if (elementsWithClass.length > 0) {
      warnings.push('Elements with CSS classes found - inline styles are more reliable for email');
    }

    // Check for table structure (recommended for email)
    const tables = $('table');
    if (tables.length === 0) {
      warnings.push('No table structure found - tables are recommended for email layout');
    }

    // Check for viewport meta tag
    const viewportMeta = $('meta[name="viewport"]');
    if (viewportMeta.length === 0) {
      warnings.push('No viewport meta tag found - consider adding for mobile responsiveness');
    }

    const isValid = errors.length === 0;

    console.log(`HTML validation completed: ${isValid ? 'Valid' : 'Invalid'} (${errors.length} errors, ${warnings.length} warnings)`);

    return {
      isValid,
      errors,
      warnings
    };

  } catch (error) {
    console.error('❌ HTML validation error:', error);
    return {
      isValid: false,
      errors: [`Validation failed: ${error.message}`],
      warnings: []
    };
  }
}

/**
 * Generate plain text from HTML content
 * @param {string} htmlContent - HTML content to convert
 * @returns {string} Plain text content
 */
export function generateTextFromHTML(htmlContent) {
  try {
    if (!htmlContent.trim()) {
      return '';
    }

    // Clean HTML using cheerio
    const $ = cheerio.load(htmlContent);
    
    // Remove script and style elements
    $('script, style, noscript').remove();
    
    // Get cleaned HTML
    const cleanedHtml = $.html();
    
    // Convert to text using html-to-text
    const textContent = convert(cleanedHtml, {
      wordwrap: 80,
      selectors: [
        { selector: 'a', options: { ignoreHref: true } },
        { selector: 'img', format: 'skip' },
        { selector: 'table', options: { maxColumnWidth: 50 } }
      ]
    });

    console.log('✅ HTML converted to text successfully');
    return textContent.trim();

  } catch (error) {
    console.error('❌ Text generation error:', error);
    throw new Error(`Failed to generate text: ${error.message}`);
  }
}

/**
 * Minify HTML content for storage
 * @param {string} htmlContent - HTML content to minify
 * @returns {string} Minified HTML content
 */
export function minifyHTML(htmlContent) {
  try {
    if (!htmlContent.trim()) {
      return '';
    }

    // Load HTML with cheerio
    const $ = cheerio.load(htmlContent, {
      xmlMode: false,
      decodeEntities: false
    });

    // Remove comments
    $('*').contents().filter(function() {
      return this.nodeType === 8; // Comment node
    }).remove();

    // Get minified HTML
    const minified = $.html({
      xmlMode: false,
      decodeEntities: false
    });

    // Additional minification: remove extra whitespace
    const cleaned = minified
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/>\s+</g, '><') // Remove spaces between tags
      .replace(/\s+>/g, '>') // Remove spaces before closing tags
      .replace(/>\s+/g, '>') // Remove spaces after opening tags
      .trim();

    console.log('✅ HTML minified successfully');
    return cleaned;

  } catch (error) {
    console.error('❌ HTML minification error:', error);
    // Return original content if minification fails
    return htmlContent;
  }
}
