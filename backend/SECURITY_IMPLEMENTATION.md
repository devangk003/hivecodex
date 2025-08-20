# Security Implementation Documentation

## Overview
This document outlines the comprehensive security measures implemented in the HiveCodex backend server using only existing dependencies from package.json.

## Implemented Security Measures

### 1. Security Headers (Helmet.js Alternative)
Since helmet.js is not available in the dependencies, we've implemented equivalent security headers using Express:

- **X-Frame-Options**: `DENY` - Prevents clickjacking attacks
- **X-Content-Type-Options**: `nosniff` - Prevents MIME type sniffing
- **X-XSS-Protection**: `1; mode=block` - Enables XSS protection
- **Referrer-Policy**: `strict-origin-when-cross-origin` - Controls referrer information
- **Content-Security-Policy**: Comprehensive CSP to prevent XSS and injection attacks
- **Permissions-Policy**: Restricts access to browser features (geolocation, microphone, camera)

### 2. Rate Limiting (express-rate-limit)
Implemented tiered rate limiting for different endpoint categories:

- **Authentication Endpoints**: 5 attempts per 15 minutes
- **General API Endpoints**: 100 requests per 15 minutes  
- **Room Operations**: 30 requests per 15 minutes

### 3. Input Sanitization for XSS Prevention
Custom middleware that sanitizes both request body and query parameters:

- Removes dangerous HTML tags (`<script>`, `<iframe>`, `<object>`, `<embed>`)
- Strips JavaScript and VBScript protocols
- Removes event handlers (`onload`, `onerror`, `onclick`)
- Applied to all incoming requests

### 4. Enhanced CORS Configuration
Origin validation with whitelist approach:

- **Allowed Origins**: Configurable list including localhost variants
- **Methods**: Restricted to necessary HTTP methods
- **Credentials**: Enabled for authenticated requests
- **Headers**: Controlled list of allowed headers
- **Origin Validation**: Dynamic validation with logging of blocked requests

### 5. Request Size Limits and Validation
Comprehensive request validation:

- **Maximum Request Size**: 50MB limit
- **Parameter Limits**: Maximum 100 parameters per request
- **JSON Validation**: Strict JSON parsing with error handling
- **Content-Length Validation**: Pre-request size checking

### 6. Input Validation Middleware (express-validator)
Applied to critical endpoints:

- **Registration**: Name, email, and password validation
- **Login**: Email and password validation
- **Room Creation**: Room name validation
- **Message Posting**: Message content validation

### 7. Enhanced Error Handling
Improved error responses with security considerations:

- **CORS Errors**: Proper handling of unauthorized origins
- **JSON Parsing Errors**: Validation of request payloads
- **Rate Limiting Errors**: Proper 429 responses with retry information
- **Development vs Production**: Stack traces only in development

## Configuration

### Security Constants (config/constants.ts)
All security settings are centralized in the constants file:

```typescript
export const SECURITY_CONFIG = {
  // Rate Limiting
  AUTH_RATE_LIMIT: { windowMs: 15 * 60 * 1000, max: 5 },
  GENERAL_RATE_LIMIT: { windowMs: 15 * 60 * 1000, max: 100 },
  STRICT_RATE_LIMIT: { windowMs: 15 * 60 * 1000, max: 30 },
  
  // Request Limits
  MAX_REQUEST_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_PARAMETERS: 100,
  
  // CORS Origins
  ALLOWED_ORIGINS: [...],
  
  // Security Headers
  SECURITY_HEADERS: {...}
};
```

## Middleware Order
Security middleware is applied in the following order for maximum effectiveness:

1. **Security Headers** - Applied first to all responses
2. **CORS** - Origin validation before any processing
3. **Request Size Limiter** - Early rejection of oversized requests
4. **Input Sanitization** - XSS prevention on all inputs
5. **Rate Limiting** - Applied to specific route groups
6. **Body Parsing** - With strict limits and validation
7. **Validation** - Applied to specific endpoints
8. **Error Handling** - Comprehensive error management

## Endpoints with Validation

### Authentication Endpoints
- `/api/register` - Name, email, password validation
- `/api/login` - Email, password validation

### Room Management
- `/api/rooms` (POST) - Room name validation
- `/api/rooms/:roomId/messages` (POST) - Message content validation

## Security Benefits

1. **XSS Prevention**: Multiple layers of protection including CSP and input sanitization
2. **CSRF Protection**: CORS origin validation and security headers
3. **Rate Limiting**: Protection against brute force and DDoS attacks
4. **Input Validation**: Structured validation with clear error messages
5. **Request Limits**: Protection against resource exhaustion attacks
6. **Security Headers**: Modern browser security features enabled
7. **Error Handling**: Secure error responses without information leakage

## Monitoring and Logging

- **CORS Violations**: Logged with origin information
- **Rate Limiting**: Standard headers with retry information
- **Validation Errors**: Structured error responses
- **Request Logging**: Comprehensive request/response logging for debugging

## Dependencies Used

All security measures use existing dependencies:
- `express-rate-limit` - Rate limiting
- `express-validator` - Input validation
- `cors` - CORS configuration
- Native Express features - Security headers, request limits

## Future Enhancements

Consider adding these security measures when dependencies are available:
- `helmet` - Additional security headers
- `express-slow-down` - Progressive rate limiting
- `hpp` - HTTP Parameter Pollution protection
- `express-mongo-sanitize` - MongoDB injection protection

## Testing Security Measures

To test the implemented security measures:

1. **Rate Limiting**: Send multiple rapid requests to see 429 responses
2. **CORS**: Try requests from unauthorized origins
3. **Input Sanitization**: Send requests with script tags and see them removed
4. **Request Size**: Send oversized requests to see 413 responses
5. **Validation**: Send invalid data to validated endpoints

## Compliance

These security measures help achieve compliance with:
- OWASP Top 10 security risks
- Modern web application security standards
- Best practices for Express.js applications
