/**
 * Performance/Load tests
 * Tests application under load
 */
const request = require('supertest');
const { createTestApp } = require('../helpers/test-server');
const MockS3 = require('../helpers/mock-s3');

describe('Performance Tests', () => {
  let app;
  let mockS3;

  beforeEach(() => {
    mockS3 = new MockS3();
    mockS3.createBucket('test-bucket');
    app = createTestApp(mockS3);
  });

  afterEach(() => {
    mockS3.clear();
  });

  describe('Response Time Tests', () => {
    it('should respond to health check within 100ms', async () => {
      const start = Date.now();
      await request(app).get('/health').expect(200);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });

    it('should respond to metrics endpoint within 200ms', async () => {
      const start = Date.now();
      await request(app).get('/metrics').expect(200);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(200);
    });

    it('should upload small file within 500ms', async () => {
      const fileContent = Buffer.alloc(1024, 'A'); // 1KB

      const start = Date.now();
      await request(app)
        .post('/api/upload')
        .attach('file', fileContent, 'small.txt')
        .expect(200);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500);
    });

    it('should upload medium file within 2s', async () => {
      const fileContent = Buffer.alloc(1024 * 100, 'A'); // 100KB

      const start = Date.now();
      await request(app)
        .post('/api/upload')
        .attach('file', fileContent, 'medium.txt')
        .expect(200);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Concurrent Request Tests', () => {
    it('should handle 10 concurrent health checks', async () => {
      const requests = Array(10).fill(null).map(() =>
        request(app).get('/health')
      );

      const start = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - start;

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // All requests should complete within 1 second
      expect(duration).toBeLessThan(1000);
    });

    it('should handle 5 concurrent file uploads', async () => {
      const fileContent = Buffer.alloc(1024, 'A');

      const requests = Array(5).fill(null).map((_, i) =>
        request(app)
          .post('/api/upload')
          .attach('file', fileContent, `concurrent-${i}.txt`)
      );

      const start = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - start;

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // All uploads should complete within 3 seconds
      expect(duration).toBeLessThan(3000);
    });
  });

  describe('Throughput Tests', () => {
    it('should handle 100 requests per second', async () => {
      const requests = Array(100).fill(null).map(() =>
        request(app).get('/health')
      );

      const start = Date.now();
      await Promise.all(requests);
      const duration = Date.now() - start;

      const rps = 100 / (duration / 1000);
      expect(rps).toBeGreaterThan(50); // At least 50 RPS
    });
  });
});

