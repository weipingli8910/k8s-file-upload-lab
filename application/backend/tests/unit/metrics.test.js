/**
 * Unit tests for metrics endpoint
 */
const request = require('supertest');
const { createTestApp } = require('../helpers/test-server');

describe('Metrics Endpoint', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('GET /metrics', () => {
    it('should return Prometheus metrics', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
    });

    it('should include HTTP request metrics', async () => {
      // Make a request first to generate metrics
      await request(app).get('/health');

      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.text).toContain('http_requests_total');
      expect(response.text).toContain('http_request_duration_seconds');
    });

    it('should include file upload metrics after upload', async () => {
      const mockS3 = {
        putObject: jest.fn().mockResolvedValue({ ETag: 'test' }),
        headBucket: jest.fn().mockResolvedValue({})
      };
      app = createTestApp(mockS3);

      // Upload a file
      await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from('test content'), 'test.txt');

      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.text).toContain('file_uploads_total');
      expect(response.text).toContain('file_upload_size_bytes');
    });
  });
});

