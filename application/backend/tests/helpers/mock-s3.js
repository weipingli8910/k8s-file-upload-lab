/**
 * Mock AWS S3 client for testing
 */
class MockS3 {
  constructor() {
    this.buckets = new Map();
    this.objects = new Map();
  }

  async headBucket(params) {
    const { Bucket } = params;
    if (!this.buckets.has(Bucket)) {
      const error = new Error('NotFound');
      error.code = 'NotFound';
      error.statusCode = 404;
      throw error;
    }
    return { Bucket };
  }

  async putObject(params) {
    const { Bucket, Key, Body, ContentType, Metadata } = params;
    
    if (!this.buckets.has(Bucket)) {
      this.buckets.set(Bucket, true);
    }

    this.objects.set(`${Bucket}/${Key}`, {
      Bucket,
      Key,
      Body,
      ContentType,
      Metadata,
      Size: Body.length,
      LastModified: new Date()
    });

    return {
      ETag: `"${Key}-etag"`,
      VersionId: '1'
    };
  }

  async listObjectsV2(params) {
    const { Bucket, MaxKeys = 1000 } = params;
    const prefix = params.Prefix || '';

    const contents = [];
    for (const [key, obj] of this.objects.entries()) {
      if (key.startsWith(`${Bucket}/${prefix}`)) {
        contents.push({
          Key: obj.Key,
          Size: obj.Size,
          LastModified: obj.LastModified,
          ETag: `"${obj.Key}-etag"`
        });
      }
    }

    return {
      Contents: contents.slice(0, MaxKeys),
      IsTruncated: contents.length > MaxKeys,
      KeyCount: contents.length
    };
  }

  getSignedUrl(operation, params) {
    const { Bucket, Key, Expires } = params;
    const url = `https://${Bucket}.s3.amazonaws.com/${Key}?signature=mock&expires=${Expires}`;
    return url;
  }

  async deleteObject(params) {
    const { Bucket, Key } = params;
    const key = `${Bucket}/${Key}`;
    
    if (this.objects.has(key)) {
      this.objects.delete(key);
    }

    return {
      DeleteMarker: true,
      VersionId: '1'
    };
  }

  // Helper methods for testing
  clear() {
    this.buckets.clear();
    this.objects.clear();
  }

  createBucket(bucketName) {
    this.buckets.set(bucketName, true);
  }

  getObject(bucketName, key) {
    return this.objects.get(`${bucketName}/${key}`);
  }
}

module.exports = MockS3;

