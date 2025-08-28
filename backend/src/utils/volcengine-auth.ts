import crypto from 'crypto';

/**
 * 火山引擎 API 签名工具
 * 支持 Access Key ID 和 Secret Access Key 认证方式
 */

export interface VolcengineCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  service?: string;
}

export interface SignedRequest {
  headers: Record<string, string>;
  url: string;
  method: string;
  body?: string;
}

/**
 * 生成火山引擎 API 签名
 */
export class VolcengineAuthUtil {
  private credentials: VolcengineCredentials;

  constructor(credentials: VolcengineCredentials) {
    this.credentials = {
      ...credentials,
      region: credentials.region || 'cn-north-1',
      service: credentials.service || 'tts'
    };
  }

  /**
   * 签名请求
   */
  signRequest(
    method: string,
    url: string,
    headers: Record<string, string> = {},
    body?: string
  ): SignedRequest {
    const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const date = timestamp.substr(0, 8);

    // 准备请求头
    const signedHeaders = {
      ...headers,
      'Host': this.getHostFromUrl(url),
      'X-Date': timestamp,
      'X-Content-Sha256': this.sha256(body || ''),
      'Content-Type': headers['Content-Type'] || 'application/json'
    };

    // 创建规范请求
    const canonicalRequest = this.createCanonicalRequest(
      method,
      url,
      signedHeaders,
      body
    );

    // 创建字符串待签名
    const stringToSign = this.createStringToSign(
      timestamp,
      this.createCredentialScope(date),
      canonicalRequest
    );

    // 生成签名
    const signature = this.calculateSignature(
      stringToSign,
      date
    );

    // 添加授权头
    const authHeader = this.createAuthorizationHeader(
      date,
      Object.keys(signedHeaders).sort().join(';'),
      signature
    );

    const finalHeaders = {
      ...signedHeaders,
      'Authorization': authHeader
    };

    return {
      headers: finalHeaders,
      url,
      method,
      body
    };
  }

  /**
   * 创建规范请求
   */
  private createCanonicalRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: string
  ): string {
    const urlParts = new URL(url);
    const canonicalUri = urlParts.pathname;
    const canonicalQueryString = urlParts.search.slice(1); // 移除 '?'
    
    // 规范化头部
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map(key => `${key.toLowerCase()}:${headers[key].trim()}`)
      .join('\n') + '\n';
    
    const signedHeaders = Object.keys(headers)
      .sort()
      .map(key => key.toLowerCase())
      .join(';');

    const payloadHash = this.sha256(body || '');

    return [
      method.toUpperCase(),
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');
  }

  /**
   * 创建字符串待签名
   */
  private createStringToSign(
    timestamp: string,
    credentialScope: string,
    canonicalRequest: string
  ): string {
    const algorithm = 'HMAC-SHA256';
    const requestHash = this.sha256(canonicalRequest);

    return [
      algorithm,
      timestamp,
      credentialScope,
      requestHash
    ].join('\n');
  }

  /**
   * 计算签名
   */
  private calculateSignature(
    stringToSign: string,
    date: string
  ): string {
    const kDate = this.hmacSha256(date, `volc${this.credentials.secretAccessKey}`);
    const kRegion = this.hmacSha256(this.credentials.region!, kDate);
    const kService = this.hmacSha256(this.credentials.service!, kRegion);
    const kSigning = this.hmacSha256('request', kService);
    
    return this.hmacSha256(stringToSign, kSigning).toString('hex');
  }

  /**
   * 创建凭证范围
   */
  private createCredentialScope(date: string): string {
    return `${date}/${this.credentials.region}/${this.credentials.service}/request`;
  }

  /**
   * 创建授权头
   */
  private createAuthorizationHeader(
    date: string,
    signedHeaders: string,
    signature: string
  ): string {
    const credentialScope = this.createCredentialScope(date);
    const credential = `${this.credentials.accessKeyId}/${credentialScope}`;
    
    return `HMAC-SHA256 Credential=${credential}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  }

  /**
   * 从URL获取主机名
   */
  private getHostFromUrl(url: string): string {
    return new URL(url).host;
  }

  /**
   * SHA256 哈希
   */
  private sha256(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  /**
   * HMAC-SHA256
   */
  private hmacSha256(data: string, key: string | Buffer): Buffer {
    return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
  }
}

/**
 * 便捷函数：创建签名认证工具
 */
export function createVolcengineAuth(credentials: VolcengineCredentials): VolcengineAuthUtil {
  return new VolcengineAuthUtil(credentials);
}