import { Injectable } from '@nestjs/common';

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

@Injectable()
export class HealthService {
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
