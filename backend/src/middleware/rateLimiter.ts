import { Request, Response, NextFunction } from 'express';

interface RequestBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RequestBucket>();

export function rateLimiter(limit = 120, windowMs = 60000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    let bucket = buckets.get(ip);
    if (!bucket || now > bucket.resetAt) {
      bucket = {
        count: 1,
        resetAt: now + windowMs,
      };
      buckets.set(ip, bucket);
    } else {
      bucket.count += 1;
    }

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - bucket.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));

    if (bucket.count > limit) {
      res.status(429).json({ error: 'Muitas requisições. Aguarde um momento antes de tentar novamente.' });
      return;
    }

    next();
  };
}
