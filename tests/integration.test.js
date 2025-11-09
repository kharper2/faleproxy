const request = require('supertest');
const nock = require('nock');
const app = require('../app');
const { sampleHtmlWithYale } = require('./test-utils');

describe('Integration Tests', () => {
  beforeAll(() => {
    // Mock external HTTP requests but allow localhost (for supertest)
    nock.disableNetConnect();
    // Allow localhost connections using regex
    nock.enableNetConnect(/^(127\.0\.0\.1|localhost)/);
  });

  afterEach(() => {
    // Clean up nock interceptors after each test
    nock.cleanAll();
  });

  afterAll(() => {
    // Re-enable network connections
    nock.enableNetConnect();
  });

  test('Should replace Yale with Fale in fetched content', async () => {
    // Setup mock for example.com
    nock('https://example.com')
      .get('/')
      .reply(200, sampleHtmlWithYale);
    
    // Make a request to our proxy app using supertest
    const response = await request(app)
      .post('/fetch')
      .send({ url: 'https://example.com/' })
      .expect(200);
    
    expect(response.body.success).toBe(true);
    
    // Verify Yale has been replaced with Fale in text
    const cheerio = require('cheerio');
    const $ = cheerio.load(response.body.content);
    expect($('title').text()).toBe('Fale University Test Page');
    expect($('h1').text()).toBe('Welcome to Fale University');
    expect($('p').first().text()).toContain('Fale University is a private');
    
    // Verify URLs remain unchanged
    const links = $('a');
    let hasYaleUrl = false;
    links.each((i, link) => {
      const href = $(link).attr('href');
      if (href && href.includes('yale.edu')) {
        hasYaleUrl = true;
      }
    });
    expect(hasYaleUrl).toBe(true);
    
    // Verify link text is changed
    expect($('a').first().text()).toBe('About Fale');
  });

  test('Should handle invalid URLs', async () => {
    // Mock a failing URL
    nock('https://invalid-url-that-does-not-exist-12345.com')
      .get('/')
      .replyWithError('getaddrinfo ENOTFOUND');
    
    const response = await request(app)
      .post('/fetch')
      .send({ url: 'https://invalid-url-that-does-not-exist-12345.com/' })
      .expect(500);
    
    expect(response.body.error).toContain('Failed to fetch content');
  });

  test('Should handle missing URL parameter', async () => {
    const response = await request(app)
      .post('/fetch')
      .send({})
      .expect(400);
    
    expect(response.body.error).toBe('URL is required');
  });
});
