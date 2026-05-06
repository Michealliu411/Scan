export interface HealthResponse {
  status: 'ok';
}

export class AppService {
  getHealth(): HealthResponse {
    return { status: 'ok' };
  }
}
